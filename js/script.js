var x = 150;
var y = 200;
var dx = 0;
var dy = 4;
var WIDTH;
var HEIGHT;
var r = 12;
var ctx;
var intervalId = null;
var timerId = null;
var level = 1;

var ballImg = new Image();
var paddleImg = new Image();
var brick1Img = new Image();
var brick2Img = new Image();

var imagesLoaded = 0;
var totalImages = 4;
var assetsReady = false;

var start = false;
var gameRunning = false;
var gameWon = false;

var tocke = 0;
var sekunde = 0;
var izpisTimer = "00:00";

var paddlex;
var paddleh;
var paddlew;

var rightDown = false;
var leftDown = false;

var bricks;
var NROWS;
var NCOLS;
var BRICKWIDTH;
var BRICKHEIGHT;
var PADDING;

function updateLevelDisplay() {
    $("#level").html(level);
}

function updateScoreDisplay() {
    $("#tocke").html(tocke);
}

function updateTimerDisplay() {
    $("#cas").html(izpisTimer);
}

function resetBall() {
    x = WIDTH / 2;
    y = HEIGHT - 25;
    dx = 0;
    dy = -4;
}

function imageLoaded() {
    imagesLoaded++;

    if (imagesLoaded === totalImages) {
        assetsReady = true;

        init_paddle();
        initbricks();
        resetBall();

        sekunde = 0;
        izpisTimer = "00:00";
        tocke = 0;

        updateLevelDisplay();
        updateTimerDisplay();
        updateScoreDisplay();

        draw();
    }
}

function imageError(e) {
    console.error("Napaka pri nalaganju slike:", e.target.src);
}

function init() {
    ctx = $("#canvas")[0].getContext("2d");
    WIDTH = $("#canvas")[0].width;
    HEIGHT = $("#canvas")[0].height;

    $(document).keydown(onKeyDown);
    $(document).keyup(onKeyUp);

    ballImg.onload = imageLoaded;
    paddleImg.onload = imageLoaded;
    brick1Img.onload = imageLoaded;
    brick2Img.onload = imageLoaded;

    ballImg.onerror = imageError;
    paddleImg.onerror = imageError;
    brick1Img.onerror = imageError;
    brick2Img.onerror = imageError;

    ballImg.src = "./img/ball.png";
    paddleImg.src = "./img/paddle.png";
    brick1Img.src = "./img/bricks.png";
    brick2Img.src = "./img/bricks1.png";

    drawLoadingScreen();
}

function drawLoadingScreen() {
    clear();
    ctx.font = "24px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillStyle = "#0f172a";
    ctx.fillText("Loading images...", WIDTH / 2, HEIGHT / 2);
}

function init_paddle() {
    paddlex = WIDTH / 2 - 75;
    paddleh = 20;
	paddlew = 150;
    
}

function initbricks() {
    if (level == 1) {
        NROWS = 3;
        NCOLS = 4;
    } else if (level == 2) {
        NROWS = 5;
        NCOLS = 6;
    } else if (level == 3) {
        NROWS = 5;
        NCOLS = 10;
    } else {
        NROWS = 2;
        NCOLS = 2;
    }

    BRICKWIDTH = (WIDTH / NCOLS) - 2;
    BRICKHEIGHT = 30;
    PADDING = 2;

    bricks = new Array(NROWS);

    for (var i = 0; i < NROWS; i++) {
        bricks[i] = new Array(NCOLS);
        for (var j = 0; j < NCOLS; j++) {
            bricks[i][j] = Math.floor(Math.random() * 2) + 1;
        }
    }
}

function clear() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
}

function allBricksDestroyed() {
    for (var i = 0; i < NROWS; i++) {
        for (var j = 0; j < NCOLS; j++) {
            if (bricks[i][j] > 0) {
                return false;
            }
        }
    }
    return true;
}

function timer() {
    if (!gameRunning) return;

    sekunde++;
    var sekundeI = sekunde % 60;
    var minuteI = Math.floor(sekunde / 60);

    sekundeI = sekundeI > 9 ? sekundeI : "0" + sekundeI;
    minuteI = minuteI > 9 ? minuteI : "0" + minuteI;

    izpisTimer = minuteI + ":" + sekundeI;
    updateTimerDisplay();
}

function onKeyDown(evt) {
    if (evt.key === "ArrowRight" || evt.key === "d" || evt.key === "D") {
        rightDown = true;
    } else if (evt.key === "ArrowLeft" || evt.key === "a" || evt.key === "A") {
        leftDown = true;
    }
}

function onKeyUp(evt) {
    if (evt.key === "ArrowRight" || evt.key === "d" || evt.key === "D") {
        rightDown = false;
    } else if (evt.key === "ArrowLeft" || evt.key === "a" || evt.key === "A") {
        leftDown = false;
    }
}

function preveriZmago() {
    if (!gameWon && allBricksDestroyed()) {
        gameWon = true;
        stopGameLoops();

        Swal.fire({
            title: "Bravo!",
            text: "Končal si level " + level,
            icon: "success",
            confirmButtonText: "Naprej"
        }).then(function () {
            level++;
            gameWon = false;
            init_paddle();
            initbricks();
            resetBall();
            start = false;
            draw();
        });
    }
}

function stopGameLoops() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
    gameRunning = false;
}

function startGame() {
    if (!assetsReady) return;
    if (gameRunning) return;

    if (!intervalId) {
        intervalId = setInterval(draw, 10);
    }
    if (!timerId) {
        timerId = setInterval(timer, 1000);
    }

    if (dx === 0) {
        dx = 3;
    }

    dy = -4;
    start = true;
    gameRunning = true;
}

function resetGame() {
    if (!assetsReady) return;

    stopGameLoops();

    level = 1;
    sekunde = 0;
    izpisTimer = "00:00";
    tocke = 0;
    start = false;
    gameWon = false;
    rightDown = false;
    leftDown = false;

    init_paddle();
    initbricks();
    resetBall();

    updateLevelDisplay();
    updateTimerDisplay();
    updateScoreDisplay();

    draw();
}

function drawBall() {
    ctx.drawImage(ballImg, x - r, y - r, r * 2, r * 2);
}

function drawPaddle() {
    ctx.drawImage(paddleImg, paddlex, HEIGHT - paddleh, paddlew, paddleh);
}

function drawBricks() {
    for (var i = 0; i < NROWS; i++) {
        for (var j = 0; j < NCOLS; j++) {
            if (bricks[i][j] > 0) {
                var brickX = (j * (BRICKWIDTH + PADDING)) + PADDING;
                var brickY = (i * (BRICKHEIGHT + PADDING)) + PADDING;

                if (bricks[i][j] == 1) {
                    ctx.drawImage(brick1Img, brickX, brickY, BRICKWIDTH, BRICKHEIGHT);
                } else if (bricks[i][j] == 2) {
                    ctx.drawImage(brick2Img, brickX, brickY, BRICKWIDTH, BRICKHEIGHT);
                }
            }
        }
    }
}

function movePaddle() {
    if (rightDown) {
        paddlex += 6;
        if (paddlex + paddlew > WIDTH) {
            paddlex = WIDTH - paddlew;
        }
    }

    if (leftDown) {
        paddlex -= 6;
        if (paddlex < 0) {
            paddlex = 0;
        }
    }
}

function checkBrickCollision() {
    for (var i = 0; i < NROWS; i++) {
        for (var j = 0; j < NCOLS; j++) {
            if (bricks[i][j] > 0) {
                var brickX = (j * (BRICKWIDTH + PADDING)) + PADDING;
                var brickY = (i * (BRICKHEIGHT + PADDING)) + PADDING;

                if (
                    x + r > brickX &&
                    x - r < brickX + BRICKWIDTH &&
                    y + r > brickY &&
                    y - r < brickY + BRICKHEIGHT
                ) {
                    bricks[i][j]--;
                    dy = -dy;
                    tocke++;
                    updateScoreDisplay();
                    preveriZmago();
                    return;
                }
            }
        }
    }
}

function checkWallAndPaddleCollision() {
    if (x + dx > WIDTH - r || x + dx < r) {
        dx = -dx;
    }

    if (y + dy < r) {
        dy = -dy;
    }

    var paddleTop = HEIGHT - paddleh;
    var paddleLeft = paddlex;
    var paddleRight = paddlex + paddlew;

    if (
        y + r + dy >= paddleTop &&
        x >= paddleLeft &&
        x <= paddleRight &&
        dy > 0
    ) {
        var hitPosition = (x - (paddlex + paddlew / 2)) / (paddlew / 2);
        dx = hitPosition * 5;
        dy = -Math.abs(dy);
    }

    if (y + dy > HEIGHT + r) {
        stopGameLoops();

        Swal.fire({
            title: "Konec igre",
            text: "Zgrešil si žogico.",
            icon: "error",
            confirmButtonText: "Poskusi znova"
        });
    }
}

function draw() {
    if (!assetsReady) {
        drawLoadingScreen();
        return;
    }

    clear();
    movePaddle();
    drawBricks();
    drawPaddle();
    drawBall();

    if (gameRunning) {
        checkBrickCollision();
        checkWallAndPaddleCollision();

        x += dx;
        y += dy;
    }
}