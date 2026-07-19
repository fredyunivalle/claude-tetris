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
  '#90a4ae', // Nut - steel gray
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
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut (tuerca) - hueco central
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const HIGHSCORES_KEY = 'tetris-highscores';
const STATS_KEY = 'tetris-stats';
const MAX_HIGHSCORES = 5;

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
const overlayExtra = document.getElementById('overlay-extra');
const overlayStatsEl = document.getElementById('overlay-stats');
const overlayHighscoresEl = document.getElementById('overlay-highscores');
const highscoresListEl = document.getElementById('highscores-list');
const bestComboMiniEl = document.getElementById('best-combo-mini');
const maxLinesMiniEl = document.getElementById('max-lines-mini');
const nameEntry = document.getElementById('name-entry');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, combo, bestComboThisGame;
let gridColor = getGridColor();

// ---- Persistencia: récords y estadísticas ----
let highScores = loadHighScores();
let stats = loadStats();

function loadHighScores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(e => e && typeof e.score === 'number')
      .map(e => ({
        name: String(e.name || 'AAA').slice(0, 10),
        score: e.score,
        lines: Number(e.lines) || 0,
        combo: Number(e.combo) || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_HIGHSCORES);
  } catch {
    return [];
  }
}

function saveHighScores(list) {
  try {
    localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
  } catch {
    /* localStorage no disponible: se ignora */
  }
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { bestCombo: 0, maxLines: 0 };
    const parsed = JSON.parse(raw);
    return {
      bestCombo: Number(parsed.bestCombo) || 0,
      maxLines: Number(parsed.maxLines) || 0,
    };
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStats(s) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch {
    /* localStorage no disponible: se ignora */
  }
}

function qualifiesForHighScore(candidateScore) {
  if (highScores.length < MAX_HIGHSCORES) return true;
  return candidateScore > highScores[highScores.length - 1].score;
}

function renderHighScoresInto(container, highlightEntry) {
  container.innerHTML = '';
  if (highScores.length === 0) {
    const li = document.createElement('li');
    li.className = 'highscore-empty';
    li.textContent = 'Sin récords aún';
    container.appendChild(li);
    return;
  }
  highScores.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'highscore-row';
    if (entry === highlightEntry) li.classList.add('highscore-highlight');

    const rank = document.createElement('span');
    rank.className = 'hs-rank';
    rank.textContent = `${i + 1}.`;

    const name = document.createElement('span');
    name.className = 'hs-name';
    name.textContent = entry.name;

    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'hs-score';
    scoreSpan.textContent = entry.score.toLocaleString();

    li.append(rank, name, scoreSpan);
    container.appendChild(li);
  });
}

function renderHighScores(highlightEntry) {
  renderHighScoresInto(highscoresListEl, highlightEntry);
  renderHighScoresInto(overlayHighscoresEl, highlightEntry);
}

function renderStats() {
  bestComboMiniEl.textContent = stats.bestCombo;
  maxLinesMiniEl.textContent = stats.maxLines;
  overlayStatsEl.textContent = `Mejor combo: ${stats.bestCombo}  ·  Máx. líneas: ${stats.maxLines}`;
}

function saveScore() {
  const raw = playerNameInput.value.trim().slice(0, 10);
  const name = raw || 'AAA';
  const entry = { name, score, lines, combo: bestComboThisGame };
  highScores.push(entry);
  highScores.sort((a, b) => b.score - a.score);
  highScores = highScores.slice(0, MAX_HIGHSCORES);
  saveHighScores(highScores);
  renderHighScores(highScores.includes(entry) ? entry : null);
  nameEntry.classList.add('hidden');
  saveScoreBtn.disabled = true;
}

function resetHighScores() {
  if (!confirm('¿Seguro que deseas borrar todos los récords?')) return;
  highScores = [];
  stats = { bestCombo: 0, maxLines: 0 };
  saveHighScores(highScores);
  saveStats(stats);
  renderHighScores();
  renderStats();
}

function getGridColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--grid-color').trim();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
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
    combo++;
    bestComboThisGame = Math.max(bestComboThisGame, combo);
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
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
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
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

  let statsChanged = false;
  if (bestComboThisGame > stats.bestCombo) {
    stats.bestCombo = bestComboThisGame;
    statsChanged = true;
  }
  if (lines > stats.maxLines) {
    stats.maxLines = lines;
    statsChanged = true;
  }
  if (statsChanged) saveStats(stats);
  renderStats();

  overlayExtra.classList.remove('hidden');
  renderHighScores();
  if (qualifiesForHighScore(score)) {
    nameEntry.classList.remove('hidden');
    saveScoreBtn.disabled = false;
    playerNameInput.value = '';
    setTimeout(() => playerNameInput.focus(), 0);
  } else {
    nameEntry.classList.add('hidden');
  }

  overlay.classList.remove('hidden');
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
    overlayExtra.classList.add('hidden');
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
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  combo = 0;
  bestComboThisGame = 0;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  overlayExtra.classList.add('hidden');
  nameEntry.classList.add('hidden');
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

saveScoreBtn.addEventListener('click', saveScore);

playerNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveScore();
  }
});

resetScoresBtn.addEventListener('click', resetHighScores);

themeToggleBtn.addEventListener('click', () => {
  const isLight = document.documentElement.dataset.theme === 'light';
  document.documentElement.dataset.theme = isLight ? 'dark' : 'light';
  themeToggleBtn.textContent = isLight ? '🌙' : '☀️';
  themeToggleBtn.setAttribute('aria-label', isLight ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  gridColor = getGridColor();
  if (current) draw();
  if (next) drawNext();
});

renderHighScores();
renderStats();
init();
