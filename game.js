"use strict";

// ---------- Konfiguration ----------
const COLS = 10;
const ROWS = 6;
const TOTAL = COLS * ROWS;

const PHASE_DURATION = 30;      // Sekunden pro Phase
const BASE_INTERVAL = 1600;     // Spawn-Intervall in Phase 1 (ms)
const INTERVAL_STEP = 130;      // pro Phase schnellere Spawns
const MIN_INTERVAL = 300;
const START_BLUE_BASE = 6;      // blaue Ziegel in Phase 1
const START_BLUE_STEP = 3;      // +3 blaue Ziegel pro Phase
const DANGER_RATIO = 0.75;      // ab diesem Blau-Anteil pulsiert die Wand

// ---------- Upgrades ----------
const UPGRADES = {
  radius: {
    name: "Farbradius",
    icon: "🔵",
    desc: "Färbt beim Antippen auch umliegende Ziegel ein.",
    max: 3,
    baseCost: 30,
    effect: (n) => "Färbt " + (2 * n + 1) + "×" + (2 * n + 1) + " Ziegel",
  },
  tempo: {
    name: "Tempo-Bremse",
    icon: "🐢",
    desc: "Ziegel werden langsamer blau.",
    max: 5,
    baseCost: 20,
    effect: (n) => "+" + n * 25 + "% langsamer",
  },
  points: {
    name: "Punkte-Boost",
    icon: "⭐",
    desc: "Mehr Punkte pro Ziegel.",
    max: 5,
    baseCost: 20,
    effect: (n) => 1 + n + " Punkte pro Ziegel",
  },
  tolerance: {
    name: "Fehlertoleranz",
    icon: "🛡️",
    desc: "Verringert die Strafe für Fehlklicks.",
    max: 3,
    baseCost: 30,
    effect: (n) => "-" + n * 3 + " Fehler Strafe",
  },
};

// ---------- DOM ----------
const wall = document.getElementById("wall");
const scoreEl = document.getElementById("score");
const phaseEl = document.getElementById("phase");
const timeEl = document.getElementById("time");
const tempoEl = document.getElementById("tempo");
const missEl = document.getElementById("misses");
const progressFill = document.getElementById("progress-fill");

const menuOverlay = document.getElementById("menu");
const menuTitle = document.getElementById("menu-title");
const menuText = document.getElementById("menu-text");
const menuBtn = document.getElementById("menu-btn");

const shopOverlay = document.getElementById("shop");
const shopPhaseEl = document.getElementById("shop-phase");
const shopSubtitleEl = document.getElementById("shop-subtitle");
const shopCardsEl = document.getElementById("shop-cards");
const nextBtn = document.getElementById("next-btn");

// ---------- Zustand ----------
let bricks = []; // { el, state, row, col }
let levels = { radius: 0, tempo: 0, points: 0, tolerance: 0 };

let points = 0;       // ausgabbare Punkte (Währung)
let earnedTotal = 0;  // gesamt erspielte Punkte (für Rekord)
let misses = 0;       // Fehlklicks in der aktuellen Phase
let blueCount = 0;
let phase = 0;
let running = false;
let phaseEnd = 0;
let spawnTimer = null;
let timerId = null;

let highScore = Number(localStorage.getItem("wandfarben_highscore") || 0);

// ---------- Sound ----------
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

function playBuzz() {
  try {
    ensureAudio();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(180, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  } catch (e) {
    /* Sound ist optional */
  }
}

// ---------- Helfer ----------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function reach() {
  return levels.radius;
}

function currentInterval() {
  const base = Math.max(MIN_INTERVAL, BASE_INTERVAL - (phase - 1) * INTERVAL_STEP);
  return base * (1 + levels.tempo * 0.25);
}

function pointsPerBrick() {
  return 1 + levels.points;
}

function effectiveMisses() {
  return Math.max(0, misses - levels.tolerance * 3);
}

function shopTier() {
  return Math.max(1, 3 - Math.floor(effectiveMisses() / 5));
}

function priceMultiplier() {
  return 1 + effectiveMisses() * 0.1;
}

// ---------- Aufbau ----------
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
    bricks.push({
      el,
      state: "blue",
      row: Math.floor(i / COLS),
      col: i % COLS,
    });
  }
}

// ---------- Spielablauf ----------
function startRun() {
  points = 0;
  earnedTotal = 0;
  misses = 0;
  phase = 0;
  levels = { radius: 0, tempo: 0, points: 0, tolerance: 0 };
  menuOverlay.classList.add("hidden");
  shopOverlay.classList.add("hidden");
  startPhase();
}

function startPhase() {
  phase++;
  blueCount = 0;

  // Alles rot, dann Start-Ziegel blau setzen
  for (const b of bricks) {
    b.state = "red";
    b.el.className = "brick red";
  }
  const n = Math.min(
    Math.floor(TOTAL * 0.5),
    START_BLUE_BASE + (phase - 1) * START_BLUE_STEP
  );
  const indices = shuffle([...Array(TOTAL).keys()]);
  for (let k = 0; k < n; k++) {
    const i = indices[k];
    bricks[i].state = "blue";
    bricks[i].el.className = "brick blue";
  }
  blueCount = n;

  running = true;
  phaseEnd = Date.now() + PHASE_DURATION * 1000;
  wall.classList.remove("danger");
  updateHUD();
  startTimer();
  scheduleSpawn();
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    if (!running) return;
    const remaining = Math.max(0, phaseEnd - Date.now());
    timeEl.textContent = Math.ceil(remaining / 1000) + "s";
    progressFill.style.width = (remaining / (PHASE_DURATION * 1000)) * 100 + "%";
    if (remaining <= 0) endPhase();
  }, 100);
}

function scheduleSpawn() {
  clearTimeout(spawnTimer);
  spawnTimer = setTimeout(() => {
    if (!running) return;
    spawnBlue();
    scheduleSpawn();
  }, currentInterval());
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
  const i = red[Math.floor(Math.random() * red.length)];
  bricks[i].state = "blue";
  bricks[i].el.className = "brick blue";
  blueCount++;
  updateHUD();
}

function onBrickTap(i) {
  if (!running) return;
  const b = bricks[i];
  if (b.state === "blue") {
    colorArea(i);
  } else {
    misses++;
    playBuzz();
    flashMiss(i);
    updateHUD();
  }
}

function colorArea(center) {
  const r = reach();
  const c = bricks[center];
  let colored = 0;

  for (const b of bricks) {
    const d = Math.max(Math.abs(b.row - c.row), Math.abs(b.col - c.col));
    if (d <= r && b.state === "blue") {
      b.state = "red";
      b.el.className = "brick red";
      colored++;
    }
  }

  if (colored > 0) {
    const gained = colored * pointsPerBrick();
    points += gained;
    earnedTotal += gained;
    blueCount -= colored;
    playPop();
  }
  updateHUD();
}

function flashMiss(i) {
  const el = bricks[i].el;
  el.classList.add("miss");
  setTimeout(() => el.classList.remove("miss"), 250);
}

function updateHUD() {
  scoreEl.textContent = points;
  phaseEl.textContent = phase;
  tempoEl.textContent = (currentInterval() / 1000).toFixed(1) + "s";
  missEl.textContent = misses;
  wall.classList.toggle("danger", blueCount / TOTAL > DANGER_RATIO);
}

// ---------- Phasenende & Shop ----------
function endPhase() {
  running = false;
  clearInterval(timerId);
  clearTimeout(spawnTimer);
  openShop();
}

function openShop() {
  shopPhaseEl.textContent = phase;
  const tier = shopTier();
  shopSubtitleEl.textContent =
    "Fehlklicks: " + misses +
    (tier < 3 ? " → nur " + tier + " Upgrade(s) zur Auswahl" : " → volle Auswahl");
  renderShopCards();
  shopOverlay.classList.remove("hidden");
}

function renderShopCards() {
  shopCardsEl.innerHTML = "";
  const tier = shopTier();
  const available = Object.keys(UPGRADES).filter((k) => levels[k] < UPGRADES[k].max);
  const chosen = shuffle(available).slice(0, tier);

  if (chosen.length === 0) {
    const empty = document.createElement("p");
    empty.className = "shop-empty";
    empty.textContent = "Alle Upgrades bereits auf Maximum!";
    shopCardsEl.appendChild(empty);
    return;
  }

  for (const key of chosen) {
    shopCardsEl.appendChild(createCard(key));
  }
}

function createCard(key) {
  const u = UPGRADES[key];
  const nextLevel = levels[key] + 1;
  const cost = Math.round(u.baseCost * nextLevel * priceMultiplier());

  const card = document.createElement("div");
  card.className = "card";

  const icon = document.createElement("div");
  icon.className = "card-icon";
  icon.textContent = u.icon;

  const title = document.createElement("h3");
  title.textContent = u.name + " Lv." + levels[key] + " → " + nextLevel;

  const effect = document.createElement("p");
  effect.className = "card-effect";
  effect.textContent = u.effect(nextLevel);

  const btn = document.createElement("button");
  btn.className = "buy-btn";
  btn.textContent = "Kaufen · " + cost + " Pkt";
  btn.dataset.cost = cost;
  btn.disabled = points < cost;
  btn.addEventListener("click", () => buyUpgrade(key, cost, btn));

  card.appendChild(icon);
  card.appendChild(title);
  card.appendChild(effect);
  card.appendChild(btn);
  return card;
}

function buyUpgrade(key, cost, btn) {
  if (points < cost) return;
  points -= cost;
  levels[key]++;

  btn.textContent = "Gekauft ✓";
  btn.disabled = true;
  btn.classList.add("bought");

  document.querySelectorAll(".buy-btn:not(.bought)").forEach((b) => {
    b.disabled = points < Number(b.dataset.cost);
  });
  updateHUD();
}

// ---------- Game Over ----------
function gameOver() {
  running = false;
  clearInterval(timerId);
  clearTimeout(spawnTimer);
  if (earnedTotal > highScore) {
    highScore = earnedTotal;
    localStorage.setItem("wandfarben_highscore", String(highScore));
  }
  menuTitle.textContent = "Spiel vorbei!";
  menuText.innerHTML =
    "Erreichte Phase: <strong>" + phase + "</strong><br>" +
    "Gesamtpunkte: <strong>" + earnedTotal + "</strong><br>" +
    "Rekord: <strong>" + highScore + "</strong>";
  menuBtn.textContent = "Nochmal";
  menuOverlay.classList.remove("hidden");
}

// ---------- Initialisierung ----------
menuBtn.addEventListener("click", startRun);
nextBtn.addEventListener("click", () => {
  shopOverlay.classList.add("hidden");
  startPhase();
});
document.addEventListener("keydown", (e) => {
  if (e.code === "Enter" || e.code === "Space") {
    if (menuOverlay.classList.contains("hidden") && shopOverlay.classList.contains("hidden")) {
      if (!running) startRun();
    }
  }
});

menuTitle.textContent = "Wandfarben";
menuText.innerHTML =
  "Tippe die <strong>blauen</strong> Ziegel mit der <strong>linken Maustaste</strong> an,<br>" +
  "um sie rot zu machen. Jede Phase dauert " + PHASE_DURATION + " Sekunden.<br><br>" +
  "In den Pausen kaufst du Upgrades.<br>" +
  "Achtung: Klicks auf rote Ziegel sind Fehler und verschlechtern die Upgrades!<br><br>" +
  "Rekord: <strong>" + highScore + "</strong>";
menuBtn.textContent = "Start";
menuOverlay.classList.remove("hidden");

buildWall();
