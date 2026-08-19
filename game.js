/* ============================================================
   BIRTHDAY QUEST  -  game.js  v5 (PRO Polish)
   Princess Ikah menyelamatkan Prince Andri!  🎂👑
   Built with love for Ikah Maryanah's Special Birthday
   ============================================================ */

'use strict';

/* ────────────────────────────────────────────────────────────
   1. CANVAS SETUP & AUTO-RESIZE
   ──────────────────────────────────────────────────────────── */
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

let VW = window.innerWidth;
let VH = window.innerHeight;

function resizeCanvas() {
  VW = window.innerWidth;
  VH = window.innerHeight;
  canvas.width  = VW;
  canvas.height = VH;
}

window.addEventListener('resize', () => {
  resizeCanvas();
  if (gameState === 'playing' || gameState === 'gameover') {
    buildLevel();
    resetPlayer(false);
  }
});
resizeCanvas();

/* ────────────────────────────────────────────────────────────
   2. SPRITES & ASSET LOADER
   ──────────────────────────────────────────────────────────── */
const IMG = {};
function loadSprite(key, src) {
  const img = new Image();
  img.src = src;
  IMG[key] = img;
}

// Princess Ikah
loadSprite('ikah_idle',   'Asset/princes ikah.png');
loadSprite('ikah_run1',   'Asset/princes ikah jalan 1.png');
loadSprite('ikah_run2',   'Asset/princess ikah jalan 2.png');
loadSprite('ikah_run3',   'Asset/princess ikah jalan 3.png');
loadSprite('ikah_jump',   'Asset/princes ikah lompat.png');

// Prince Andri
loadSprite('andri_idle',  'Asset/prince andri.png');
loadSprite('andri_walk1', 'Asset/prince andri jalan 1.png');
loadSprite('andri_walk2', 'Asset/prince andri jalan 2.png');
loadSprite('andri_walk3', 'Asset/prince andri jalan.png');

// Enemies
loadSprite('monster1',    'Asset/monster 1.png');
loadSprite('monster2',    'Asset/monster 2.png');
loadSprite('monster3',    'Asset/monster 3.png');

// Environment & Items
loadSprite('bg1',         'Asset/background.jpg');
loadSprite('bg2',         'Asset/background (1).jpg');
loadSprite('ground',      'Asset/tanah.png');
loadSprite('floatPlat',   'Asset/tanah terbang.png');
loadSprite('cage',        'Asset/sangkar.png');
loadSprite('key',         'Asset/Kunci.png');
loadSprite('cake',        'Asset/kue.png');
loadSprite('couple',      'Asset/chibi_couple.jpg');
loadSprite('deco1',       'Asset/akasesoris.png');
loadSprite('deco2',       'Asset/aksesoris 2.png');

function isImgLoaded(k) {
  return IMG[k] && IMG[k].complete && IMG[k].naturalWidth > 0;
}

/* ────────────────────────────────────────────────────────────
   3. AUDIO SYNTHESIZER (Web Audio API)
   ──────────────────────────────────────────────────────────── */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq, duration, type = 'square', volume = 0.12) {
  try {
    const ac = getAudioCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration);
  } catch (e) {}
}

function sfxJump() {
  playTone(450, 0.12, 'square', 0.10);
  setTimeout(() => playTone(620, 0.10, 'square', 0.08), 50);
}

function sfxCoin() {
  playTone(920, 0.06, 'sine', 0.14);
  setTimeout(() => playTone(1200, 0.10, 'sine', 0.12), 45);
}

function sfxStomp() {
  playTone(200, 0.10, 'sawtooth', 0.18);
}

function sfxKey() {
  const notes = [659, 784, 880, 1046];
  notes.forEach((f, i) => {
    setTimeout(() => playTone(f, 0.14, 'sine', 0.18), i * 70);
  });
}

function sfxWin() {
  const melody = [
    { f: 523, d: 0.15 }, { f: 659, d: 0.15 }, { f: 784, d: 0.18 },
    { f: 1046, d: 0.35 }
  ];
  melody.forEach((note, i) => {
    setTimeout(() => playTone(note.f, note.d, 'triangle', 0.22), i * 160);
  });
}

/* ────────────────────────────────────────────────────────────
   4. GAME STATE & VARIABLES
   ──────────────────────────────────────────────────────────── */
let gameState = 'menu'; // 'menu' | 'form' | 'playing' | 'gameover' | 'ending'
let score = 0;
let lives = 3;
let timeLeft = 180;
let timerInterval = null;
let hasKey = false;
let cameraX = 0;
let globalTick = 0;
let birthInfo = { day: 20, month: 8, year: 2000, age: 26, monthName: 'Agustus' };

// Voice Recording & Audio
let voiceBlobUrl = null;
let bgAudioEl = null;
let mediaRecorder = null;
let recordedChunks = [];
let recTimerInterval = null;
let recSeconds = 0;

/* ────────────────────────────────────────────────────────────
   5. TILE SYSTEM & LEVEL GEOMETRY
   ──────────────────────────────────────────────────────────── */
let TW = 48; // Tile width
let TH = 48; // Tile height
let GY = 450; // Ground Y level
let LEVEL_WIDTH = 3500;
const LEVEL_TILES_COUNT = 65;

let platforms = [];
let enemies = [];
let coins = [];
let keyItem = { x: 0, y: 0, w: 40, h: 40, collected: false };
let cageDoor = { x: 0, y: 0, w: 90, h: 110, unlocked: false };
let princeAndri = { x: 0, y: 0, w: 50, h: 80 };
let player = {
  x: 100, y: 300, w: 48, h: 76,
  vx: 0, vy: 0,
  onGround: false,
  dir: 1, // 1 = right, -1 = left
  runFrame: 0,
  invincible: 0,
  dead: false
};

function buildLevel() {
  // Compute responsive tile metrics
  TH = Math.max(40, Math.min(64, Math.floor(VH / 11)));
  TW = TH;
  GY = Math.floor(VH - TH * 2.3);
  LEVEL_WIDTH = LEVEL_TILES_COUNT * TW;

  // Ground segments [colStart, colEnd]
  const groundSegs = [
    [0, 8],
    [12, 19],
    [22, 27],
    [30, 36],
    [39, 45],
    [48, 54],
    [56, 64]
  ];

  // Floating platforms [col, row, widthInTiles]
  const floatSegs = [
    [4, 7, 2],
    [9, 6, 2],
    [14, 5, 3],
    [20, 6, 2],
    [24, 4, 3],
    [28, 6, 2],
    [32, 5, 3],
    [37, 4, 3],
    [42, 6, 2],
    [46, 5, 3],
    [50, 4, 3],
    [54, 6, 2],
    [58, 5, 2]
  ];

  // Enemies [col, row, minCol, maxCol, monsterVariant (1, 2, 3)]
  const enemyDefs = [
    [6, 7, 3, 7, 1],
    [15, 5, 14, 18, 2],
    [24, 4, 23, 27, 3],
    [33, 5, 31, 35, 1],
    [41, 7, 39, 44, 2],
    [49, 4, 48, 52, 3],
    [57, 5, 56, 60, 1]
  ];

  // Coins [col, row]
  const coinDefs = [
    [4, 6], [5, 6],
    [9, 5], [10, 5],
    [15, 4], [16, 4],
    [20, 5],
    [24, 3], [25, 3], [26, 3],
    [28, 5],
    [32, 4], [33, 4], [34, 4],
    [37, 3], [38, 3],
    [42, 5], [43, 5],
    [46, 4], [47, 4],
    [50, 3], [51, 3],
    [54, 5],
    [58, 4], [59, 4]
  ];

  platforms = [];

  // Construct ground
  groundSegs.forEach(seg => {
    platforms.push({
      x: seg[0] * TW,
      y: GY,
      w: (seg[1] - seg[0] + 1) * TW,
      h: Math.round(TH * 2.5),
      type: 'ground'
    });
  });

  // Construct floating platforms
  floatSegs.forEach(seg => {
    platforms.push({
      x: seg[0] * TW,
      y: seg[1] * TH,
      w: seg[2] * TW,
      h: Math.round(TH * 0.65),
      type: 'float'
    });
  });

  // Construct enemies
  enemies = enemyDefs.map(def => {
    const ew = Math.round(TH * 0.85);
    const eh = Math.round(TH * 0.85);
    return {
      x: def[0] * TW,
      y: def[1] * TH - eh,
      w: ew,
      h: eh,
      vx: 1.4,
      dir: 1,
      minX: def[2] * TW,
      maxX: def[3] * TW,
      variant: def[4],
      alive: true
    };
  });

  // Construct coins
  coins = coinDefs.map(c => ({
    x: c[0] * TW + Math.round(TW * 0.3),
    y: c[1] * TH - 16,
    w: 24,
    h: 24,
    collected: false
  }));

  // Key Item Location (at col 50, row 3 on floating platform)
  const kw = Math.round(TH * 0.75);
  keyItem = {
    x: 51 * TW,
    y: 3 * TH - kw - 8,
    w: kw,
    h: kw,
    collected: false
  };

  // Cage and Prince Andri at the far right
  const cageW = Math.round(TH * 1.8);
  const cageH = Math.round(TH * 2.2);
  cageDoor = {
    x: 60 * TW,
    y: GY - cageH + 8,
    w: cageW,
    h: cageH,
    unlocked: false
  };

  const andriH = Math.round(TH * 1.3);
  const andriW = Math.round(andriH * (271 / 461));
  princeAndri = {
    x: cageDoor.x + Math.round((cageW - andriW) / 2),
    y: GY - andriH,
    w: andriW,
    h: andriH
  };
}

function resetPlayer(fresh = true) {
  const ph = Math.round(TH * 1.25);
  const pw = Math.round(ph * (309 / 488));
  player.w = pw;
  player.h = ph;
  player.x = 2 * TW;
  player.y = GY - ph - 6;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.dir = 1;
  player.runFrame = 0;
  player.invincible = fresh ? 0 : 90;
  player.dead = false;
}

/* ────────────────────────────────────────────────────────────
   6. USER INPUT (KEYBOARD & TOUCH)
   ──────────────────────────────────────────────────────────── */
const keys = {};

window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', e => {
  keys[e.code] = false;
});

function bindTouchControl(id, code) {
  const btn = document.getElementById(id);
  if (!btn) return;

  const press = e => {
    e.preventDefault();
    keys[code] = true;
    btn.classList.add('pressed');
  };

  const release = e => {
    e.preventDefault();
    keys[code] = false;
    btn.classList.remove('pressed');
  };

  btn.addEventListener('touchstart', press, { passive: false });
  btn.addEventListener('touchend', release, { passive: false });
  btn.addEventListener('touchcancel', release, { passive: false });
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointerleave', release);
}

bindTouchControl('tcLeft', 'ArrowLeft');
bindTouchControl('tcRight', 'ArrowRight');
bindTouchControl('tcJump', 'Space');

/* ────────────────────────────────────────────────────────────
   7. HUD & UI MANAGERS
   ──────────────────────────────────────────────────────────── */
function updateHUD() {
  document.getElementById('hudLives').textContent = Array(Math.max(0, lives)).fill('❤️').join('');
  document.getElementById('hudScore').textContent = score;
  document.getElementById('hudTime').textContent  = timeLeft;
  document.getElementById('hudKey').textContent   = hasKey ? '🗝️ Kunci ✓' : '🔑 Cari Kunci';
  document.getElementById('hudKey').style.color   = hasKey ? '#69F0AE' : '#FFE082';
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(id);
  if (target) target.classList.remove('hidden');
}

function showHUD() {
  document.getElementById('game-hud').classList.remove('hidden');
  document.getElementById('touch-controls').classList.remove('hidden');
}

function hideHUD() {
  document.getElementById('game-hud').classList.add('hidden');
  document.getElementById('touch-controls').classList.add('hidden');
}

function generateStars() {
  const container = document.getElementById('starsContainer');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const sz = (Math.random() * 2.5 + 1).toFixed(1);
    s.style.left = `${(Math.random() * 100).toFixed(1)}%`;
    s.style.top  = `${(Math.random() * 100).toFixed(1)}%`;
    s.style.width  = `${sz}px`;
    s.style.height = `${sz}px`;
    s.style.animationDelay = `${(Math.random() * 3).toFixed(2)}s`;
    s.style.animationDuration = `${(1.5 + Math.random() * 2).toFixed(2)}s`;
    container.appendChild(s);
  }
}

/* ────────────────────────────────────────────────────────────
   8. MENU & FORM ACTIONS
   ──────────────────────────────────────────────────────────── */
document.getElementById('btnStart').addEventListener('click', () => {
  getAudioCtx();
  showScreen('screen-form');
  gameState = 'form';
});

document.getElementById('btnPlay').addEventListener('click', () => {
  getAudioCtx();
  const day   = parseInt(document.getElementById('inpDay').value, 10);
  const month = parseInt(document.getElementById('inpMonth').value, 10);
  const year  = parseInt(document.getElementById('inpYear').value, 10);
  const err   = document.getElementById('formError');

  if (!day || !month || !year || day < 1 || day > 31 || year < 1980 || year > 2030) {
    err.classList.remove('hidden');
    return;
  }

  err.classList.add('hidden');
  const today = new Date();
  const birthDate = new Date(year, month - 1, day);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  birthInfo = {
    day,
    month,
    year,
    age: Math.max(1, age),
    monthName: monthNames[month - 1]
  };

  startGame();
});

/* ────────────────────────────────────────────────────────────
   9. START GAME
   ──────────────────────────────────────────────────────────── */
function startGame() {
  gameState = 'playing';
  score = 0;
  lives = 3;
  timeLeft = 180;
  hasKey = false;
  cameraX = 0;
  globalTick = 0;
  canvas.onclick = null;

  resizeCanvas();
  buildLevel();
  resetPlayer(true);

  enemies.forEach(e => (e.alive = true));
  coins.forEach(c => (c.collected = false));
  keyItem.collected = false;

  showScreen('__none__');
  showHUD();
  updateHUD();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (gameState !== 'playing') return;
    timeLeft--;
    updateHUD();
    if (timeLeft <= 0) {
      handlePlayerDeath();
    }
  }, 1000);
}

/* ────────────────────────────────────────────────────────────
   10. PHYSICS & COLLISIONS
   ──────────────────────────────────────────────────────────── */
const GRAVITY   = 0.48;
const JUMP_VEL  = -12.5;
const RUN_SPEED = 4.2;

function checkAABB(r1, r2) {
  return (
    r1.x < r2.x + r2.w &&
    r1.x + r1.w > r2.x &&
    r1.y < r2.y + r2.h &&
    r1.y + r1.h > r2.y
  );
}

function updatePlayer() {
  if (player.dead) return;

  const moveLeft  = keys['ArrowLeft']  || keys['KeyA'];
  const moveRight = keys['ArrowRight'] || keys['KeyD'];
  const jumpKey   = keys['Space'] || keys['ArrowUp'] || keys['KeyW'];

  player.vx = 0;
  if (moveLeft) {
    player.vx = -RUN_SPEED;
    player.dir = -1;
  }
  if (moveRight) {
    player.vx = RUN_SPEED;
    player.dir = 1;
  }

  // Animation cycle
  if ((moveLeft || moveRight) && player.onGround) {
    if (globalTick % 8 === 0) {
      player.runFrame = (player.runFrame + 1) % 3;
    }
  } else if (!moveLeft && !moveRight) {
    player.runFrame = 0;
  }

  // Jump
  if (jumpKey && player.onGround) {
    player.vy = JUMP_VEL;
    player.onGround = false;
    sfxJump();
  }

  // Apply gravity & velocity
  player.vy += GRAVITY;
  player.x  += player.vx;
  player.y  += player.vy;
  player.onGround = false;

  // Platform collision
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (!checkAABB(player, p)) continue;

    // Land on top
    if (player.vy >= 0 && player.y + player.h - player.vy <= p.y + 12) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
    }
    // Hit head
    else if (player.vy < 0 && player.y - player.vy >= p.y + p.h - 12) {
      player.y = p.y + p.h;
      player.vy = 0;
    }
    // Sideways collision
    else {
      if (player.vx > 0) player.x = p.x - player.w;
      else if (player.vx < 0) player.x = p.x + p.w;
    }
  }

  // World boundaries
  if (player.x < 0) player.x = 0;
  if (player.x > LEVEL_WIDTH - player.w) player.x = LEVEL_WIDTH - player.w;

  // Fell into pit
  if (player.y > VH + 150) {
    handlePlayerDeath();
    return;
  }

  // Invincibility counter
  if (player.invincible > 0) player.invincible--;

  // Enemy collision
  if (player.invincible === 0) {
    for (let j = 0; j < enemies.length; j++) {
      const en = enemies[j];
      if (!en.alive || !checkAABB(player, en)) continue;

      // Stomp on enemy head
      if (player.vy > 0 && player.y + player.h < en.y + en.h * 0.6) {
        en.alive = false;
        player.vy = -8.5;
        score += 100;
        updateHUD();
        sfxStomp();
      } else {
        handlePlayerDeath();
        return;
      }
    }
  }

  // Coin collection
  for (let k = 0; k < coins.length; k++) {
    const coin = coins[k];
    if (!coin.collected && checkAABB(player, coin)) {
      coin.collected = true;
      score += 50;
      updateHUD();
      sfxCoin();
    }
  }

  // Key pickup
  if (!keyItem.collected && checkAABB(player, keyItem)) {
    keyItem.collected = true;
    hasKey = true;
    score += 500;
    updateHUD();
    sfxKey();
  }

  // Rescue Prince Andri
  if (hasKey && checkAABB(player, cageDoor)) {
    triggerBirthdayEnding();
    return;
  }

  // Smooth camera tracking
  const targetCamX = player.x - VW * 0.35;
  cameraX = Math.max(0, Math.min(targetCamX, LEVEL_WIDTH - VW));
}

function updateEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    const en = enemies[i];
    if (!en.alive) continue;

    en.x += en.vx * en.dir;
    if (en.x <= en.minX) {
      en.x = en.minX;
      en.dir = 1;
    }
    if (en.x >= en.maxX) {
      en.x = en.maxX;
      en.dir = -1;
    }
  }
}

function handlePlayerDeath() {
  lives--;
  updateHUD();
  if (lives <= 0) {
    gameState = 'gameover';
    clearInterval(timerInterval);
    return;
  }
  resetPlayer(false);
  cameraX = 0;
}

/* ────────────────────────────────────────────────────────────
   11. ENDING CELEBRATION & POPUP
   ──────────────────────────────────────────────────────────── */
function triggerBirthdayEnding() {
  gameState = 'ending';
  clearInterval(timerInterval);
  hideHUD();
  sfxWin();

  // Populate dynamic birthday details
  const infoEl = document.getElementById('popup-info');
  if (infoEl) {
    infoEl.textContent = `Ulang Tahun ke-${birthInfo.age} 🎂 (${birthInfo.day} ${birthInfo.monthName} ${birthInfo.year})`;
  }

  setTimeout(() => {
    document.getElementById('ending-popup').classList.remove('hidden');
    spawnConfettiParticles();
    if (bgAudioEl) {
      bgAudioEl.currentTime = 0;
      bgAudioEl.play().catch(() => {});
    }
  }, 600);
}

function spawnConfettiParticles() {
  const layer = document.getElementById('confetti-layer');
  if (!layer) return;
  layer.innerHTML = '';
  const colors = ['#FFD54F', '#FF4081', '#69F0AE', '#40C4FF', '#FF6E40', '#E040FB', '#FFFFFF'];

  for (let i = 0; i < 90; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    const sz = (Math.random() * 10 + 6).toFixed(1);
    const left = (Math.random() * 100).toFixed(1);
    const dur = (Math.random() * 2 + 2.2).toFixed(2);
    const del = (Math.random() * 1.5).toFixed(2);
    const col = colors[i % colors.length];
    const shape = Math.random() < 0.5 ? '50%' : '2px';

    p.style.cssText = `
      left: ${left}%;
      width: ${sz}px;
      height: ${sz}px;
      background: ${col};
      border-radius: ${shape};
      animation-duration: ${dur}s;
      animation-delay: ${del}s;
    `;
    layer.appendChild(p);
  }
}

/* ────────────────────────────────────────────────────────────
   12. VOICE RECORDING & AUDIO PLAYBACK
   ──────────────────────────────────────────────────────────── */
window.loadVoice = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  voiceBlobUrl = URL.createObjectURL(file);
  setupVoiceAudio();
  document.getElementById('voicePlayer').classList.remove('hidden');
};

function setupVoiceAudio() {
  if (bgAudioEl) {
    bgAudioEl.pause();
    bgAudioEl = null;
  }
  bgAudioEl = new Audio(voiceBlobUrl);
  bgAudioEl.addEventListener('timeupdate', () => {
    if (!bgAudioEl.duration) return;
    const pct = (bgAudioEl.currentTime / bgAudioEl.duration) * 100;
    document.getElementById('progressBar').style.width = `${pct}%`;
    document.getElementById('voiceTime').textContent = formatSeconds(bgAudioEl.currentTime);
  });
  bgAudioEl.addEventListener('ended', () => {
    document.getElementById('btnVoice').textContent = '▶ Play';
  });
}

function formatSeconds(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

window.toggleVoice = function() {
  if (!bgAudioEl) return;
  if (bgAudioEl.paused) {
    bgAudioEl.play();
    document.getElementById('btnVoice').textContent = '⏸ Pause';
  } else {
    bgAudioEl.pause();
    document.getElementById('btnVoice').textContent = '▶ Play';
  }
};

window.toggleRecording = async function() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    document.getElementById('btnRecord').classList.remove('recording');
    document.getElementById('btnRecord').textContent = '🎙 Rekam Suara';
    document.getElementById('recStatus').classList.add('hidden');
    clearInterval(recTimerInterval);
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
    mediaRecorder.onstop = () => {
      voiceBlobUrl = URL.createObjectURL(new Blob(recordedChunks, { type: 'audio/webm' }));
      setupVoiceAudio();
      document.getElementById('voicePlayer').classList.remove('hidden');
      stream.getTracks().forEach(t => t.stop());
    };

    mediaRecorder.start();
    recSeconds = 0;
    document.getElementById('btnRecord').classList.add('recording');
    document.getElementById('btnRecord').textContent = '⏹ Stop Rekam';
    document.getElementById('recStatus').classList.remove('hidden');
    document.getElementById('recTimer').textContent = '0s';

    recTimerInterval = setInterval(() => {
      recSeconds++;
      document.getElementById('recTimer').textContent = `${recSeconds}s`;
    }, 1000);
  } catch (err) {
    alert('Izin mikrofon diperlukan untuk merekam pesan suara!');
  }
};

window.replayGame = function() {
  document.getElementById('ending-popup').classList.add('hidden');
  if (bgAudioEl) {
    bgAudioEl.pause();
    bgAudioEl = null;
  }
  showScreen('screen-menu');
  hideHUD();
  gameState = 'menu';
};

/* ────────────────────────────────────────────────────────────
   13. CANVAS RENDERING ENGINE
   ──────────────────────────────────────────────────────────── */
function drawBackground() {
  const bgImg = isImgLoaded('bg1') ? IMG['bg1'] : (isImgLoaded('bg2') ? IMG['bg2'] : null);

  if (bgImg) {
    const scale = VH / bgImg.naturalHeight;
    const bgWidth = bgImg.naturalWidth * scale;
    const parallaxOffset = (cameraX * 0.28) % bgWidth;

    for (let dx = -parallaxOffset; dx < VW + bgWidth; dx += bgWidth) {
      ctx.drawImage(bgImg, dx, 0, bgWidth, VH);
    }
  } else {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, VH);
    skyGrad.addColorStop(0, '#2D0A4E');
    skyGrad.addColorStop(0.6, '#6A1B9A');
    skyGrad.addColorStop(1, '#AD1457');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, VW, VH);
  }

  // Floating Clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  const cloudOffsets = [100, 320, 580, 850, 1150, 1500, 1850, 2250, 2650, 3050, 3450];
  cloudOffsets.forEach((ox, i) => {
    const sx = ox - cameraX * 0.35;
    if (sx < -160 || sx > VW + 160) return;
    const cy = 35 + (i % 3) * 28;
    ctx.beginPath();
    ctx.arc(sx + 38, cy, 22, 0, Math.PI * 2);
    ctx.arc(sx + 64, cy - 10, 28, 0, Math.PI * 2);
    ctx.arc(sx + 90, cy, 20, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPlatforms() {
  platforms.forEach(p => {
    const sx = p.x - cameraX;
    if (sx + p.w < -100 || sx > VW + 100) return;

    if (p.type === 'ground') {
      if (isImgLoaded('ground')) {
        const gImg = IMG['ground'];
        const tileW = Math.round(p.h * (gImg.naturalWidth / gImg.naturalHeight));
        for (let gx = sx; gx < sx + p.w; gx += tileW) {
          const clipW = Math.min(tileW, sx + p.w - gx);
          ctx.drawImage(
            gImg,
            0, 0, gImg.naturalWidth * (clipW / tileW), gImg.naturalHeight,
            gx, p.y, clipW, p.h
          );
        }
      } else {
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(sx, p.y, p.w, 16);
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(sx, p.y + 16, p.w, p.h - 16);
      }
    } else {
      // Floating Platform
      if (isImgLoaded('floatPlat')) {
        const fImg = IMG['floatPlat'];
        ctx.drawImage(fImg, sx, p.y, p.w, p.h);
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(sx + 4, p.y + p.h + 2, p.w, 6);
        ctx.fillStyle = '#66BB6A';
        ctx.fillRect(sx, p.y, p.w, 10);
        ctx.fillStyle = '#8D6E63';
        ctx.fillRect(sx, p.y + 10, p.w, p.h - 10);
      }
    }
  });
}

function drawCoins() {
  coins.forEach(c => {
    if (c.collected) return;
    const sx = c.x - cameraX;
    if (sx < -40 || sx > VW + 40) return;

    const bob = Math.sin(globalTick * 0.08 + c.x * 0.01) * 4;

    ctx.save();
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(sx + 12, c.y + 12 + bob, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFF9C4';
    ctx.beginPath();
    ctx.arc(sx + 10, c.y + 10 + bob, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawKeyItem() {
  if (keyItem.collected) return;
  const sx = keyItem.x - cameraX;
  if (sx < -80 || sx > VW + 80) return;

  const bob = Math.sin(globalTick * 0.08) * 6;

  ctx.save();
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 20;

  if (isImgLoaded('key')) {
    ctx.drawImage(IMG['key'], sx, keyItem.y + bob, keyItem.w, keyItem.h);
  } else {
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(sx + 16, keyItem.y + 12 + bob, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(sx + 14, keyItem.y + 20 + bob, 5, 16);
    ctx.fillRect(sx + 14, keyItem.y + 28 + bob, 10, 5);
  }
  ctx.restore();

  // Floating text label
  ctx.save();
  ctx.font = `bold ${Math.round(TH * 0.28)}px Fredoka, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD700';
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 10;
  ctx.fillText('▼ KUNCI EMAS!', sx + keyItem.w / 2, keyItem.y - 10 + Math.sin(globalTick * 0.1) * 4);
  ctx.restore();
}

function drawCageAndAndri() {
  const sx = cageDoor.x - cameraX;
  if (sx < -160 || sx > VW + 160) return;

  const andriX = princeAndri.x - cameraX;
  const andriY = princeAndri.y;
  const bob = Math.sin(globalTick * 0.06) * 3;

  // 1. Draw Prince Andri
  const andriWalkCycle = ['andri_walk1', 'andri_walk2', 'andri_walk3'];
  const andriKey = isImgLoaded(andriWalkCycle[Math.floor(globalTick / 12) % 3])
    ? andriWalkCycle[Math.floor(globalTick / 12) % 3]
    : 'andri_idle';

  if (isImgLoaded(andriKey)) {
    ctx.drawImage(IMG[andriKey], andriX, andriY + bob, princeAndri.w, princeAndri.h);
  } else {
    // Fallback chibi Andri
    ctx.fillStyle = '#FFE0B2';
    ctx.beginPath();
    ctx.arc(andriX + princeAndri.w / 2, andriY + 20 + bob, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5C6BC0';
    ctx.fillRect(andriX + 6, andriY + 36 + bob, princeAndri.w - 12, 32);
    ctx.font = '18px serif';
    ctx.fillText('👑', andriX + princeAndri.w / 2 - 10, andriY + 12 + bob);
  }

  // 2. Draw Cage over Andri (if still locked)
  if (!hasKey) {
    if (isImgLoaded('cage')) {
      ctx.drawImage(IMG['cage'], sx, cageDoor.y, cageDoor.w, cageDoor.h);
    } else {
      ctx.fillStyle = 'rgba(60, 30, 0, 0.85)';
      ctx.fillRect(sx, cageDoor.y, cageDoor.w, cageDoor.h);
      ctx.fillStyle = '#FFD54F';
      for (let bx = sx; bx <= sx + cageDoor.w; bx += 12) {
        ctx.fillRect(bx, cageDoor.y, 4, cageDoor.h);
      }
    }

    // Lock icon & text
    ctx.save();
    ctx.font = `bold ${Math.round(TH * 0.28)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF4081';
    ctx.shadowColor = '#FF4081';
    ctx.shadowBlur = 10;
    ctx.fillText('🔒 BUTUH KUNCI!', sx + cageDoor.w / 2, cageDoor.y - 12 + Math.sin(globalTick * 0.08) * 3);
    ctx.restore();
  } else {
    // Unlocked!
    ctx.save();
    ctx.font = `bold ${Math.round(TH * 0.28)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#69F0AE';
    ctx.shadowColor = '#69F0AE';
    ctx.shadowBlur = 10;
    ctx.fillText('🔓 BUKA SANGKAR!', sx + cageDoor.w / 2, cageDoor.y - 12 + Math.sin(globalTick * 0.08) * 3);
    ctx.restore();
  }

  // 3. Birthday Cake in celebration
  if (gameState === 'ending') {
    const cakeW = Math.round(TH * 1.1);
    const cakeH = Math.round(TH * 1.1);
    const cakeBob = Math.sin(globalTick * 0.12) * 5;

    if (isImgLoaded('cake')) {
      ctx.drawImage(IMG['cake'], andriX + princeAndri.w / 2 - cakeW / 2, andriY - cakeH - 10 + cakeBob, cakeW, cakeH);
    } else {
      ctx.font = '36px serif';
      ctx.textAlign = 'center';
      ctx.fillText('🎂', andriX + princeAndri.w / 2, andriY - 15 + cakeBob);
    }
  }
}

function drawPlayerCharacter() {
  const sx = player.x - cameraX;
  const flip = player.dir === -1;

  ctx.save();

  // Invincible flashing
  if (player.invincible > 0 && Math.floor(player.invincible / 6) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }

  // Select sprite frame
  let spriteKey = 'ikah_idle';
  if (!player.onGround) {
    spriteKey = 'ikah_jump';
  } else if (player.vx !== 0) {
    const runCycle = ['ikah_run1', 'ikah_run2', 'ikah_run3'];
    spriteKey = runCycle[player.runFrame];
  }

  if (isImgLoaded(spriteKey)) {
    ctx.save();
    if (flip) {
      ctx.translate(sx + player.w, player.y);
      ctx.scale(-1, 1);
      ctx.drawImage(IMG[spriteKey], 0, 0, player.w, player.h);
    } else {
      ctx.drawImage(IMG[spriteKey], sx, player.y, player.w, player.h);
    }
    ctx.restore();
  } else {
    // Fallback cute chibi princess
    ctx.save();
    ctx.translate(sx + (flip ? player.w : 0), player.y);
    ctx.scale(flip ? -1 : 1, 1);

    // Head
    ctx.fillStyle = '#FFE0B2';
    ctx.beginPath();
    ctx.arc(player.w / 2, player.h * 0.3, player.w * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Dress
    ctx.fillStyle = '#FF4081';
    ctx.beginPath();
    ctx.moveTo(player.w * 0.15, player.h);
    ctx.lineTo(player.w * 0.85, player.h);
    ctx.lineTo(player.w * 0.65, player.h * 0.45);
    ctx.lineTo(player.w * 0.35, player.h * 0.45);
    ctx.closePath();
    ctx.fill();

    // Crown
    ctx.font = `${Math.round(player.w * 0.45)}px serif`;
    ctx.fillText('👑', player.w * 0.25, player.h * 0.2);

    ctx.restore();
  }

  ctx.restore();
}

function drawEnemies() {
  enemies.forEach(en => {
    if (!en.alive) return;
    const sx = en.x - cameraX;
    if (sx < -80 || sx > VW + 80) return;

    const bob = Math.sin(globalTick * 0.16 + en.x * 0.01) * 3;
    const flip = en.dir === -1;
    const mKey = `monster${en.variant}`;

    if (isImgLoaded(mKey)) {
      ctx.save();
      if (flip) {
        ctx.translate(sx + en.w, en.y + bob);
        ctx.scale(-1, 1);
        ctx.drawImage(IMG[mKey], 0, 0, en.w, en.h);
      } else {
        ctx.drawImage(IMG[mKey], sx, en.y + bob, en.w, en.h);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = '#D32F2F';
      ctx.beginPath();
      ctx.arc(sx + en.w / 2, en.y + en.h / 2 + bob, en.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `${Math.round(en.w * 0.6)}px serif`;
      ctx.fillText('👾', sx + 4, en.y + en.h * 0.7 + bob);
    }
  });
}

function drawGameOverScreen() {
  ctx.fillStyle = 'rgba(10, 0, 25, 0.82)';
  ctx.fillRect(0, 0, VW, VH);

  const cx = VW / 2;
  const cy = VH / 2;
  const fontSize = Math.min(56, Math.round(VW * 0.09));

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `bold ${fontSize}px Fredoka, sans-serif`;
  ctx.fillStyle = '#FF4081';
  ctx.shadowColor = '#FF4081';
  ctx.shadowBlur = 25;
  ctx.fillText('GAME OVER', cx, cy - fontSize * 0.6);

  ctx.shadowBlur = 0;
  ctx.font = `700 ${Math.round(fontSize * 0.45)}px Fredoka, sans-serif`;
  ctx.fillStyle = '#FFD54F';
  ctx.fillText(`Score Akhir: ${score}`, cx, cy + fontSize * 0.4);

  ctx.font = `600 ${Math.round(fontSize * 0.35)}px Fredoka, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('Tap / Klik di mana saja untuk Coba Lagi', cx, cy + fontSize * 1.5);
  ctx.restore();

  canvas.onclick = () => {
    canvas.onclick = null;
    startGame();
  };
}

/* ────────────────────────────────────────────────────────────
   14. MAIN GAME LOOP
   ──────────────────────────────────────────────────────────── */
function gameLoop() {
  if (gameState === 'ending') {
    return; // Handled by birthday celebration popup
  }

  globalTick++;

  // Clear Canvas
  ctx.clearRect(0, 0, VW, VH);

  // Draw Layers
  drawBackground();

  if (gameState === 'gameover') {
    drawGameOverScreen();
    requestAnimationFrame(gameLoop);
    return;
  }

  if (gameState !== 'playing') {
    requestAnimationFrame(gameLoop);
    return;
  }

  drawPlatforms();
  drawCageAndAndri();
  drawKeyItem();
  drawCoins();

  updateEnemies();
  drawEnemies();

  updatePlayer();
  drawPlayerCharacter();

  requestAnimationFrame(gameLoop);
}

/* ────────────────────────────────────────────────────────────
   15. INITIAL BOOTSTRAP
   ──────────────────────────────────────────────────────────── */
generateStars();
showScreen('screen-menu');
gameState = 'menu';
requestAnimationFrame(gameLoop);
