(function () {
  const COLORS = {
    I: "#3ee0e0",
    O: "#ffe14a",
    T: "#c77dff",
    S: "#3dff8a",
    Z: "#ff4d73",
    J: "#5b8cff",
    L: "#ff9f1c",
  };
  const ORDER = ["I", "O", "T", "S", "Z", "J", "L"];

  const boardCanvas = document.getElementById("board");
  const nextCanvas = document.getElementById("next");
  const overlay = document.getElementById("overlay");
  const overlayKicker = document.getElementById("overlay-kicker");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const overlayBtn = document.getElementById("overlay-btn");
  const scoreEl = document.getElementById("score");
  const linesEl = document.getElementById("lines");
  const levelEl = document.getElementById("level");
  const swatches = document.getElementById("swatches");

  const game = Tetris.createGame();
  window.tetrisGame = game;

  ORDER.forEach((type) => {
    const chip = document.createElement("i");
    chip.style.background = COLORS[type];
    swatches.appendChild(chip);
  });

  let block = 28;
  let nextBlock = 24;
  let boardCtx = boardCanvas.getContext("2d");
  let nextCtx = nextCanvas.getContext("2d");
  let hudSig = "";

  function setupCanvas(canvas, width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return ctx;
  }

  function chooseBlock() {
    const narrow = window.innerWidth < 760;
    const chrome = narrow ? 360 : 210;
    const availH = window.innerHeight - chrome;
    const availW = narrow ? window.innerWidth - 56 : Math.min(window.innerWidth - 320, 460);
    const size = Math.floor(Math.min(availH / 20, availW / 10));
    return Math.max(16, Math.min(32, size));
  }

  function layout() {
    block = chooseBlock();
    nextBlock = Math.max(16, Math.round(block * 0.82));
    boardCtx = setupCanvas(boardCanvas, block * 10, block * 20);
    nextCtx = setupCanvas(nextCanvas, nextBlock * 4, nextBlock * 4);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function drawBlock(ctx, x, y, size, color, ghost) {
    const pad = Math.max(1, size * 0.06);
    const rx = x + pad;
    const ry = y + pad;
    const s = size - pad * 2;
    ctx.save();
    if (ghost) ctx.globalAlpha = 0.28;
    ctx.fillStyle = color;
    roundRect(ctx, rx, ry, s, s, Math.max(2, size * 0.16));
    ctx.fill();
    if (!ghost) {
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      roundRect(ctx, rx + s * 0.12, ry + s * 0.1, s * 0.76, Math.max(2, s * 0.18), 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(rx + s * 0.14, ry + s * 0.78, s * 0.72, Math.max(2, s * 0.08));
    }
    ctx.restore();
  }

  function drawBoard(snap) {
    const ctx = boardCtx;
    const w = block * 10;
    const h = block * 20;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#10131c";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.045)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < 10; c++) {
      ctx.moveTo(c * block + 0.5, 0);
      ctx.lineTo(c * block + 0.5, h);
    }
    for (let r = 1; r < 20; r++) {
      ctx.moveTo(0, r * block + 0.5);
      ctx.lineTo(w, r * block + 0.5);
    }
    ctx.stroke();

    const clearing = new Set(snap.clearingRows);
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 10; x++) {
        const type = snap.board[y][x];
        if (!type) continue;
        drawBlock(ctx, x * block, y * block, block, COLORS[type], false);
      }
    }

    const piece = snap.piece;
    if (piece && piece.ghostY != null && piece.ghostY !== piece.y) {
      piece.ghostCells.forEach((cell) => {
        if (cell.y < 0 || cell.y >= 20) return;
        drawBlock(ctx, cell.x * block, cell.y * block, block, COLORS[piece.type], true);
      });
    }
    if (piece) {
      piece.cells.forEach((cell) => {
        if (cell.y < 0 || cell.y >= 20) return;
        drawBlock(ctx, cell.x * block, cell.y * block, block, COLORS[piece.type], false);
      });
    }

    clearing.forEach((y) => {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(0, y * block, w, block);
    });
  }

  function drawNext(snap) {
    const ctx = nextCtx;
    const size = nextBlock * 4;
    ctx.clearRect(0, 0, size, size);
    if (!snap.next) return;
    const cells = snap.nextCells;
    let minX = 4, minY = 4, maxX = 0, maxY = 0;
    cells.forEach((cell) => {
      minX = Math.min(minX, cell.x);
      minY = Math.min(minY, cell.y);
      maxX = Math.max(maxX, cell.x);
      maxY = Math.max(maxY, cell.y);
    });
    const pw = (maxX - minX + 1) * nextBlock;
    const ph = (maxY - minY + 1) * nextBlock;
    const ox = (size - pw) / 2 - minX * nextBlock;
    const oy = (size - ph) / 2 - minY * nextBlock;
    cells.forEach((cell) => {
      drawBlock(ctx, ox + cell.x * nextBlock, oy + cell.y * nextBlock, nextBlock, COLORS[snap.next], false);
    });
  }

  function syncHud(snap) {
    const sig = [snap.status, snap.score, snap.lines, snap.level, snap.next].join("|");
    const scoreText = snap.score.toLocaleString("ru-RU");
    if (scoreEl.textContent !== scoreText) {
      scoreEl.textContent = scoreText;
      scoreEl.parentElement.classList.remove("bump");
      void scoreEl.parentElement.offsetWidth;
      scoreEl.parentElement.classList.add("bump");
    }
    linesEl.textContent = String(snap.lines);
    levelEl.textContent = String(snap.level);

    const playing = snap.status === "playing" || snap.status === "clearing";
    overlay.classList.toggle("hidden", playing);
    document.querySelectorAll("[data-tap='pause']").forEach((btn) => {
      btn.disabled = snap.status === "ready" || snap.status === "over";
      btn.setAttribute("aria-pressed", snap.status === "paused" ? "true" : "false");
    });

    if (snap.status === "paused") {
      overlayKicker.textContent = "пауза";
      overlayTitle.textContent = "Пауза";
      overlayText.textContent = "Нажмите кнопку или клавишу P, чтобы продолжить";
      overlayBtn.textContent = "Старт";
    } else if (snap.status === "over") {
      overlayKicker.textContent = "конец";
      overlayTitle.textContent = "Игра окончена";
      overlayText.textContent = "Счёт " + scoreText;
      overlayBtn.textContent = "Заново";
    } else if (snap.status === "ready") {
      overlayKicker.textContent = "10×20";
      overlayTitle.textContent = "Тетрис";
      overlayText.textContent = "Стрелки двигают фигуру, ↑ поворачивает, пробел сбрасывает вниз";
      overlayBtn.textContent = "Старт";
    }

    const glow = COLORS[(snap.piece && snap.piece.type) || snap.next] || "#6ea8ff";
    document.documentElement.style.setProperty("--glow", glow);
    hudSig = sig;
    return hudSig;
  }

  function paint() {
    const snap = game.snapshot();
    drawBoard(snap);
    drawNext(snap);
    syncHud(snap);
  }

  overlayBtn.addEventListener("click", () => {
    const status = game.snapshot().status;
    if (status === "over") game.restart();
    else game.start();
    overlayBtn.blur();
    paint();
  });

  document.querySelectorAll("[data-tap='pause']").forEach((btn) => {
    btn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      game.togglePause();
      paint();
    });
  });

  document.querySelectorAll("[data-tap='rotate']").forEach((btn) => {
    btn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      game.rotate(1);
      paint();
    });
  });

  document.querySelectorAll("[data-tap='hard']").forEach((btn) => {
    btn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      game.hardDrop();
      paint();
    });
  });

  document.querySelectorAll("[data-hold]").forEach((btn) => {
    const name = btn.getAttribute("data-hold");
    const startHold = (event) => {
      event.preventDefault();
      btn.setPointerCapture(event.pointerId);
      game.setHeld(name, true);
      paint();
    };
    const endHold = () => game.setHeld(name, false);
    btn.addEventListener("pointerdown", startHold);
    btn.addEventListener("pointerup", endHold);
    btn.addEventListener("pointercancel", endHold);
    btn.addEventListener("lostpointercapture", endHold);
  });

  const HELD_CODES = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowDown: "soft",
  };

  document.addEventListener("keydown", (event) => {
    const code = event.code;
    const tracked = HELD_CODES[code] || code === "ArrowUp" || code === "Space" || code === "KeyP" || code === "Escape" || code === "KeyZ" || code === "Enter";
    if (!tracked) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();

    if (HELD_CODES[code]) {
      game.setHeld(HELD_CODES[code], true);
      return;
    }

    const status = game.snapshot().status;
    if (code === "KeyP" || code === "Escape") {
      if (status === "playing" || status === "paused") game.togglePause();
      return;
    }
    if (status === "ready" && (code === "Space" || code === "Enter")) {
      game.start();
      return;
    }
    if (status === "paused" && (code === "Space" || code === "Enter")) {
      game.start();
      return;
    }
    if (status === "over" && !event.repeat && (code === "Space" || code === "Enter")) {
      game.restart();
      return;
    }
    if (status !== "playing" || event.repeat) return;
    if (code === "ArrowUp") game.rotate(1);
    else if (code === "KeyZ") game.rotate(-1);
    else if (code === "Space") game.hardDrop();
  }, true);

  document.addEventListener("keyup", (event) => {
    const name = HELD_CODES[event.code];
    if (!name) return;
    event.preventDefault();
    game.setHeld(name, false);
  }, true);

  window.addEventListener("blur", () => {
    game.setHeld("left", false);
    game.setHeld("right", false);
    game.setHeld("soft", false);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.snapshot().status === "playing") game.togglePause();
  });

  window.addEventListener("resize", () => {
    layout();
    paint();
  });

  layout();
  paint();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(100, now - last);
    last = now;
    game.tick(dt);
    paint();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
