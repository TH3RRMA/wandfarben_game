"use strict";

// ---- Konfiguration ----
const COLS = 10;
const ROWS = 6;
const TOTAL = COLS * ROWS;

const START_BLUE = 8;      // blaue Ziegel zu Beginn
const BASE_INTERVAL = 1300; // Start-Tempo (ms bis zum nächsten blauen Ziegel)
const MIN_INTERVAL = 150;   // maximales Tempo
const SPEEDUP = 0.97;       // Beschleunigung pro neuem Ziegel
const DANGER_RATIO = 0.7;   // ab diesem Blau-Anteil pulsiert die Wand

// ---- DOM ----
const wall = document.getElementById("wall");
const scoreEl = document.getElementById("score");
const blueCountEl = document.getElementById("blue-count");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");

// ---- Zustand ----
let bricks = [];        // { el, state: "blue" | "red" }
let score = 0;
let blueCount = 0;
let interval = BASE_INTERVAL;
let speed = 1;
let running = false;
let spawnTimer = null;
let highScore = Number(localStorage.getItem("wandfarben_highscore") || 0);

// ---- Sound ----
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
}

function playPop() {
  try {
    ensureAudio();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch (e) {
    /* Sound ist optional */
  }
}

// ---- Aufbau ----
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildWall() {
  wall.innerHTML = "";
  bricks = [];
  wall.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  for (let i = 0; i < TOTAL; i++) {
    const el = document.createElement("div");
    el.className = "brick blue";
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return; // nur linke Maustaste
      onBrickTap(i);
    });
    wall.appendChild(el);
    bricks.push({ el, state: "blue" });
  }
}

function setBrick(i, state) {
  const b = bricks[i];
  if (b.state === state) return;
  b.state = state;
  b.el.className = "brick " + state;
  blueCount += state === "blue" ? 1 : -1;
}

// ---- Spielablauf ----
function startGame() {
  score = 0;
  blueCount = 0;
  interval = BASE_INTERVAL;
  speed = 1;
  running = true;

  for (const b of bricks) {
    b.state = "red";
    b.el.className = "brick red";
  }

  const indices = shuffle([...Array(TOTAL).keys()]);
  for (let k = 0; k < START_BLUE; k++) {
    const i = indices[k];
    bricks[i].state = "blue";
    bricks[i].el.className = "brick blue";
  }
  blueCount = START_BLUE;

  updateHUD();
  overlay.classList.add("hidden");
  scheduleSpawn();
}

function scheduleSpawn() {
  clearTimeout(spawnTimer);
  spawnTimer = setTimeout(() => {
    if (!running) return;
    spawnBlue();
    interval = Math.max(MIN_INTERVAL, interval * SPEEDUP);
    speed = BASE_INTERVAL / interval;
    updateHUD();
    scheduleSpawn();
  }, interval);
}

function spawnBlue() {
  const red = [];
  for (let i = 0; i < TOTAL; i++) {
    if (bricks[i].state === "red") red.push(i);
  }
  if (red.length === 0) {
    gameOver();
    return;
  }
  setBrick(red[Math.floor(Math.random() * red.length)], "blue");
  updateHUD();
}

function onBrickTap(i) {
  if (!running) return;
  if (bricks[i].state !== "blue") return;
  setBrick(i, "red");
  score++;
  playPop();
  updateHUD();
}

function updateHUD() {
  scoreEl.textContent = score;
  blueCountEl.textContent = blueCount + " / " + TOTAL;
  levelEl.textContent = speed.toFixed(1) + "x";
  wall.classList.toggle("danger", blueCount / TOTAL > DANGER_RATIO);
}

function gameOver() {
  running = false;
  clearTimeout(spawnTimer);
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("wandfarben_highscore", String(highScore));
  }
  overlayTitle.textContent = "Spiel vorbei!";
  overlayText.innerHTML =
    "Punkte: <strong>" + score + "</strong><br>Rekord: <strong>" + highScore + "</strong>";
  startBtn.textContent = "Nochmal";
  overlay.classList.remove("hidden");
}

// ---- Start ----
startBtn.addEventListener("click", startGame);
document.addEventListener("keydown", (e) => {
  if (e.code === "Enter" || e.code === "Space") {
    if (!running) startGame();
  }
});

buildWall();
overlay.classList.remove("hidden");
