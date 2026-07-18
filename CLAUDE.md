# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris in vanilla JavaScript + HTML5 Canvas + CSS. No dependencies, no build step, no package.json. README.md is written in Spanish and documents the game in detail — check it for game rules/mechanics before re-deriving them.

## Running

No build/install. Open directly or serve statically:

```bash
xdg-open index.html          # or open on macOS
python3 -m http.server 8000  # then visit localhost:8000
npx serve .
```

No test suite, linter, or bundler configured.

## Architecture

Three files, all logic lives in `game.js` (~300 lines, single global scope, no modules):

- `index.html` — DOM shell: `<canvas id="board">` (300×600, must stay in sync with `COLS/ROWS/BLOCK` in game.js), `<canvas id="next-canvas">` for the next-piece preview, HUD spans (`score`/`lines`/`level`), and the pause/game-over `#overlay`.
- `style.css` — dark retro-arcade visual theme only.
- `game.js` — entire game: state, input, physics, rendering. Key pieces:
  - Board is a `ROWS × COLS` matrix of ints; `0` = empty, `1–7` = piece color index (`COLORS`/`PIECES` arrays).
  - `collide(shape, ox, oy)` is the single source of truth for boundary/overlap checks — used by movement, rotation, ghost-piece projection, and spawn.
  - `rotateCW` transposes+reverses the shape matrix; `tryRotate` applies it with wall-kick offsets `[0, -1, 1, -2, 2]`, falling back to no-op if all kicks collide.
  - `loop(ts)` is a `requestAnimationFrame` accumulator driving gravity via `dropInterval`; `dropInterval` shrinks as `level` increases (`max(100, 1000 - (level-1)*90)`), recalculated in `clearLines()`.
  - Ghost piece (`ghostY`) and ordinary piece share the same `drawBlock` renderer, differing only by `alpha`.
  - Single mutable module-level state (`board, current, next, score, lines, level, paused, gameOver, ...`) reset by `init()`, re-invoked on restart-button click.

When changing `COLS`, `ROWS`, or `BLOCK`, update the `#board` canvas `width`/`height` attributes in `index.html` to match (`COLS×BLOCK`, `ROWS×BLOCK`).
