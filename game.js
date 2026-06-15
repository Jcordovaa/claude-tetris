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

const SKINS = {
  retro: {
    label: 'Retro',
    palette: COLORS,
    background: null, // use theme var (--board-bg)
    glow: false,
    rounded: false,
    texture: false,
  },
  neon: {
    label: 'Neon',
    palette: [
      null,
      '#00f3ff', // I - electric cyan
      '#fff700', // O - electric yellow
      '#ff00ff', // T - magenta
      '#00ff66', // S - electric green
      '#ff1744', // Z - red
      '#2979ff', // J - electric blue
      '#ff9100', // L - electric orange
      '#b0bec5', // N - grey
      '#ff5252', // BOMB - red
      '#fff176', // RAYO - bright yellow
    ],
    background: '#000000',
    glow: true,
    rounded: false,
    texture: false,
  },
  pastel: {
    label: 'Pastel',
    palette: [
      null,
      '#b3e5fc', // I - pastel cyan
      '#fff9c4', // O - pastel yellow
      '#e1bee7', // T - pastel purple
      '#c8e6c9', // S - pastel green
      '#ffcdd2', // Z - pastel red
      '#bbdefb', // J - pastel blue
      '#ffe0b2', // L - pastel orange
      '#cfd8dc', // N - pastel grey
      '#ffcdd2', // BOMB - pastel red
      '#fff9c4', // RAYO - pastel yellow
    ],
    background: null, // use theme var (--board-bg)
    glow: false,
    rounded: true,
    texture: false,
  },
  pixel: {
    label: 'Pixel Art',
    palette: COLORS,
    background: null, // use theme var (--board-bg)
    glow: false,
    rounded: false,
    texture: true,
  },
};

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
const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';

let currentSkin = 'retro';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let linesSincePowerup, pendingPowerup;

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
  clearLines();
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

function fillRoundedRect(context, x, y, w, h, radius) {
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(x, y, w, h, radius);
    context.fill();
    return;
  }
  // fallback for environments without roundRect
  const r = Math.min(radius, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
  context.fill();
}

function drawPixelTexture(context, x, y, size) {
  // simple repeating checker texture using lighter/darker squares
  const px = Math.max(2, Math.floor(size / 6));
  const inner = size - 2;
  context.fillStyle = 'rgba(255, 255, 255, 0.15)';
  for (let gy = 0; gy < inner; gy += px * 2) {
    for (let gx = 0; gx < inner; gx += px * 2) {
      context.fillRect(x * size + 1 + gx, y * size + 1 + gy, px, px);
    }
  }
  context.fillStyle = 'rgba(0, 0, 0, 0.15)';
  for (let gy = px; gy < inner; gy += px * 2) {
    for (let gx = px; gx < inner; gx += px * 2) {
      context.fillRect(x * size + 1 + gx, y * size + 1 + gy, px, px);
    }
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin] || SKINS.retro;
  const palette = skin.palette || COLORS;
  const color = palette[colorIndex] || COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;

  const bx = x * size + 1;
  const by = y * size + 1;
  const bw = size - 2;
  const bh = size - 2;

  if (skin.glow) {
    context.shadowColor = color;
    context.shadowBlur = size * 0.5;
  }

  if (skin.rounded) {
    fillRoundedRect(context, bx, by, bw, bh, size * 0.25);
  } else {
    context.fillRect(bx, by, bw, bh);
  }

  if (skin.glow) {
    context.shadowBlur = 0;
  }

  if (skin.texture) {
    drawPixelTexture(context, x, y, size);
  }

  // highlight
  context.fillStyle = themeColor('--block-highlight');
  if (skin.rounded) {
    fillRoundedRect(context, bx, by, bw, 4, size * 0.25);
  } else {
    context.fillRect(bx, by, bw, 4);
  }

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

  const skin = SKINS[currentSkin] || SKINS.retro;
  if (skin.background) {
    ctx.fillStyle = skin.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

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

  const skin = SKINS[currentSkin] || SKINS.retro;
  if (skin.background) {
    nextCtx.fillStyle = skin.background;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  }

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

function setSkin(name) {
  if (!SKINS[name]) name = 'retro';
  currentSkin = name;
  if (skinSelect) skinSelect.value = currentSkin;
  localStorage.setItem(SKIN_KEY, currentSkin);
  draw();
  drawNext();
}

function loadSkin() {
  const stored = localStorage.getItem(SKIN_KEY);
  currentSkin = (stored && SKINS[stored]) ? stored : 'retro';
  if (skinSelect) skinSelect.value = currentSkin;
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
  loadSkin();
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
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
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

if (skinSelect) {
  skinSelect.addEventListener('change', () => {
    setSkin(skinSelect.value);
  });
}

themeSwitch.addEventListener('change', () => {
  applyTheme(themeSwitch.checked ? 'light' : 'dark');
});

init();
