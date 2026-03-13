const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WALL = 14;
const BALL_SPEED = 6;
const WALL_COLORS = {
  top: "#ff5d8f",
  left: "#ffd166",
  right: "#7ae582",
  bottom: "#80e7ff",
};

const keys = {
  left: false,
  right: false,
};

const state = {
  phase: "waiting", // waiting | running | gameover
  score: 0,
};

const platform = {
  width: 160,
  height: 14,
  x: canvas.width / 2 - 80,
  y: canvas.height - 110,
  speed: 8,
  vx: 0,
};

const ball = {
  radius: 12,
  x: 0,
  y: 0,
  vx: 3,
  vy: 0,
  color: "#80e7ff",
};

const star = {
  radius: 13,
  x: 0,
  y: 0,
};

let audioCtx = null;
const NOTE_FREQUENCIES = [
  261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25,
];
const STAR_AUDIO_CLIP_MS = 2000;
const starCollectSound = new Audio("star.mp3");
starCollectSound.preload = "auto";
const failSound = new Audio("fail.mp3");
failSound.preload = "auto";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getAudioContext() {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioCtx = new AudioCtx();
  }
  return audioCtx;
}

function playRandomWallNote() {
  const ctxAudio = getAudioContext();
  if (!ctxAudio) return;

  if (ctxAudio.state === "suspended") {
    ctxAudio.resume();
  }

  const frequency =
    NOTE_FREQUENCIES[Math.floor(Math.random() * NOTE_FREQUENCIES.length)];
  const now = ctxAudio.currentTime;

  const oscillator = ctxAudio.createOscillator();
  const gain = ctxAudio.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  oscillator.connect(gain);
  gain.connect(ctxAudio.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.24);
}

function playStarCollectSound() {
  const clip = starCollectSound.cloneNode();
  clip.currentTime = 0;

  clip.play().catch(() => {
    // Ignore autoplay/blocking errors until user interacts.
  });

  window.setTimeout(() => {
    clip.pause();
    clip.currentTime = 0;
  }, STAR_AUDIO_CLIP_MS);
}

function playFailSound() {
  const clip = failSound.cloneNode();
  clip.currentTime = 0;
  clip.play().catch(() => {
    // Ignore autoplay/blocking errors until user interacts.
  });
}

function keepBallSpeed() {
  const magnitude = Math.hypot(ball.vx, ball.vy) || 1;
  ball.vx = (ball.vx / magnitude) * BALL_SPEED;
  ball.vy = (ball.vy / magnitude) * BALL_SPEED;
}

function resetRound() {
  state.score = 0;
  state.phase = "waiting";

  platform.x = canvas.width / 2 - platform.width / 2;
  platform.vx = 0;

  ball.x = platform.x + platform.width / 2;
  ball.y = platform.y - ball.radius - 2;
  ball.vx = (Math.random() < 0.5 ? -1 : 1) * BALL_SPEED * 0.45;
  ball.vy = 0;
  ball.color = "#80e7ff";

  spawnStar();
}

function startGame() {
  if (state.phase === "running") return;

  if (state.phase === "gameover" || state.phase === "waiting") {
    if (state.phase === "gameover") {
      resetRound();
    }
    state.phase = "running";
    if (Math.abs(ball.vx) < 1) {
      ball.vx = (Math.random() < 0.5 ? -1 : 1) * BALL_SPEED * 0.45;
    }
    ball.vx = clamp(ball.vx, -BALL_SPEED * 0.75, BALL_SPEED * 0.75);
    ball.vy = Math.sqrt(BALL_SPEED * BALL_SPEED - ball.vx * ball.vx);
  }
}

function spawnStar() {
  const margin = WALL + star.radius + 8;
  const maxY = platform.y - 80;
  star.x = margin + Math.random() * (canvas.width - margin * 2);
  star.y = margin + Math.random() * Math.max(80, maxY - margin);
}

function updatePlatform() {
  const prevX = platform.x;

  if (keys.left) platform.x -= platform.speed;
  if (keys.right) platform.x += platform.speed;

  platform.x = clamp(platform.x, WALL, canvas.width - WALL - platform.width);
  platform.vx = platform.x - prevX;

  if (state.phase !== "running") {
    ball.x = platform.x + platform.width / 2;
    ball.y = platform.y - ball.radius - 2;
  }
}

function applyStarAssist() {
  const dx = star.x - ball.x;
  const dy = star.y - ball.y;

  // Only assist when the star is generally above the ball.
  if (dy >= 0) return;

  const distance = Math.hypot(dx, dy) || 1;
  const desiredVx = (dx / distance) * BALL_SPEED;

  const assistStrength = 0.4;
  ball.vx = ball.vx * (1 - assistStrength) + desiredVx * assistStrength;
  ball.vx = clamp(ball.vx, -BALL_SPEED * 0.97, BALL_SPEED * 0.97);
  ball.vy = -Math.sqrt(BALL_SPEED * BALL_SPEED - ball.vx * ball.vx);
}

function handleWallBounce() {
  let hitColor = null;

  // Left / right walls
  if (ball.x - ball.radius <= WALL) {
    ball.x = WALL + ball.radius;
    ball.vx *= -1;
    hitColor = WALL_COLORS.left;
  } else if (ball.x + ball.radius >= canvas.width - WALL) {
    ball.x = canvas.width - WALL - ball.radius;
    ball.vx *= -1;
    hitColor = WALL_COLORS.right;
  }

  // Top wall
  if (ball.y - ball.radius <= WALL) {
    ball.y = WALL + ball.radius;
    ball.vy *= -1;
    hitColor = WALL_COLORS.top;
  }

  if (hitColor) {
    ball.color = hitColor;
    playRandomWallNote();
    keepBallSpeed();
  }
}

function handlePlatformBounce() {
  const withinX =
    ball.x >= platform.x - ball.radius &&
    ball.x <= platform.x + platform.width + ball.radius;
  const touchingTop =
    ball.y + ball.radius >= platform.y &&
    ball.y - ball.radius <= platform.y + platform.height;

  if (ball.vy > 0 && withinX && touchingTop) {
    ball.y = platform.y - ball.radius;

    const offset =
      (ball.x - (platform.x + platform.width / 2)) / (platform.width / 2);
    const curvedOffset = Math.sign(offset) * Math.pow(Math.abs(offset), 0.72);
    const platformPush = clamp(platform.vx / platform.speed, -1, 1) * 0.55;

    ball.vx = clamp(
      (curvedOffset * 1.1 + platformPush) * BALL_SPEED,
      -BALL_SPEED * 0.97,
      BALL_SPEED * 0.97,
    );
    ball.vy = -Math.sqrt(BALL_SPEED * BALL_SPEED - ball.vx * ball.vx);

    applyStarAssist();
    keepBallSpeed();
  }
}

function handleStarCollection() {
  const dx = ball.x - star.x;
  const dy = ball.y - star.y;
  const dist = Math.hypot(dx, dy);

  if (dist <= ball.radius + star.radius) {
    state.score += 1;
    playStarCollectSound();
    spawnStar();
  }
}

function updateBall() {
  if (state.phase !== "running") return;

  ball.x += ball.vx;
  ball.y += ball.vy;

  handleWallBounce();
  handlePlatformBounce();
  handleStarCollection();

  const floorY = canvas.height - WALL;
  if (ball.y + ball.radius >= floorY) {
    ball.y = floorY - ball.radius;
    ball.color = WALL_COLORS.bottom;
    playRandomWallNote();
    playFailSound();
    state.phase = "gameover";
  }
}

function drawWalls() {
  // Top
  ctx.fillStyle = WALL_COLORS.top;
  ctx.fillRect(0, 0, canvas.width, WALL);
  // Left
  ctx.fillStyle = WALL_COLORS.left;
  ctx.fillRect(0, 0, WALL, canvas.height);
  // Right
  ctx.fillStyle = WALL_COLORS.right;
  ctx.fillRect(canvas.width - WALL, 0, WALL, canvas.height);
  // Bottom
  ctx.fillStyle = WALL_COLORS.bottom;
  ctx.fillRect(0, canvas.height - WALL, canvas.width, WALL);
}

function drawPlatform() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
}

function drawBall() {
  ctx.beginPath();
  ctx.fillStyle = ball.color;
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawStarShape(x, y, radius, color) {
  const inner = radius * 0.45;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : inner;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawHUD() {
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Inter, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Stars: ${state.score}`, 24, 38);

  if (state.phase === "waiting") {
    ctx.font = "bold 30px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Press N to Start", canvas.width / 2, canvas.height / 2 - 10);
  }

  if (state.phase === "gameover") {
    ctx.font = "bold 34px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffb4b4";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 24);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Inter, Arial, sans-serif";
    ctx.fillText(
      `Final Stars: ${state.score}`,
      canvas.width / 2,
      canvas.height / 2 + 12,
    );
    ctx.fillText(
      "Press N to Restart",
      canvas.width / 2,
      canvas.height / 2 + 48,
    );
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawWalls();
  drawPlatform();
  drawStarShape(star.x, star.y, star.radius, "#ffd166");
  drawBall();
  drawHUD();
}

function gameLoop() {
  updatePlatform();
  updateBall();
  draw();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === "arrowleft" || key === "a" || key === "w") keys.left = true;
  if (key === "arrowright" || key === "d") keys.right = true;

  if (key === "n") {
    startGame();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();

  if (key === "arrowleft" || key === "a" || key === "w") keys.left = false;
  if (key === "arrowright" || key === "d") keys.right = false;
});

resetRound();
gameLoop();
