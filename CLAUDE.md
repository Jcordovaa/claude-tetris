# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris. No build, no deps, no package.json. 3 files: `index.html`, `style.css`, `game.js`.

## Run

```bash
open index.html        # macOS, just open it
# or
python3 -m http.server 8000   # then visit localhost:8000
```

No tests, no lint, no build step.

## Architecture (`game.js`, ~300 lines)

- **Constants**: `COLS=10`, `ROWS=20`, `BLOCK=30`, `COLORS` (palette per piece), `PIECES` (7 shapes as square matrices), `LINE_SCORES = [0,100,300,500,800]`.
- **Board model**: matrix `ROWS × COLS`, each cell `0` (empty) or color index 1-7.
- **Rotation**: `rotateCW` = transpose + reverse rows. `tryRotate` does wall-kick: shifts ±1/±2 columns if rotation collides.
- **Collision**: `collide(shape, ox, oy)` — checks board bounds and overlap with locked cells.
- **Line clear**: `clearLines` scans bottom-up, removes full rows, unshifts empty rows at top.
- **Scoring**: `LINE_SCORES[n] * level`; hard drop +2/cell, soft drop +1/row.
- **Level/speed**: level up every 10 lines; `dropInterval = max(100, 1000 - (level-1)*90)` ms.
- **Ghost piece**: `ghostY()` projects current piece down; drawn with `globalAlpha = 0.2`.
- **Game loop**: `requestAnimationFrame` based `loop(ts)` — accumulates dt, drops piece when `dropAccum >= dropInterval`, calls `draw()`.
- **Flow**: `init()` → `createBoard()`, pick `next`, `spawn()` (moves next→current, generates new next), start loop. If `spawn()` immediately collides → `endGame()`.

## Tuning (in `game.js`)

Changing `COLS`, `ROWS`, or `BLOCK` requires updating `<canvas id="board">` width/height in `index.html` to match (`COLS*BLOCK` × `ROWS*BLOCK`).

## Controls

`←`/`→` move, `↑`/`X` rotate CW, `↓` soft drop, `Space` hard drop, `P` pause.
