// 8bit.cafe VJ: a pixel-art night club scene. Everything is drawn from
// hand-made sprite maps and one 16-colour palette (Sweetie 16) with no
// alpha and no smoothing, then scaled by a whole number so every art pixel
// is a square block of device pixels.

const BASE_HEIGHT = 180;

const PAL = {
  k: "#1a1c2c",
  p: "#5d275d",
  r: "#b13e53",
  o: "#ef7d57",
  y: "#ffcd75",
  g: "#a7f070",
  G: "#38b764",
  t: "#257179",
  n: "#29366f",
  b: "#3b5dc9",
  c: "#41a6f6",
  C: "#73eff7",
  w: "#f4f4f4",
  s: "#94b0c2",
  S: "#566c86",
  d: "#333c57",
};

// Light and dark palette keys for each accent hue.
const HUES = {
  cyan: ["C", "t"],
  green: ["g", "G"],
  gold: ["y", "o"],
  blue: ["c", "b"],
  coral: ["o", "r"],
};

export const ACCENT_PAIRS = [
  ["cyan", "coral"],
  ["green", "cyan"],
  ["gold", "coral"],
  ["blue", "gold"],
  ["coral", "cyan"],
  ["green", "gold"],
  ["cyan", "green"],
].map(([a, b]) => [PAL[HUES[a][0]], PAL[HUES[b][0]]]);

// ------------------------------------------------------------------ sprites
// "." is transparent. A/Z are the track accent (light/dark), B/X the
// alternate accent. Every other letter is a palette key.

const HEAD = [
  "....kkkkkkkk....",
  "...kAAAAAAAAk...",
  "..kAkkkkkkkkAk..",
  "..kAkddddddkAk..",
  ".kkkddddddddkkk.",
  "kZZkdyyyyyydkZZk",
  "kAZkyyyyyyyykZAk",
  "kAZkywkyywkykZAk",
  "kAZkykkyykkykZAk",
  "kZZkyyyyyyyykZZk",
  ".kkkoyyrryyokkk.",
  "...kyyyyyyyyk...",
  "....kkyyyykk....",
  "......kyyk......",
];

const HEAD_SING = [
  "....kkkkkkkk....",
  "...kAAAAAAAAk...",
  "..kAkkkkkkkkAk..",
  "..kAkddddddkAk..",
  ".kkkddddddddkkk.",
  "kZZkdyyyyyydkZZk",
  "kAZkyyyyyyyykZAk",
  "kAZkykkyykkykZAk",
  "kAZkyyyyyyyykZAk",
  "kZZkyyykkyyykZZk",
  ".kkkoyykrkyokkk.",
  "...kyyykkyyyk...",
  "....kkyyyykk....",
  "......kyyk......",
];

const TORSO = [
  "........kkkkkkkk........",
  "......kkBBByyBBBkk......",
  "....kkBBBBBkkBBBBBkk....",
  "...kBBBBBBwBBwBBBBBBk...",
  "..kBBXBBBBwBBwBBBBXBBk..",
  ".kBBXkBBBBBBBBBBBBkXBBk.",
  ".kBXk.kBBBBBBBBBBk.kXBk.",
  "kBBXk.kBBBBBBBBBBk.kXBBk",
  "kBXk..kXBBBBBBBBXk..kXBk",
  "kyyk..kXXXXXXXXXXk..kyyk",
  "kyyk..kkkkkkkkkkkk..kyyk",
  ".kk..................kk.",
];

const TORSO_ARM_UP = [
  "........kkkkkkkk........",
  "......kkBBByyBBBkk......",
  "....kkBBBBBkkBBBBBkk....",
  "...kBBBBBBwBBwBBBBBBk...",
  "..kBBXBBBBwBBwBBBBBBk...",
  ".kBBXkBBBBBBBBBBBBBk....",
  ".kBXk.kBBBBBBBBBBBk.....",
  "kBBXk.kBBBBBBBBBBBk.....",
  "kBXk..kXBBBBBBBBBXk.....",
  "kyyk..kXXXXXXXXXXXk.....",
  "kyyk..kkkkkkkkkkkkk.....",
  ".kk.....................",
];

const ARM_UP = [
  ".kkkk.",
  "kyyyyk",
  "kyywyk",
  "kyyyyk",
  ".kkkk.",
  ".kBBk.",
  ".kBXk.",
  ".kBXk.",
  ".kBXk.",
  "kBBXk.",
  "kBBXk.",
  "kBXk..",
  "kBXk..",
  "kBXk..",
];

const SPEAKER = [
  "kkkkkkkkkkkkkk",
  "kSdddddddddddk",
  "kdddddkkdddddk",
  "kddddkwskddddk",
  "kddddksskddddk",
  "kdddddkkdddddk",
  "kddddddddddddk",
  "kdddkkkkkkdddk",
  "kddkSSSSSSkddk",
  "kdkSSkkkkSSkdk",
  "kdkSkddddkSkdk",
  "kdkSkdZZdkSkdk",
  "kdkSkdZZdkSkdk",
  "kdkSkddddkSkdk",
  "kdkSSkkkkSSkdk",
  "kddkSSSSSSkddk",
  "kdddkkkkkkdddk",
  "kddddddddddddk",
  "kdkkkkkkkkkkdk",
  "kddddddddddddk",
  "kkkkkkkkkkkkkk",
];

// The woofer pushes out on the beat: brighter cone, lit dust cap.
const SPEAKER_PUMP = SPEAKER.map((row, y) => {
  if (y < 8 || y > 15) return row;
  let out = row.slice(0, 3) + row.slice(3, 11).replace(/S/g, "s") + row.slice(11);
  if (y >= 10 && y <= 13) out = out.slice(0, 5) + "AAAA" + out.slice(9);
  return out;
});

const SPOT = [
  "kkkkk",
  "kSSSk",
  "kAAAk",
  ".kkk.",
];

const SPOT_OFF = [
  "kkkkk",
  "kSSSk",
  "kdddk",
  ".kkk.",
];

const CAT = [
  ".k........k.",
  "kok......kok",
  "koykkkkkkyok",
  "kooooooooook",
  "kokkooookkok",
  "kowkoooowkok",
  "koooykkyoook",
  ".kooooooook.",
  "..kkkkkkkk..",
  ".kBBBBBBBBk.",
  "kokBBBBBBkok",
  ".k.kBBBBk.k.",
  "...kXkkXk...",
  "...kk..kk...",
];

const CAT_JUMP = [
  ".k........k.",
  "kok......kok",
  "koykkkkkkyok",
  "kooooooooook",
  "kokkooookkok",
  "kowkoooowkok",
  "koooykkyoook",
  ".kooooooook.",
  "o.kkkkkkkk.o",
  "okBBBBBBBBko",
  ".kBBBBBBBBk.",
  "..kBBBBBBk..",
  "..kXk..kXk..",
  "............",
];

const ROBOT = [
  ".....kk.....",
  ".....kAk....",
  "..kkkkkkkk..",
  ".kssssssssk.",
  ".ksAAssAAsk.",
  ".ksAAssAAsk.",
  ".kssssssssk.",
  ".ksskkkkssk.",
  ".kSSSSSSSSk.",
  "..kkkkkkkk..",
  "kSkddBBddkSk",
  "kSkddddddkSk",
  ".k.kdkkdk.k.",
  "...kk..kk...",
];

const ROBOT_JUMP = [
  ".....kk.....",
  "....kAk.....",
  "..kkkkkkkk..",
  ".kssssssssk.",
  ".ksAAssAAsk.",
  ".ksAAssAAsk.",
  ".kssssssssk.",
  ".kssskksssk.",
  "SkSSSSSSSSkS",
  "Skkkkkkkkkks",
  ".kkddBBddkk.",
  "...kddddk...",
  "..kdk..kdk..",
  "............",
];

const SLIME = [
  "............",
  "............",
  "............",
  "............",
  ".....kk.....",
  "....kGGk....",
  "...kGggGk...",
  "..kGgwgGGk..",
  ".kGGggGGGGk.",
  ".kGkkGGkkGk.",
  "kGGkwGGkwGGk",
  "kGGGGrrGGGGk",
  "kGGGGGGGGGGk",
  ".kkkkkkkkkk.",
];

const SLIME_JUMP = [
  ".....kk.....",
  "....kGGk....",
  "...kGggGk...",
  "...kgwgGk...",
  "..kGggGGGk..",
  "..kGkkGkkGk.",
  "..kGkwGkwGk.",
  "..kGGGrrGGk.",
  "..kGGGGGGGk.",
  "...kGGGGGk..",
  "....kkkkk...",
  "............",
  "............",
  "............",
];

const GHOST = [
  "...kkkkkk...",
  "..kwwwwwwk..",
  ".kwwwwwwwwk.",
  ".kwkkwwkkwk.",
  ".kwkkwwkkwk.",
  ".kwwwwwwwwk.",
  "kswwwkkwwwsk",
  "kswwwkkwwwsk",
  "kswwwwwwwwsk",
  ".kswwwwwwsk.",
  ".kssswwsssk.",
  ".kssksskssk.",
  ".kk.kk.kk.k.",
  "............",
];

const GHOST_JUMP = [
  "...kkkkkk...",
  "..kwwwwwwk..",
  ".kwwwwwwwwk.",
  ".kwkkwwkkwk.",
  ".kwkkwwkkwk.",
  "kswwwwwwwwsk",
  "kswwwkkwwwsk",
  ".kwwwkkwwwk.",
  ".kswwwwwwsk.",
  ".kssswwsssk.",
  ".ksskssksk..",
  "..kk.kk.kk..",
  "............",
  "............",
];

const CROWD = [
  [CAT, CAT_JUMP],
  [ROBOT, ROBOT_JUMP],
  [SLIME, SLIME_JUMP],
  [GHOST, GHOST_JUMP],
];

const NOTE = [
  "..AA.",
  "..A.A",
  "..A..",
  "..A..",
  "AAA..",
  "AAA..",
];

const NOTES = [
  "..AAAAA",
  "..A...A",
  "..A...A",
  "AAA.AAA",
  "AAA.AAA",
];

const CLOUD = [
  ".......SSSS.........",
  "....SSSSSSSSS.SSS...",
  "..SSSSSSSSSSSSSSSSS.",
  ".ddSSSSSSSSSSSSSSddd",
  "ddddddddddddddddddd.",
  "..dddddd...ddddd....",
];

const GLYPHS = {
  "8": ["AAA", "A.A", "AAA", "A.A", "AAA"],
  B: ["AA.", "A.A", "AA.", "A.A", "AA."],
  I: ["AAA", ".A.", ".A.", ".A.", "AAA"],
  T: ["AAA", ".A.", ".A.", ".A.", ".A."],
  ".": ["...", "...", "...", "...", ".A."],
  C: [".AA", "A..", "A..", "A..", ".AA"],
  A: [".A.", "A.A", "AAA", "A.A", "A.A"],
  F: ["AAA", "A..", "AA.", "A..", "A.."],
  E: ["AAA", "A..", "AA.", "A..", "AAA"],
};

const SIGN = "8BIT.CAFE";

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// -------------------------------------------------------------------- state

const art = {
  canvas: null,
  g: null,
  W: 0,
  H: 0,
  cssScale: 0,
  focusX: 0,
  groundY: 0,
  layoutKey: "",
  sky: null,
  stars: [],
  back: [],
  front: [],
  clouds: [],
  notes: [],
  accents: { A: "C", Z: "t", B: "o", X: "r" },
  accentKey: "Ctor",
  cache: new Map(),
  lastLayoutAt: 0,
  lastBeat: -1,
  flicker: -1,
};

function hash(a, b = 0, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function color(key) {
  return PAL[art.accents[key] || key];
}

function sprite(rows) {
  const id = rows.join("|") + art.accentKey;
  let cached = art.cache.get(id);
  if (cached) return cached;
  cached = document.createElement("canvas");
  cached.width = rows[0].length;
  cached.height = rows.length;
  const g = cached.getContext("2d");
  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      const ch = rows[y][x];
      if (ch === ".") continue;
      g.fillStyle = color(ch);
      g.fillRect(x, y, 1, 1);
    }
  }
  art.cache.set(id, cached);
  return cached;
}

function blit(rows, x, y) {
  art.g.drawImage(sprite(rows), Math.round(x), Math.round(y));
}

function px(x, y, w, h, key) {
  art.g.fillStyle = color(key);
  art.g.fillRect(Math.round(x), Math.round(y), w, h);
}

export function setAccents(accentHex, altHex) {
  const find = (hex, fallback) => {
    const wanted = String(hex || "").toLowerCase();
    for (const pair of Object.values(HUES)) {
      if (PAL[pair[0]] === wanted) return pair;
    }
    return fallback;
  };
  const a = find(accentHex, HUES.cyan);
  let b = find(altHex, HUES.coral);
  if (b === a) b = a === HUES.coral ? HUES.cyan : HUES.coral;
  art.accents = { A: a[0], Z: a[1], B: b[0], X: b[1] };
  art.accentKey = a[0] + a[1] + b[0] + b[1];
}

// ------------------------------------------------------------------ layout

export function attach(canvas) {
  if (art.canvas === canvas && art.g) return true;
  if (!canvas) return false;
  art.canvas = canvas;
  art.g = canvas.getContext("2d");
  art.layoutKey = "";
  layout();
  return true;
}

function layout() {
  const canvas = art.canvas;
  const frame = canvas.parentElement || canvas;
  const box = frame.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return;
  const dpr = window.devicePixelRatio || 1;
  const deviceScale = Math.max(2, Math.round((box.height * dpr) / BASE_HEIGHT));
  const cssScale = deviceScale / dpr;
  const W = Math.ceil(box.width / cssScale);
  const H = Math.ceil(box.height / cssScale);

  // Put the stage in the open space between the cards, and keep the
  // booth above whichever card would hide it.
  const now = document.querySelector(".now-card");
  const next = document.querySelector(".next-card");
  const nowBox = now ? now.getBoundingClientRect() : null;
  const nextBox = next ? next.getBoundingClientRect() : null;
  let focusPx = box.left + box.width / 2;
  let floorPx = box.top + box.height * 0.72;
  if (nowBox && nextBox && nextBox.left > nowBox.right + 40) {
    focusPx = (nowBox.right + nextBox.left) / 2;
    floorPx = Math.min(floorPx, nextBox.top - 4);
  } else if (nowBox && nowBox.top < box.bottom) {
    floorPx = Math.min(floorPx, nowBox.top - 6);
  }
  const focusX = Math.round(Math.min(Math.max((focusPx - box.left) / cssScale, 44), W - 44));
  const groundY = Math.round(Math.min(Math.max((floorPx - box.top) / cssScale, 84), H - 12));

  const key = [W, H, cssScale, focusX, groundY].join(":");
  if (key === art.layoutKey) return;
  const sizeChanged = W !== art.W || H !== art.H || cssScale !== art.cssScale;
  art.layoutKey = key;
  art.W = W;
  art.H = H;
  art.cssScale = cssScale;
  art.focusX = focusX;
  art.groundY = groundY;

  if (sizeChanged) {
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W * cssScale}px`;
    canvas.style.height = `${H * cssScale}px`;
  }
  art.g.imageSmoothingEnabled = false;
  buildSky();
  buildSkyline();
}

function buildSky() {
  const { W, groundY } = art;
  const sky = document.createElement("canvas");
  sky.width = W;
  sky.height = groundY;
  const g = sky.getContext("2d");
  // Top to horizon: ink, navy, plum, with ordered dithering between bands.
  const bands = ["k", "n", "p"];
  const edges = [0.34, 0.68];
  const blend = 0.24;
  for (let y = 0; y < groundY; y += 1) {
    const f = y / groundY;
    for (let x = 0; x < W; x += 1) {
      let band = 0;
      for (let i = 0; i < edges.length; i += 1) {
        const start = edges[i] - blend / 2;
        if (f >= edges[i] + blend / 2) band = i + 1;
        else if (f > start) {
          const t = (f - start) / blend;
          band = BAYER[y % 4][x % 4] / 16 < t ? i + 1 : i;
          break;
        }
      }
      g.fillStyle = PAL[bands[band]];
      g.fillRect(x, y, 1, 1);
    }
  }
  art.sky = sky;

  const random = seeded(5021 + W);
  const count = Math.round((W * groundY) / 260);
  art.stars = Array.from({ length: count }, () => ({
    x: Math.floor(random() * W),
    y: Math.floor(random() * groundY * 0.6),
    big: random() < 0.12,
    phase: Math.floor(random() * 9),
    rate: 1 + Math.floor(random() * 3),
  }));
  art.clouds = [
    { y: Math.round(groundY * 0.16), speed: 2, offset: 30 },
    { y: Math.round(groundY * 0.3), speed: 3, offset: Math.round(W * 0.55) },
    { y: Math.round(groundY * 0.44), speed: 1, offset: Math.round(W * 0.85) },
  ];
}

function buildSkyline() {
  const { W, groundY } = art;
  const random = seeded(77 + W);
  const make = (minH, maxH, minW, maxW, windows) => {
    const list = [];
    let x = -Math.floor(random() * 8);
    while (x < W) {
      const w = minW + Math.floor(random() * (maxW - minW));
      const h = minH + Math.floor(random() * (maxH - minH));
      const building = { x, w, h, antenna: random() < 0.3, lights: [] };
      if (windows) {
        for (let wy = groundY - h + 3; wy < groundY - 8; wy += 3) {
          for (let wx = x + 2; wx < x + w - 2; wx += 3) {
            if (random() < 0.55) building.lights.push({ x: wx, y: wy, seed: Math.floor(random() * 1e6) });
          }
        }
      }
      list.push(building);
      x += w + (random() < 0.3 ? 1 + Math.floor(random() * 3) : 0);
    }
    return list;
  };
  const scale = groundY / 126;
  art.back = make(Math.round(26 * scale), Math.round(58 * scale), 8, 20, false);
  art.front = make(Math.round(12 * scale), Math.round(36 * scale), 10, 26, true);
}

// -------------------------------------------------------------------- draw

function drawStars(step, energy) {
  for (const star of art.stars) {
    const phase = (Math.floor(step / (2 + star.rate)) + star.phase) % 9;
    if (phase === 0) continue;
    const bright = phase > 5 ? "w" : phase > 2 ? "s" : "S";
    px(star.x, star.y, 1, 1, bright);
    if (star.big && energy.high > 0.35 && phase > 4) {
      px(star.x - 1, star.y, 1, 1, "S");
      px(star.x + 1, star.y, 1, 1, "S");
      px(star.x, star.y - 1, 1, 1, "S");
      px(star.x, star.y + 1, 1, 1, "S");
    }
  }
}

function drawMoon(beats) {
  const cx = art.W - Math.max(28, Math.round(art.W * 0.12));
  const cy = Math.round(art.groundY * 0.2);
  const r = 9;
  // Dithered glow ring that shifts phase on each beat.
  for (let y = -r - 4; y <= r + 4; y += 1) {
    for (let x = -r - 4; x <= r + 4; x += 1) {
      const d = Math.sqrt(x * x + y * y);
      if (d > r + 0.5 && d <= r + 3.5 && (x + y + beats) % 2 === 0) px(cx + x, cy + y, 1, 1, "p");
    }
  }
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      const d = Math.sqrt(x * x + y * y);
      if (d > r + 0.5) continue;
      let key = "y";
      if (x + y > r * 0.75 && d > r - 2.5) key = "o";
      if (x + y < -r * 0.9 && d > r - 2) key = "w";
      px(cx + x, cy + y, 1, 1, key);
    }
  }
  const craters = [[-3, -1, 2], [2, 2, 3], [3, -4, 1], [-2, 4, 1]];
  for (const [x, y, size] of craters) px(cx + x, cy + y, size, size === 3 ? 2 : size, "o");
}

function drawClouds(time) {
  const span = art.W + CLOUD[0].length * 2;
  for (const cloud of art.clouds) {
    const x = ((cloud.offset + Math.floor(time * cloud.speed)) % span) - CLOUD[0].length;
    blit(CLOUD, x, cloud.y);
  }
}

function drawSkyline(step, beats, energy) {
  const { groundY } = art;
  for (const b of art.back) px(b.x, groundY - b.h, b.w, b.h, "d");
  for (const b of art.back) px(b.x, groundY - b.h, b.w, 1, "S");
  for (const b of art.front) {
    px(b.x, groundY - b.h, b.w, b.h, "k");
    px(b.x, groundY - b.h, b.w, 1, "d");
    if (b.antenna) {
      const ax = b.x + Math.floor(b.w / 2);
      px(ax, groundY - b.h - 6, 1, 6, "S");
      if (Math.floor(step / 6) % 2 === 0) px(ax, groundY - b.h - 7, 1, 1, "r");
    }
    const lit = 0.18 + energy.mid * 0.32;
    for (const light of b.lights) {
      const roll = hash(light.seed, Math.floor(beats / 4));
      if (roll > lit) continue;
      px(light.x, light.y, 2, 1, roll < 0.03 ? "C" : roll < lit * 0.4 ? "o" : "y");
    }
  }
}

function drawFloor(beats) {
  const { W, H, groundY } = art;
  px(0, groundY, W, H - groundY, "k");
  const tileW = 10;
  const tileH = 4;
  for (let row = 0; groundY + 1 + row * (tileH + 1) < H; row += 1) {
    const y = groundY + 1 + row * (tileH + 1);
    const shift = row % 2 ? 5 : 0;
    for (let col = -1; col * (tileW + 1) < W; col += 1) {
      const x = col * (tileW + 1) + shift;
      const roll = hash(col + 100, row, beats);
      const key = roll < 0.07 ? "A" : roll < 0.11 ? "B" : roll < 0.16 ? "p" : (col + row) % 2 ? "d" : "n";
      px(x, y, tileW, tileH, key);
    }
  }
}

function drawBeams(time, beats) {
  const { H } = art;
  const lights = stageLights();
  lights.forEach((light, index) => {
    if ((beats + index) % 2 === 0) return;
    const swing = Math.sin(time * 0.9 + index * 1.7) * 0.55;
    const key = index % 2 ? "B" : "A";
    for (let y = light.y + 4; y < H; y += 1) {
      const depth = y - light.y;
      const center = light.x + 2 + depth * swing;
      const half = 1 + depth * 0.18;
      for (let x = Math.round(center - half); x <= Math.round(center + half); x += 1) {
        if ((x + y) % 2 === 0 && y % 2 === 0) px(x, y, 1, 1, key);
      }
    }
  });
}

function stageLights() {
  const fx = art.focusX;
  const trussY = art.groundY - 62;
  return [-30, -10, 10, 30].map((dx) => ({ x: fx + dx - 2, y: trussY + 4 }));
}

function drawTurntable(x, y, time, energy, spinning) {
  // Plinth.
  px(x, y, 20, 7, "k");
  px(x + 1, y + 1, 18, 5, "S");
  px(x + 1, y + 1, 18, 1, "s");
  // Platter: a pixel ellipse with grooves and an accent label.
  const cx = x + 8;
  const cy = y + 3;
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -7; dx <= 7; dx += 1) {
      const d = (dx / 7.4) ** 2 + (dy / 2.6) ** 2;
      if (d > 1) continue;
      const ring = Math.floor(d * 4);
      px(cx + dx, cy + dy, 1, 1, ring === 0 ? "A" : ring % 2 ? "k" : "d");
    }
  }
  const angle = spinning ? time * (3.2 + energy.mid * 2) : 2.2;
  px(cx + Math.round(Math.cos(angle) * 5), cy + Math.round(Math.sin(angle) * 2), 1, 1, "w");
  // Tone arm.
  px(x + 17, y + 1, 1, 1, "w");
  px(x + 16, y + 2, 1, 2, "s");
  px(x + 15, y + 4, 1, 1, "s");
}

function drawStage(time, step, beats, energy, beatAge, decks) {
  const fx = art.focusX;
  const gy = art.groundY;
  const trussY = gy - 62;
  const pump = beatAge < 0.12;

  // Truss and posts.
  px(fx - 42, trussY, 2, 62 - 6, "S");
  px(fx + 40, trussY, 2, 62 - 6, "S");
  px(fx - 44, trussY, 88, 4, "k");
  px(fx - 44, trussY, 88, 1, "S");
  px(fx - 44, trussY + 3, 88, 1, "S");
  for (let x = fx - 44; x < fx + 44; x += 4) {
    px(x + 1, trussY + 1, 1, 1, "S");
    px(x + 2, trussY + 2, 1, 1, "S");
  }
  stageLights().forEach((light, index) => {
    blit((beats + index) % 2 === 0 ? SPOT_OFF : SPOT, light.x, light.y);
  });

  // Platform.
  px(fx - 44, gy - 6, 88, 6, "d");
  px(fx - 44, gy - 6, 88, 1, "s");
  px(fx - 44, gy - 5, 88, 1, "A");
  px(fx - 44, gy - 1, 88, 1, "k");
  for (let x = fx - 42; x < fx + 42; x += 6) px(x, gy - 3, 2, 1, (x + beats) % 4 ? "S" : "B");

  // Speakers.
  blit(pump ? SPEAKER_PUMP : SPEAKER, fx - 41, gy - 27);
  blit(pump ? SPEAKER_PUMP : SPEAKER, fx + 27, gy - 27);

  // DJ.
  const nod = beatAge < 0.16 ? 1 : 0;
  const armUp = Math.floor(beats / 4) % 4 === 3;
  const torsoX = fx - 12;
  const torsoY = gy - 40;
  blit(armUp ? TORSO_ARM_UP : TORSO, torsoX, torsoY + nod);
  blit(beats % 2 === 0 && beatAge < 0.2 ? HEAD_SING : HEAD, torsoX + 4, torsoY - 12 + nod);
  if (armUp) blit(ARM_UP, torsoX + 19, torsoY - 9 + (Math.floor(step / 3) % 2));

  // Decks and mixer on the booth.
  drawTurntable(fx - 22, gy - 30, time, energy, decks.a);
  drawTurntable(fx + 3, gy - 30, time + 1.3, energy, decks.b);
  // Mixer with the crossfader: left is deck A, right is deck B.
  px(fx - 2, gy - 29, 5, 6, "k");
  px(fx - 1, gy - 28, 3, 4, "d");
  px(fx - 1 + Math.round(decks.fader * 2), gy - 25, 1, 1, "w");
  px(fx, gy - 28, 1, 1, beatAge < 0.1 ? "B" : "S");

  // Booth front: neon sign and VU meter.
  px(fx - 24, gy - 24, 48, 18, "k");
  px(fx - 23, gy - 24, 46, 2, "s");
  px(fx - 23, gy - 22, 46, 15, "d");
  const signX = fx - Math.floor((SIGN.length * 4 - 1) / 2);
  for (let i = 0; i < SIGN.length; i += 1) {
    if (i === art.flicker && step % 4 < 2) continue;
    blit(GLYPHS[SIGN[i]], signX + i * 4, gy - 20);
  }
  const level = Math.min(12, Math.round(energy.level * 18));
  for (let i = 0; i < 12; i += 1) {
    const key = i >= level ? "k" : i < 7 ? "g" : i < 10 ? "y" : "r";
    px(fx - 23 + 2 + i * 4 - 1, gy - 12, 3, 2, key);
  }
}

function drawCrowd(beats, beatAge, step) {
  const { W, H, groundY } = art;
  const rows = [
    { base: groundY + 20, offset: 2 },
    { base: groundY + 34, offset: 9 },
  ];
  rows.forEach((row, rowIndex) => {
    if (row.base - 14 >= H) return;
    for (let x = row.offset - 14, i = 0; x < W; x += 15, i += 1) {
      const kind = Math.floor(hash(i, rowIndex) * CROWD.length);
      const jumping = (i + rowIndex + beats) % 2 === 0 && beatAge < 0.22;
      const sway = Math.floor(step / 6 + i) % 4 === 0 ? 1 : 0;
      const frames = CROWD[kind];
      blit(jumping ? frames[1] : frames[0], x + sway, row.base - 14 - (jumping ? 3 : 0));
    }
  });
}

function drawNotes(time, beats, isNewBeat) {
  const fx = art.focusX;
  const gy = art.groundY;
  if (isNewBeat && beats % 2 === 0) {
    const left = beats % 4 === 0;
    art.notes.push({
      x: left ? fx - 36 : fx + 32,
      y: gy - 34,
      born: time,
      double: beats % 8 === 0,
      key: ["A", "B", "w"][beats % 3],
      drift: left ? -1 : 1,
    });
  }
  art.notes = art.notes.filter((note) => time - note.born < 3);
  for (const note of art.notes) {
    const age = time - note.born;
    if (age > 2.3 && Math.floor(age * 8) % 2 === 0) continue;
    const rows = (note.double ? NOTES : NOTE).map((row) => row.replace(/A/g, note.key));
    const x = note.x + note.drift * Math.floor(age * 4) + (Math.floor(age * 3) % 2);
    blit(rows, x, note.y - Math.floor(age * 12));
  }
}

// Draw one frame. `energy` holds bass/mid/high/level in 0..1, `beats` is a
// running beat counter and `beatAge` the seconds since the latest beat.
export function drawFrame(time, energy, beats, beatAge, decks = { fader: 0, a: true, b: false }) {
  if (!art.g || !art.canvas.isConnected) return false;
  if (time - art.lastLayoutAt > 0.5) {
    art.lastLayoutAt = time;
    layout();
  }
  if (!art.sky) return true;
  const step = Math.floor(time * 12);
  const isNewBeat = beats !== art.lastBeat;
  if (isNewBeat) {
    art.lastBeat = beats;
    art.flicker = beats % 7 === 0 ? beats % SIGN.length : -1;
  }

  art.g.drawImage(art.sky, 0, 0);
  drawStars(step, energy);
  drawMoon(beats);
  drawClouds(time);
  drawSkyline(step, beats, energy);
  drawFloor(beats);
  drawBeams(time, beats);
  drawStage(time, step, beats, energy, beatAge, decks);
  drawCrowd(beats, beatAge, step);
  drawNotes(time, beats, isNewBeat);
  return true;
}

export const spriteSheets = {
  HEAD, HEAD_SING, TORSO, TORSO_ARM_UP, ARM_UP, SPEAKER, SPEAKER_PUMP, SPOT, SPOT_OFF,
  CAT, CAT_JUMP, ROBOT, ROBOT_JUMP, SLIME, SLIME_JUMP, GHOST, GHOST_JUMP, NOTE, NOTES, CLOUD,
  ...Object.fromEntries(Object.entries(GLYPHS).map(([k, v]) => [`GLYPH_${k}`, v])),
};
