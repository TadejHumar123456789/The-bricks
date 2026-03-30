(() => {
  "use strict";

  // ----------------------------
  // Grab DOM elements
  // ----------------------------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d"); // may be null if unsupported

  const timeValue = document.getElementById("timeValue");
  const scoreValue = document.getElementById("scoreValue");
  const bestValue = document.getElementById("bestValue");
  const comboValue = document.getElementById("comboValue");
  const levelValue = document.getElementById("levelValue");

  const statusEl = document.getElementById("status");
  const btnStart = document.getElementById("btnStart");
  const btnPause = document.getElementById("btnPause");
  const btnReset = document.getElementById("btnReset");
  const durationInput = document.getElementById("durationInput");

  if (!ctx) {
    // If someone runs this in a browser without canvas support,
    // show an error in plain HTML.
    statusEl.textContent = "Canvas 2D context is not supported in this browser.";
    return;
  }

  // ----------------------------
  // Configuration (easy student tuning)
  // ----------------------------
  const STORAGE_KEY_BEST = "brickBreaker.bestScore.v1";

  const CONFIG = {
    aspectRatio: 4 / 3,          // width / height
    maxCanvasCssWidth: 900,      // cap size on big screens

    baseBrickPoints: 10,
    comboCap: 5,                 // max multiplier = 5x
    speedBonusStep: 120,         // +1 point per this many px/s over base speed

    maxDt: 0.05,                 // clamp dt to reduce physics glitches on tab-switch
    messageFont: "600 22px system-ui",
    hudFont: "500 14px system-ui",
  };

  // World size in CSS pixels (we scale the real canvas using devicePixelRatio).
  const world = { w: 800, h: 600, dpr: 1 };

  // ----------------------------
  // Game state
  // ----------------------------
  const state = {
    mode: "idle",                // "idle" | "running" | "paused" | "gameover"
    score: 0,
    best: 0,
    timeLeft: 0,
    level: 1,
    comboStreak: 0,              // bricks hit since last paddle hit
    bricksLeft: 0,
  };

  // Entities
  const paddle = { x: 0, y: 0, w: 0, h: 0, speed: 0 };
  const ball = { x: 0, y: 0, r: 0, vx: 0, vy: 0, stuck: true };

  // Bricks: array of objects { row, col, x, y, w, h, alive, color }
  let bricks = [];

  // Input state
  const input = {
    left: false,
    right: false,
    pointerActive: false,
    pointerId: null,
    pointerX: 0, // in world coordinates
  };

  // Settings controlled by the HTML input
  const settings = {
    durationSec: clampInt(parseInt(durationInput.value, 10), 10, 600),
  };

  // Animation timing
  let lastTimestamp = performance.now();

  // ----------------------------
  // Storage: load best score safely
  // ----------------------------
  const storageOK = storageAvailable();
  state.best = storageOK ? readBestScore() : 0;
  bestValue.textContent = String(state.best);

  // ----------------------------
  // Initialization
  // ----------------------------
  resizeCanvas();     // sets world size + scales canvas for HiDPI
  resetGame("idle");  // build bricks, reset score/timer, place paddle/ball
  updateHud();

  // ----------------------------
  // Event listeners (controls)
  // ----------------------------
  btnStart.addEventListener("click", () => {
    canvas.focus();
    startOrResume();
  });

  btnPause.addEventListener("click", () => {
    canvas.focus();
    togglePause();
  });

  btnReset.addEventListener("click", () => {
    canvas.focus();
    resetGame("idle");
  });

  durationInput.addEventListener("change", () => {
    // For simplicity: only allow changing duration when not running.
    if (state.mode === "running") {
      status(`Pause or reset before changing duration.`);
      durationInput.value = String(settings.durationSec);
      return;
    }
    settings.durationSec = clampInt(parseInt(durationInput.value, 10), 10, 600);
    durationInput.value = String(settings.durationSec);
    resetGame("idle");
  });

  // Keyboard controls
  window.addEventListener("keydown", (e) => {
    if (shouldIgnoreKeys(e)) return;

    const k = e.key; // layout-aware key value

    if (k === "ArrowLeft" || k === "a" || k === "A") {
      input.left = true;
      e.preventDefault();
    } else if (k === "ArrowRight" || k === "d" || k === "D") {
      input.right = true;
      e.preventDefault();
    } else if (k === " " || k === "Spacebar") {
      // Space toggles start/pause behavior
      if (state.mode === "running") togglePause();
      else startOrResume();
      e.preventDefault();
    } else if (k === "p" || k === "P" || k === "Escape") {
      togglePause();
      e.preventDefault();
    } else if (k === "r" || k === "R") {
      resetGame("idle");
      e.preventDefault();
    }
  });

  window.addEventListener("keyup", (e) => {
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") input.left = false;
    if (k === "ArrowRight" || k === "d" || k === "D") input.right = false;
  });

  // Pointer controls (mouse, touch, pen) on canvas: drag to move paddle.
  canvas.addEventListener("pointerdown", (e) => {
    canvas.focus();
    input.pointerActive = true;
    input.pointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    input.pointerX = pointerXInWorld(e);
    movePaddleTo(input.pointerX);

    // Nice UX: first tap can start the game
    if (state.mode === "idle") startOrResume();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!input.pointerActive) return;
    if (input.pointerId !== e.pointerId) return;
    input.pointerX = pointerXInWorld(e);
    movePaddleTo(input.pointerX);
  });

  canvas.addEventListener("pointerup", (e) => {
    if (input.pointerId === e.pointerId) {
      input.pointerActive = false;
      input.pointerId = null;
    }
  });

  canvas.addEventListener("pointercancel", () => {
    input.pointerActive = false;
    input.pointerId = null;
  });

  // Responsive canvas sizing
  window.addEventListener("resize", () => {
    // Keep gameplay stable: pause on resize so things don't feel “jumpy”.
    if (state.mode === "running") {
      state.mode = "paused";
      status("Paused (window resized).");
    }
    resizeCanvas();
    // Re-layout bricks/paddle/ball for the new size without destroying progress.
    relayoutAfterResize();
  });

  // Pause if the tab is hidden (prevents timer from silently running down)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.mode === "running") {
      state.mode = "paused";
      status("Paused (tab not visible).");
    }
  });

  // ----------------------------
  // Main loop (requestAnimationFrame)
  // ----------------------------
  requestAnimationFrame(frame);

  function frame(ts) {
    const dt = Math.min(CONFIG.maxDt, (ts - lastTimestamp) / 1000);
    lastTimestamp = ts;

    if (state.mode === "running") {
      update(dt);
    }

    render();
    requestAnimationFrame(frame);
  }

  // ----------------------------
  // Game control functions
  // ----------------------------
  function startOrResume() {
    if (state.mode === "gameover") {
      resetGame("running");
      serveBall();
      return;
    }

    if (state.mode === "idle") {
      state.mode = "running";
      status("");
      serveBall();        // release ball from paddle
      lastTimestamp = performance.now();
      return;
    }

    if (state.mode === "paused") {
      state.mode = "running";
      status("");
      lastTimestamp = performance.now();
      return;
    }
  }

  function togglePause() {
    if (state.mode === "running") {
      state.mode = "paused";
      status("Paused.");
    } else if (state.mode === "paused") {
      state.mode = "running";
      status("");
      lastTimestamp = performance.now();
    }
  }

  function resetGame(modeAfterReset) {
    state.mode = modeAfterReset;
    state.score = 0;
    state.comboStreak = 0;
    state.level = 1;

    settings.durationSec = clampInt(parseInt(durationInput.value, 10), 10, 600);
    state.timeLeft = settings.durationSec;

    buildLevel(state.level);
    relayoutAfterResize(); // sizes + positions depend on world.w/world.h

    ball.stuck = true;     // ball sits on paddle until serveBall()
    updateHud();

    status(modeAfterReset === "running" ? "" : "Ready. Press Start or Space.");
  }

  function gameOver(message) {
    state.mode = "gameover";
    status(message);

    // Update best score and persist it
    if (state.score > state.best) {
      state.best = state.score;
      bestValue.textContent = String(state.best);
      if (storageOK) writeBestScore(state.best);
    }
  }

  // ----------------------------
  // Update step (physics, timer, collisions)
  // ----------------------------
  function update(dt) {
    // 1) Timer
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.timeLeft <= 0) {
      gameOver("Time's up! Press Start to play again.");
      return;
    }

    // 2) Paddle movement
    applyKeyboardToPaddle(dt);

    // 3) Ball movement
    if (ball.stuck) {
      // Keep ball on paddle before serve, or after a miss.
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 1;
    } else {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      collideWithWalls();
      collideWithPaddle();
      collideWithBricks();

      // Missed the paddle (ball fell below screen)
      if (ball.y - ball.r > world.h) {
        ball.stuck = true;
        state.comboStreak = 0;
        status("Miss! Ball reset to paddle.");
      }
    }

    // 4) Level cleared?
if (state.bricksLeft <= 0) {
  const savedSpeed = ballSpeed();

  state.level += 1;
  buildLevel(state.level);
  relayoutAfterResize();
  state.comboStreak = 0;
  status(`Level ${state.level}!`);

  // Reset ball position but keep previous speed
  ball.stuck = false;
  ball.x = paddle.x + paddle.w / 2;
  ball.y = paddle.y - ball.r - 1;

  const dir = ball.vx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(ball.vx);
  ball.vx = dir * savedSpeed * 0.35;
  ball.vy = -Math.sqrt(Math.max(0, savedSpeed * savedSpeed - ball.vx * ball.vx));
}

    updateHud();
  }

  // ----------------------------
  // Collision helpers
  // ----------------------------
  function collideWithWalls() {
    // Left wall
    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
    }
    // Right wall
    if (ball.x + ball.r > world.w) {
      ball.x = world.w - ball.r;
      ball.vx = -Math.abs(ball.vx);
    }
    // Top wall
    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
    }
  }

  function collideWithPaddle() {
    // Only bounce if moving downward
    if (ball.vy <= 0) return;

    const hit = circleRectHit(ball, paddle);
    if (!hit) return;

    // Place ball just above paddle to prevent "sticky" collision
    ball.y = paddle.y - ball.r - 0.5;

    // Compute bounce angle based on where we hit the paddle:
    // -1 (far left) .. 0 (center) .. +1 (far right)
    const paddleCenter = paddle.x + paddle.w / 2;
    const t = clamp((ball.x - paddleCenter) / (paddle.w / 2), -1, 1);

    // Max bounce angle from straight up (radians)
    const maxAngle = (65 * Math.PI) / 180;
    const angle = t * maxAngle;

    // Increase speed slightly on each paddle hit (difficulty ramp)
    const newSpeed = Math.min(maxBallSpeed(), ballSpeed() + speedGainOnPaddle());
    ball.vx = newSpeed * Math.sin(angle);
    ball.vy = -newSpeed * Math.cos(angle);

    // Combo ends when you touch the paddle
    state.comboStreak = 0;
  }

  function collideWithBricks() {
    for (const b of bricks) {
      if (!b.alive) continue;

      const hit = circleRectHit(ball, b);
      if (!hit) continue;

      // Remove brick
      b.alive = false;
      state.bricksLeft -= 1;

      // Scoring: base * comboMultiplier + small speed bonus
      state.comboStreak += 1;
      state.score += pointsForBrickHit();

      // Bounce: decide axis based on where the circle overlaps the rect
      reflectBallFromRect(b);

      // One brick per frame (simplifies logic for beginners)
      break;
    }
  }

  function reflectBallFromRect(rect) {
    // Nearest point on rect to ball center
    const nx = clamp(ball.x, rect.x, rect.x + rect.w);
    const ny = clamp(ball.y, rect.y, rect.y + rect.h);
    const dx = ball.x - nx;
    const dy = ball.y - ny;

    // If dx is "more significant", treat as side hit; else top/bottom hit.
    if (Math.abs(dx) > Math.abs(dy)) {
      ball.vx *= -1;
      // Move ball outside rect horizontally
      ball.x = dx < 0 ? rect.x - ball.r - 0.5 : rect.x + rect.w + ball.r + 0.5;
    } else {
      ball.vy *= -1;
      // Move ball outside rect vertically
      ball.y = dy < 0 ? rect.y - ball.r - 0.5 : rect.y + rect.h + ball.r + 0.5;
    }
  }

  function circleRectHit(c, r) {
    // Clamp circle center to the rectangle to find nearest point
    const nearestX = clamp(c.x, r.x, r.x + r.w);
    const nearestY = clamp(c.y, r.y, r.y + r.h);
    const dx = c.x - nearestX;
    const dy = c.y - nearestY;
    return dx * dx + dy * dy <= c.r * c.r;
  }

  // ----------------------------
  // Scoring
  // ----------------------------
  function pointsForBrickHit() {
    // comboStreak = 1 => multiplier 1
    // comboStreak = 2 => multiplier 2
    // ...
    const multiplier = clampInt(state.comboStreak, 1, CONFIG.comboCap);

    const bonus = Math.max(
      0,
      Math.floor((ballSpeed() - baseBallSpeed()) / CONFIG.speedBonusStep)
    );

    return CONFIG.baseBrickPoints * multiplier + bonus;
  }

  // ----------------------------
  // Rendering
  // ----------------------------
  function render() {
    // Clear
    ctx.clearRect(0, 0, world.w, world.h);

    // Background
    ctx.fillStyle = "#070b17";
    ctx.fillRect(0, 0, world.w, world.h);

    // Bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Simple outline
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }

    // Paddle
    ctx.fillStyle = "#e7eefc";
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

    // Ball
    ctx.fillStyle = "#ff7a18";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    // Overlay messages
    if (state.mode === "idle") {
      drawCenterMessage("Press Start / Space");
    } else if (state.mode === "paused") {
      drawCenterMessage("Paused");
    } else if (state.mode === "gameover") {
      drawCenterMessage("Game Over");
    }

    // Small HUD inside canvas (optional visual reinforcement)
    ctx.font = CONFIG.hudFont;
    ctx.fillStyle = "rgba(231,238,252,0.85)";
    ctx.fillText(`Time: ${state.timeLeft.toFixed(1)}s`, 12, 20);
    ctx.fillText(`Score: ${state.score}`, 12, 40);
  }

  function drawCenterMessage(text) {
    ctx.save();
    ctx.font = CONFIG.messageFont;
    ctx.fillStyle = "rgba(231,238,252,0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, world.w / 2, world.h / 2);
    ctx.restore();
  }

  // ----------------------------
  // Level + layout helpers
  // ----------------------------
  function buildLevel(level) {
    // Difficulty scaling (simple + explainable):
    // - more rows up to a cap
    // - slightly smaller paddle (computed in relayout)
    const rows = clampInt(5 + (level - 1), 5, 9);
    const cols = 9;

    bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        bricks.push({
          row: r,
          col: c,
          x: 0, y: 0, w: 0, h: 0,
          alive: true,
          color: brickColor(r),
        });
      }
    }
    state.bricksLeft = bricks.length;
  }

  function relayoutAfterResize() {
    // Paddle size scales with screen width; it gets smaller as level increases.
    const paddleWidthFrac = clamp(0.24 - (state.level - 1) * 0.015, 0.14, 0.24);

    paddle.w = Math.round(world.w * paddleWidthFrac);
    paddle.h = Math.max(10, Math.round(world.h * 0.03));
    paddle.y = world.h - paddle.h - Math.round(world.h * 0.04);
    paddle.speed = world.w * 1.6;

    // Keep paddle in bounds if resizing happened
    paddle.x = clamp(paddle.x, 0, world.w - paddle.w);

    // Ball size scales with world size
    ball.r = Math.max(6, Math.round(Math.min(world.w, world.h) * 0.012));

    // If ball is stuck, it'll auto-follow the paddle in update().
    // If it's not stuck, keep it within bounds.
    ball.x = clamp(ball.x, ball.r, world.w - ball.r);
    ball.y = clamp(ball.y, ball.r, world.h - ball.r);

    layoutBricks();
  }

  function layoutBricks() {
    // Brick layout in the top portion of the screen
    const topMargin = Math.round(world.h * 0.10);
    const sideMargin = Math.round(world.w * 0.06);
    const gap = Math.max(4, Math.round(world.w * 0.01));

    const maxRows = Math.max(...bricks.map(b => b.row)) + 1;
    const cols = Math.max(...bricks.map(b => b.col)) + 1;

    const totalGapW = gap * (cols - 1);
    const brickW = Math.floor((world.w - 2 * sideMargin - totalGapW) / cols);
    const brickH = Math.max(12, Math.round(world.h * 0.035));

    for (const b of bricks) {
      b.w = brickW;
      b.h = brickH;
      b.x = sideMargin + b.col * (brickW + gap);
      b.y = topMargin + b.row * (brickH + gap);
    }

    // If paddle never positioned (fresh reset), center it
    if (paddle.x === 0) {
      paddle.x = (world.w - paddle.w) / 2;
    }

    // Place ball on paddle for idle state
    if (state.mode === "idle" || ball.stuck) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 1;
    }
  }

  function serveBall() {
    ball.stuck = false;

    // Start direction: mostly upward, a little left/right
    const speed = baseBallSpeed();
    const dir = Math.random() < 0.5 ? -1 : 1;
    ball.vx = dir * speed * 0.35;
    ball.vy = -speed * 0.94;
  }

  // ----------------------------
  // Input helpers
  // ----------------------------
  function applyKeyboardToPaddle(dt) {
    // If a pointer drag is active, we already move paddle directly in pointermove.
    if (input.pointerActive) return;

    let vx = 0;
    if (input.left) vx -= paddle.speed;
    if (input.right) vx += paddle.speed;

    paddle.x += vx * dt;
    paddle.x = clamp(paddle.x, 0, world.w - paddle.w);
  }

  function movePaddleTo(xCenter) {
    paddle.x = clamp(xCenter - paddle.w / 2, 0, world.w - paddle.w);
  }

  function pointerXInWorld(e) {
    // Convert pointer coords (in CSS pixels) into game coords.
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (world.w / rect.width);
    return clamp(x, 0, world.w);
  }

  function shouldIgnoreKeys(e) {
    const el = e.target;
    if (!el) return false;
    const tag = el.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      el.isContentEditable
    );
  }

  // ----------------------------
  // Canvas sizing (HiDPI scaling)
  // ----------------------------
  function resizeCanvas() {
    // Use devicePixelRatio to render sharply on high DPI screens.
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    world.dpr = dpr;

    // Canvas CSS size (responsive)
    const cssWidth = Math.min(CONFIG.maxCanvasCssWidth, canvas.parentElement.clientWidth);
    const cssHeight = Math.round(cssWidth / CONFIG.aspectRatio);

    world.w = Math.max(280, Math.floor(cssWidth));
    world.h = Math.max(210, Math.floor(cssHeight));

    // Set CSS size (layout)
    canvas.style.width = `${world.w}px`;
    canvas.style.height = `${world.h}px`;

    // Set internal pixel buffer size (sharpness)
    canvas.width = Math.floor(world.w * dpr);
    canvas.height = Math.floor(world.h * dpr);

    // Make drawing coordinates use CSS pixels (0..world.w, 0..world.h)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ----------------------------
  // HUD + status text
  // ----------------------------
  function updateHud() {
    timeValue.textContent = `${state.timeLeft.toFixed(1)}s`;
    scoreValue.textContent = String(state.score);
    comboValue.textContent = String(state.comboStreak);
    levelValue.textContent = String(state.level);
  }

  function status(msg) {
    statusEl.textContent = msg;
  }

  // ----------------------------
  // Speeds scale with screen size so mobile feels similar to desktop
  // ----------------------------
function baseBallSpeed() {
  return world.h * 0.70;
}

  function maxBallSpeed() {
    return world.h * 1.35;
  }

  function speedGainOnPaddle() {
    return world.h * 0.03;
  }

  function ballSpeed() {
    return Math.hypot(ball.vx, ball.vy);
  }

  // ----------------------------
  // Storage helpers (safe localStorage usage)
  // ----------------------------
  function storageAvailable() {
    try {
      const testKey = "__storage_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  function readBestScore() {
    const raw = window.localStorage.getItem(STORAGE_KEY_BEST);
    const n = parseInt(raw ?? "0", 10);
    return Number.isFinite(n) ? n : 0;
  }

  function writeBestScore(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY_BEST, String(value));
    } catch {
      // If storage is blocked (privacy settings), ignore silently.
    }
  }

  // ----------------------------
  // Utility functions
  // ----------------------------
  function clamp(x, min, max) { return Math.max(min, Math.min(max, x)); }

  function clampInt(x, min, max) {
    const n = Number.isFinite(x) ? Math.trunc(x) : min;
    return Math.max(min, Math.min(max, n));
  }

  function brickColor(row) {
    // Simple gradient-ish palette by row
    const palette = ["#5eead4", "#93c5fd", "#c4b5fd", "#f9a8d4", "#fdba74", "#fca5a5", "#bef264", "#67e8f9", "#a7f3d0"];
    return palette[row % palette.length];
  }
})();
