'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (nut), grey
  '#ff5252', // BOMB - red
  '#fff176', // RAYO - bright yellow
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (hueco central)
  [[9]],                                       // BOMB - destruye area 3x3
  [[10]],                                      // RAYO - limpia fila y columna
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const BOMB_TYPE = 9;
const RAYO_TYPE = 10;
const POWERUP_LINES = 5; // cada cuántas líneas despejadas aparece un power-up
const POWERUP_CELL_SCORE = 30; // puntos por celda destruida por un power-up

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeSwitch = document.getElementById('theme-switch');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const highscoresListEl = document.getElementById('highscores-list');
const overlayHighscoresEl = document.getElementById('overlay-highscores');
const saveScoreSection = document.getElementById('save-score-section');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');

const THEME_KEY = 'tetris-theme';
const HIGHSCORES_KEY = 'tetris-highscores';
const STATS_KEY = 'tetris-stats';
const MAX_HIGHSCORES = 5;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let linesSincePowerup, pendingPowerup;
let combo, maxCombo;

function loadHighscores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(e => e && typeof e.name === 'string' && typeof e.score === 'number' && typeof e.lines === 'number');
  } catch {
    return [];
  }
}

function saveHighscores(list) {
  try {
    localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
  } catch {
    // ignore (e.g. storage unavailable)
  }
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { bestCombo: 0, maxLines: 0 };
    const parsed = JSON.parse(raw);
    return {
      bestCombo: typeof parsed.bestCombo === 'number' ? parsed.bestCombo : 0,
      maxLines: typeof parsed.maxLines === 'number' ? parsed.maxLines : 0,
    };
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // ignore
  }
}

function qualifiesForHighscore(s) {
  const list = loadHighscores();
  if (list.length < MAX_HIGHSCORES) return true;
  return s > list[list.length - 1].score;
}

function addHighscore(name, s, l) {
  const list = loadHighscores();
  list.push({ name: name || 'AAA', score: s, lines: l });
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, MAX_HIGHSCORES);
  saveHighscores(list);
  return list;
}

function updateStatsOnGameOver() {
  const stats = loadStats();
  let changed = false;
  if (maxCombo > stats.bestCombo) {
    stats.bestCombo = maxCombo;
    changed = true;
  }
  if (lines > stats.maxLines) {
    stats.maxLines = lines;
    changed = true;
  }
  if (changed) saveStats(stats);
  return stats;
}

function renderStats() {
  const stats = loadStats();
  bestComboEl.textContent = stats.bestCombo;
  maxLinesEl.textContent = stats.maxLines;
}

function renderHighscoresTable(container, highlightEntry) {
  const list = loadHighscores();
  container.innerHTML = '';
  if (list.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'highscores-empty';
    empty.textContent = 'Sin récords todavía';
    container.appendChild(empty);
    return;
  }
  const table = document.createElement('table');
  table.className = 'highscores-table';
  list.forEach((entry, i) => {
    const row = document.createElement('tr');
    if (highlightEntry &&
        entry.name === highlightEntry.name &&
        entry.score === highlightEntry.score &&
        entry.lines === highlightEntry.lines) {
      row.classList.add('highscore-highlight');
    }
    const rankCell = document.createElement('td');
    rankCell.textContent = `${i + 1}.`;
    const nameCell = document.createElement('td');
    nameCell.textContent = entry.name;
    const scoreCell = document.createElement('td');
    scoreCell.textContent = entry.score.toLocaleString();
    const linesCell = document.createElement('td');
    linesCell.textContent = `${entry.lines}L`;
    row.append(rankCell, nameCell, scoreCell, linesCell);
    table.appendChild(row);
  });
  container.appendChild(table);
}

function renderAllHighscores(highlightEntry) {
  renderHighscoresTable(highscoresListEl, highlightEntry);
  renderHighscoresTable(overlayHighscoresEl, highlightEntry);
}

function resetRecords() {
  saveHighscores([]);
  saveStats({ bestCombo: 0, maxLines: 0 });
  renderAllHighscores(null);
  renderStats();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece(forceSpecial) {
  const type = forceSpecial
    ? (Math.random() < 0.5 ? BOMB_TYPE : RAYO_TYPE)
    : Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function applyBomb() {
  let destroyed = 0;
  for (let r = current.y - 1; r <= current.y + 1; r++) {
    for (let c = current.x - 1; c <= current.x + 1; c++) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c]) {
        board[r][c] = 0;
        destroyed++;
      }
    }
  }
  score += destroyed * POWERUP_CELL_SCORE;
}

function applyRayo() {
  let destroyed = 0;
  for (let c = 0; c < COLS; c++) {
    if (board[current.y][c]) {
      board[current.y][c] = 0;
      destroyed++;
    }
  }
  for (let r = 0; r < ROWS; r++) {
    if (board[r][current.x]) {
      board[r][current.x] = 0;
      destroyed++;
    }
  }
  score += destroyed * POWERUP_CELL_SCORE;
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    linesSincePowerup += cleared;
    if (linesSincePowerup >= POWERUP_LINES) {
      linesSincePowerup -= POWERUP_LINES;
      pendingPowerup = true;
    }
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (current.type === BOMB_TYPE) {
    applyBomb();
  } else if (current.type === RAYO_TYPE) {
    applyRayo();
  } else {
    merge();
  }
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece(pendingPowerup);
  pendingPowerup = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function themeColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = themeColor('--block-highlight');
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (colorIndex === BOMB_TYPE || colorIndex === RAYO_TYPE) {
    context.font = `${Math.floor(size * 0.6)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(
      colorIndex === BOMB_TYPE ? '💣' : '⚡',
      x * size + size / 2,
      y * size + size / 2 + 1
    );
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = themeColor('--grid-color');
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');

  updateStatsOnGameOver();
  renderStats();

  if (qualifiesForHighscore(score)) {
    saveScoreSection.classList.remove('hidden');
    playerNameInput.value = '';
    renderAllHighscores(null);
    setTimeout(() => playerNameInput.focus(), 0);
  } else {
    saveScoreSection.classList.add('hidden');
    renderAllHighscores(null);
  }
}

function confirmSaveScore() {
  if (saveScoreSection.classList.contains('hidden')) return;
  const name = (playerNameInput.value || '').trim().slice(0, 12).toUpperCase() || 'AAA';
  addHighscore(name, score, lines);
  saveScoreSection.classList.add('hidden');
  renderAllHighscores({ name, score, lines });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeSwitch.checked = theme === 'light';
  localStorage.setItem(THEME_KEY, theme);
}

function applyTheme(theme) {
  setTheme(theme);
  draw();
  drawNext();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver || paused) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  setTheme(localStorage.getItem(THEME_KEY) || 'dark');
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  linesSincePowerup = 0;
  pendingPowerup = false;
  combo = 0;
  maxCombo = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  saveScoreSection.classList.add('hidden');
  renderStats();
  renderAllHighscores(null);
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

themeSwitch.addEventListener('change', () => {
  applyTheme(themeSwitch.checked ? 'light' : 'dark');
});

saveScoreBtn.addEventListener('click', confirmSaveScore);

playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') {
    e.preventDefault();
    confirmSaveScore();
  }
});

resetRecordsBtn.addEventListener('click', resetRecords);

init();
