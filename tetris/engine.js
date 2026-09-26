/* Classic Tetris rules: 10×20 well, 7-bag, SRS shapes and wall kicks, gravity, lock delay. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.Tetris = api;
})(typeof window !== "undefined" ? window : null, function () {
  const COLS = 10;
  const ROWS = 20;
  const LINES_PER_LEVEL = 10;
  const LOCK_MS = 500;
  const MAX_LOCK_RESETS = 15;
  const CLEAR_MS = 200;
  const DAS_MS = 160;
  const ARR_MS = 45;
  const SOFT_MS = 50;
  const LINE_SCORE = [0, 100, 300, 500, 800];
  // Guideline-style fall speed. Index 0 is level 1.
  const GRAVITY_MS = [800, 650, 520, 420, 340, 270, 210, 160, 120, 90, 70, 55, 42, 33, 25, 20, 16, 12, 9, 7];

  const SPAWNS = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    O: [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  };

  // Wall kicks from the Tetris Guideline. Y is positive upward; flipped when used.
  const JLSTZ_KICKS_UP = {
    "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  };
  const I_KICKS_UP = {
    "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  };

  function rotateMatrix(matrix) {
    const n = matrix.length;
    const next = Array.from({ length: n }, () => Array(n).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) next[x][n - 1 - y] = matrix[y][x];
    }
    return next;
  }

  function buildShapes() {
    const shapes = {};
    Object.keys(SPAWNS).forEach((type) => {
      if (type === "O") {
        shapes.O = [SPAWNS.O, SPAWNS.O, SPAWNS.O, SPAWNS.O];
        return;
      }
      const s0 = SPAWNS[type];
      const s1 = rotateMatrix(s0);
      const s2 = rotateMatrix(s1);
      const s3 = rotateMatrix(s2);
      shapes[type] = [s0, s1, s2, s3];
    });
    return shapes;
  }

  const SHAPES = buildShapes();

  function toScreenKicks(table) {
    const out = {};
    Object.keys(table).forEach((key) => {
      out[key] = table[key].map(([x, y]) => [x, -y]);
    });
    return out;
  }

  const JLSTZ_KICKS = toScreenKicks(JLSTZ_KICKS_UP);
  const I_KICKS = toScreenKicks(I_KICKS_UP);

  function gravityMs(level) {
    const index = Math.min(Math.max(level, 1), GRAVITY_MS.length) - 1;
    return GRAVITY_MS[index];
  }

  function cellsOf(type, rot, x, y) {
    const matrix = SHAPES[type][rot];
    const cells = [];
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) cells.push({ x: x + c, y: y + r });
      }
    }
    return cells;
  }

  function sameCells(a, b) {
    if (a.length !== b.length) return false;
    const seen = new Set(a.map((cell) => cell.x + "," + cell.y));
    return b.every((cell) => seen.has(cell.x + "," + cell.y));
  }

  function createGame(options) {
    const opts = options || {};
    const rng = opts.rng || Math.random;
    let script = opts.sequence ? opts.sequence.slice() : null;

    let board = [];
    let queue = [];
    let piece = null;
    let score = 0;
    let lines = 0;
    let level = 1;
    let status = "ready";
    let clearingRows = [];
    let clearTimer = 0;
    let gravityAcc = 0;
    let lockAcc = 0;
    let lockResets = 0;
    let grounded = false;
    let softTimer = 0;
    let dasTimer = 0;
    let nextRepeat = DAS_MS;
    let hDir = 0;
    const input = { left: false, right: false, soft: false };

    function emptyRow() {
      return Array.from({ length: COLS }, () => null);
    }

    function fillBag() {
      if (script && script.length) {
        queue.push(script.shift());
        return;
      }
      const bag = ["I", "O", "T", "S", "Z", "J", "L"];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = bag[i];
        bag[i] = bag[j];
        bag[j] = tmp;
      }
      bag.forEach((type) => queue.push(type));
    }

    function ensureQueue() {
      let guard = 0;
      while (queue.length < 7 && guard < 8) {
        const before = queue.length;
        fillBag();
        if (queue.length === before) break;
        guard += 1;
      }
    }

    function fits(type, rot, x, y) {
      return cellsOf(type, rot, x, y).every((cell) => {
        if (cell.x < 0 || cell.x >= COLS || cell.y >= ROWS) return false;
        if (cell.y >= 0 && board[cell.y][cell.x]) return false;
        return true;
      });
    }

    function resting() {
      return !!(piece && !fits(piece.type, piece.rot, piece.x, piece.y + 1));
    }

    function noteAction() {
      if (!piece) return;
      if (resting()) {
        grounded = true;
        if (lockResets < MAX_LOCK_RESETS) {
          lockAcc = 0;
          lockResets += 1;
        }
      } else {
        grounded = false;
        lockAcc = 0;
        lockResets = 0;
      }
    }

    function spawn() {
      ensureQueue();
      const type = queue.shift();
      ensureQueue();
      piece = { type: type, rot: 0, x: 3, y: 0 };
      gravityAcc = 0;
      lockAcc = 0;
      lockResets = 0;
      grounded = false;
      softTimer = 0;
      if (!fits(piece.type, piece.rot, piece.x, piece.y)) status = "over";
    }

    function resetState() {
      board = Array.from({ length: ROWS }, emptyRow);
      queue = [];
      piece = null;
      score = 0;
      lines = 0;
      level = 1;
      clearingRows = [];
      clearTimer = 0;
      gravityAcc = 0;
      lockAcc = 0;
      lockResets = 0;
      grounded = false;
      softTimer = 0;
      dasTimer = 0;
      nextRepeat = DAS_MS;
      hDir = 0;
      input.left = false;
      input.right = false;
      input.soft = false;
      if (opts.sequence) script = opts.sequence.slice();
      ensureQueue();
    }

    function finishClear() {
      const drop = new Set(clearingRows);
      const kept = [];
      for (let y = 0; y < ROWS; y++) if (!drop.has(y)) kept.push(board[y]);
      while (kept.length < ROWS) kept.unshift(emptyRow());
      board = kept;
      clearingRows = [];
      clearTimer = 0;
      status = "playing";
      spawn();
    }

    function lockPiece() {
      if (!piece || status !== "playing") return;
      const cells = cellsOf(piece.type, piece.rot, piece.x, piece.y);
      if (cells.some((cell) => cell.y < 0)) {
        status = "over";
        return;
      }
      cells.forEach((cell) => {
        board[cell.y][cell.x] = piece.type;
      });
      const full = [];
      for (let y = 0; y < ROWS; y++) {
        if (board[y].every(Boolean)) full.push(y);
      }
      piece = null;
      if (full.length) {
        score += (LINE_SCORE[full.length] || 0) * level;
        lines += full.length;
        level = 1 + Math.floor(lines / LINES_PER_LEVEL);
        clearingRows = full;
        clearTimer = 0;
        status = "clearing";
        return;
      }
      spawn();
    }

    function tryDown(award) {
      if (!piece || status !== "playing") return false;
      if (!fits(piece.type, piece.rot, piece.x, piece.y + 1)) {
        grounded = true;
        return false;
      }
      piece.y += 1;
      if (award) score += 1;
      grounded = !fits(piece.type, piece.rot, piece.x, piece.y + 1);
      lockAcc = 0;
      if (!grounded) lockResets = 0;
      return true;
    }

    function tryShift(dx) {
      if (!piece || status !== "playing") return false;
      if (!fits(piece.type, piece.rot, piece.x + dx, piece.y)) return false;
      const before = cellsOf(piece.type, piece.rot, piece.x, piece.y);
      piece.x += dx;
      const after = cellsOf(piece.type, piece.rot, piece.x, piece.y);
      if (!sameCells(before, after)) noteAction();
      return true;
    }

    function horizontalIntent() {
      if (input.left && input.right) return 0;
      if (input.left) return -1;
      if (input.right) return 1;
      return 0;
    }

    function kickHeldInput() {
      const now = horizontalIntent();
      hDir = now;
      dasTimer = 0;
      nextRepeat = DAS_MS;
      if (now && status === "playing") tryShift(now);
      if (input.soft && status === "playing") tryDown(true);
    }

    function setHeld(name, down) {
      if (name === "soft") {
        if (input.soft === down) return;
        input.soft = down;
        softTimer = 0;
        if (down) tryDown(true);
        return;
      }
      if (name !== "left" && name !== "right") return;
      if (input[name] === down) return;
      const prev = horizontalIntent();
      input[name] = down;
      const now = horizontalIntent();
      if (now === prev) return;
      hDir = now;
      dasTimer = 0;
      nextRepeat = DAS_MS;
      if (now !== 0) tryShift(now);
    }

    function rotate(dir) {
      if (!piece || status !== "playing") return false;
      const from = piece.rot;
      const to = (from + (dir < 0 ? 3 : 1)) % 4;
      const table = piece.type === "O" ? null : piece.type === "I" ? I_KICKS : JLSTZ_KICKS;
      const kicks = table ? table[from + ">" + to] : [[0, 0]];
      const before = cellsOf(piece.type, piece.rot, piece.x, piece.y);
      for (let i = 0; i < kicks.length; i++) {
        const kx = kicks[i][0];
        const ky = kicks[i][1];
        if (!fits(piece.type, to, piece.x + kx, piece.y + ky)) continue;
        piece.x += kx;
        piece.y += ky;
        piece.rot = to;
        const after = cellsOf(piece.type, piece.rot, piece.x, piece.y);
        if (!sameCells(before, after)) noteAction();
        return true;
      }
      return false;
    }

    function hardDrop() {
      if (!piece || status !== "playing") return 0;
      let distance = 0;
      while (fits(piece.type, piece.rot, piece.x, piece.y + 1)) {
        piece.y += 1;
        distance += 1;
      }
      score += distance * 2;
      lockPiece();
      return distance;
    }

    function updateHorizontal(dt) {
      if (status !== "playing" || !piece) return;
      const dir = horizontalIntent();
      if (!dir || dir !== hDir) return;
      dasTimer += dt;
      while (dasTimer >= nextRepeat) {
        dasTimer -= nextRepeat;
        nextRepeat = ARR_MS;
        if (!tryShift(dir)) break;
      }
    }

    function updateFall(dt) {
      if (status !== "playing" || !piece) return;
      if (input.soft) {
        const interval = Math.min(SOFT_MS, gravityMs(level));
        softTimer += dt;
        while (softTimer >= interval) {
          softTimer -= interval;
          if (!tryDown(true)) break;
        }
        return;
      }
      softTimer = 0;
      gravityAcc += dt;
      const interval = gravityMs(level);
      while (gravityAcc >= interval) {
        gravityAcc -= interval;
        if (!tryDown(false)) break;
      }
    }

    function updateLock(dt) {
      if (status !== "playing" || !piece) return false;
      if (!resting()) {
        grounded = false;
        return false;
      }
      if (!grounded) {
        grounded = true;
        lockAcc = 0;
      }
      lockAcc += dt;
      if (lockAcc >= LOCK_MS) {
        lockPiece();
        return true;
      }
      return false;
    }

    function tick(dt) {
      if (!dt || dt < 0) return;
      const step = Math.min(dt, 250);
      if (status === "clearing") {
        clearTimer += step;
        if (clearTimer >= CLEAR_MS) finishClear();
        return;
      }
      if (status !== "playing") return;
      let left = step;
      while (left > 0 && status === "playing") {
        const slice = Math.min(16, left);
        left -= slice;
        updateHorizontal(slice);
        updateFall(slice);
        if (updateLock(slice)) break;
      }
    }

    function start() {
      if (status === "ready") {
        status = "playing";
        spawn();
        kickHeldInput();
      } else if (status === "paused") {
        status = "playing";
        kickHeldInput();
      }
    }

    function restart() {
      resetState();
      status = "playing";
      spawn();
    }

    function togglePause() {
      if (status === "playing") status = "paused";
      else if (status === "paused") start();
    }

    function ghostY() {
      if (!piece) return null;
      let y = piece.y;
      while (fits(piece.type, piece.rot, piece.x, y + 1)) y += 1;
      return y;
    }

    function snapshot() {
      const gy = piece && status !== "over" ? ghostY() : null;
      return {
        board: board.map((row) => row.slice()),
        piece: piece
          ? {
              type: piece.type,
              rot: piece.rot,
              x: piece.x,
              y: piece.y,
              cells: cellsOf(piece.type, piece.rot, piece.x, piece.y),
              ghostY: gy,
              ghostCells: gy == null ? [] : cellsOf(piece.type, piece.rot, piece.x, gy),
            }
          : null,
        next: queue[0] || null,
        nextCells: queue[0] ? cellsOf(queue[0], 0, 0, 0, 0) : [],
        score: score,
        lines: lines,
        level: level,
        status: status,
        clearingRows: clearingRows.slice(),
      };
    }

    resetState();
    status = "ready";

    return {
      COLS: COLS,
      ROWS: ROWS,
      setHeld: setHeld,
      rotate: rotate,
      hardDrop: hardDrop,
      start: start,
      restart: restart,
      togglePause: togglePause,
      tick: tick,
      snapshot: snapshot,
    };
  }

  return {
    createGame: createGame,
    cellsOf: cellsOf,
    COLS: COLS,
    ROWS: ROWS,
    CLEAR_MS: CLEAR_MS,
    gravityMs: gravityMs,
  };
});
