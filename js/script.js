let x = 150, y = 150, dx = 2, dy = 4, r = 10;
let W, H, ctx, id;
let px, ph = 10, pw = 100;
let right = false, left = false;
let bricks, rows = 5, cols = 7, bw, bh = 10, pad = 2;
let sec = 0, time = "00:00", score = 0;
let paddlecolor = "#000", ballcolor = "red";
let frame = 0;

function drawCircle(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawRect(x, y, w, h) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
}

function clear() {
  ctx.clearRect(0, 0, W, H);
}

function drawIt() {
  const canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");
  W = canvas.width;
  H = canvas.height;

  px = (W - pw) / 2;
  bw = W / cols - 1;

  bricks = Array.from({ length: rows }, () => Array(cols).fill(1));

  $("#tocke").text(score);
  $("#cas").text(time);

  if (id) clearInterval(id);
  id = setInterval(draw, 10);
}

$(document).on("keydown keyup", e => {
  const down = e.type === "keydown";
  if (e.key === "ArrowRight") right = down;
  if (e.key === "ArrowLeft") left = down;
});

function draw() {
  clear();

  // ball
  ctx.fillStyle = ballcolor;
  drawCircle(x, y, r);

  // paddle move
  if (right) px = Math.min(W - pw, px + 5);
  if (left) px = Math.max(0, px - 5);

  // paddle
  ctx.fillStyle = paddlecolor;
  drawRect(px, H - ph, pw, ph);

  // bricks
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (bricks[i][j] > 0) {
        ctx.fillStyle =
          bricks[i][j] === 2 ? "blue" :
          bricks[i][j] === 1 ? "purple" :
          "yellow";

        drawRect(
          j * (bw + pad) + pad,
          i * (bh + pad) + pad,
          bw,
          bh
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
    bricks[row][col]--;
    score++;
    $("#tocke").text(score);
  }

  // wall collision
  if (x + dx > W - r || x + dx < r) dx = -dx;
  if (y + dy < r) {
    dy = -dy;
  } else if (y + dy > H - ph - r) {
    // paddle collision
    if (x > px && x < px + pw) {//za odboj od ploscka
      dy = -dy;
	  dx=8*((x-(px+pw/2))/pw);
	  start=true;
    } else if (y + dy > H - r+8) {
      clearInterval(id);
      alert("Game over");
      return;
    }
  }

  x += dx;
  y += dy;

  // timer: 100 frames ~= 1 second
  frame++;
  if (frame % 100 === 0) {
    sec++;
    const s = String(sec % 60).padStart(2, "0");
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    time = `${m}:${s}`;
    $("#cas").text(time);
  }
}

$(drawIt);