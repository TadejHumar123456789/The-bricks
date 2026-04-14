let x = 150, y = 150, dx = 2, dy = -4, r = 10;
let W, H, ctx, id = null;
let px, ph = 20, pw = 100;
let right = false, left = false;

let bricks, rows = 5, cols = 7, bw, bh = 20, pad = 2;

let sec = 0, time = "00:00", score = 0;
let frame = 0;
let gameStarted = false;
let level = 1;

const nextLevelZone = {
  x: 0,
  y: 0,
  w: 120,
  h: 50
};
// images
const ballImg = new Image();
ballImg.src = "./img/ball.png";

const paddleImg = new Image();
paddleImg.src = "./img/paddle.png";

const brickImg = new Image();
brickImg.src = "./img/bricks.png";

const brickStrongImg = new Image();
brickStrongImg.src = "./img/bricks1.png";

// wait until all images load
let loadedImages = 0;
function imageLoaded() {
  loadedImages++;
  if (loadedImages === 4) {
    initGame();
  }
}

ballImg.onload = imageLoaded;
paddleImg.onload = imageLoaded;
brickImg.onload = imageLoaded;
brickStrongImg.onload = imageLoaded;

function drawBall() {
  ctx.drawImage(ballImg, x - r, y - r, r * 2, r * 2);
}

function drawPaddle() {
  ctx.drawImage(paddleImg, px, H - ph, pw, ph);
}

function drawBrick(x, y, w, h, hp) {
  if (hp >= 2) {
    ctx.drawImage(brickStrongImg, x, y, w, h);
  } else {
    ctx.drawImage(brickImg, x, y, w, h);
  }
}

function clear() {
  ctx.clearRect(0, 0, W, H);
}

function createLevel(levelNum) {
  const map = [];

  for (let i = 0; i < rows; i++) {
    map[i] = [];
    for (let j = 0; j < cols; j++) {
      // default normal brick
      map[i][j] = 1;
    }
  }

  // level designs
  if (levelNum === 1) {
    // only normal bricks
    return map;
  }

  if (levelNum === 2) {
    // top 2 rows are stronger
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < cols; j++) {
        map[i][j] = 2; // stronger brick, 2 hp
      }
    }
    return map;
  }

  if (levelNum === 3) {
    // checker pattern of strong bricks
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        map[i][j] = (i + j) % 2 === 0 ? 2 : 1;
      }
    }
    return map;
  }

  // from level 4 onward: more strong bricks
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (i < 3 || (i + j) % 2 === 0) {
        map[i][j] = 2;
      } else {
        map[i][j] = 1;
      }
    }
  }

  return map;
}
function isInsideNextLevelZone(mx, my) {
  return (
    mx >= nextLevelZone.x &&
    mx <= nextLevelZone.x + nextLevelZone.w &&
    my >= nextLevelZone.y &&
    my <= nextLevelZone.y + nextLevelZone.h
  );
}

function resetBallAndPaddle() {
  px = (W - pw) / 2;
  x = px + pw / 2;
  y = H - ph - r - 2;

  dx = 2 + Math.min(level - 1, 3); // faster on higher levels
  dy = -(4 + Math.min(level - 1, 3));
}

function initGame() {
  const canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");
  W = canvas.width;
  H = canvas.height;

  bw = W / cols - 1;

  level = 1;
  sec = 0;
  frame = 0;
  score = 0;
  time = "00:00";
  gameStarted = false;

  bricks = createLevel(level);
  resetBallAndPaddle();

  $("#tocke").text(score);
  $("#cas").text(time);
  $("#lvl").text(level);

  drawScene();
}

function loadNextLevel() {
  level++;
  bricks = createLevel(level);
  gameStarted = false;
  resetBallAndPaddle();
  $("#lvl").text(level);
  drawScene();
}

function drawScene() {
  clear();

  drawPaddle();

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (bricks[i][j] > 0) {
        drawBrick(
          j * (bw + pad) + pad,
          i * (bh + pad) + pad,
          bw,
          bh,
          bricks[i][j]
        );
      }
    }
  }

  drawBall();
}

function startGame() {
  if (!gameStarted) {
    gameStarted = true;
  }

  if (!id) {
    id = setInterval(draw, 10);
  }
}

function pauseGame() {
  if (id) {
    clearInterval(id);
    id = null;
  }
}

function resetGame() {
  pauseGame();
  initGame();
}

function remainingBricks() {
  let count = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (bricks[i][j] > 0) count++;
    }
  }
  return count;
}

$(document).on("keydown keyup", function (e) {
  const down = e.type === "keydown";

  if (e.key === "d" || e.key === "D") right = down;
  if (e.key === "a" || e.key === "A") left = down;
});

function draw() {
  if (right) px = Math.min(W - pw, px + 5);
  if (left) px = Math.max(0, px - 5);

  // before game starts, keep ball on paddle
  if (!gameStarted) {
    x = px + pw / 2;
    y = H - ph - r - 2;
    drawScene();
    return;
  }

  clear();

  drawBall();
  drawPaddle();

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (bricks[i][j] > 0) {
        drawBrick(
          j * (bw + pad) + pad,
          i * (bh + pad) + pad,
          bw,
          bh,
          bricks[i][j]
        );
      }
    }
  }

  // brick collision
  const rh = bh + pad;
  const cw = bw + pad;
  const row = Math.floor(y / rh);
  const col = Math.floor(x / cw);

  if (
    y < rows * rh &&
    row >= 0 &&
    col >= 0 &&
    col < cols &&
    bricks[row]?.[col] > 0
  ) {
    dy = -dy;

    bricks[row][col]--; // strong bricks need more hits
    score++;
    $("#tocke").text(score);

    if (remainingBricks() === 0) {
      loadNextLevel();
      return;
    }
  }

  // wall collision
  if (x + dx > W - r || x + dx < r) dx = -dx;

  if (y + dy < r) {
    dy = -dy;
  } else if (y + dy > H - ph - r) {
    if (x > px && x < px + pw) {
      dy = -dy;
      dx = 8 * ((x - (px + pw / 2)) / pw);
    } else if (y + dy > H - r + 8) {
      pauseGame();
      alert("Game Over!");
      return;
    }
  }

  x += dx;
  y += dy;

  frame++;
  if (frame % 100 === 0) {
    sec++;
    const s = String(sec % 60).padStart(2, "0");
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    time = `${m}:${s}`;
    $("#cas").text(time);
  }
}

$(function () {
  $("#start").on("click", startGame);
  $("#pause").on("click", pauseGame);
  $("#reset").on("click", resetGame);

  $("#canvas").on("click", function (e) {
    const rect = this.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isInsideNextLevelZone(mx, my)) {
      loadNextLevel();
    }
  });
});