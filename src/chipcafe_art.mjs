// Original, hand-drawn indexed sprites. Jev composes these known parts; no
// remote image, generated code, or arbitrary drawing command is executed.
export const ART_WIDTH = 320;
export const ART_HEIGHT = 180;

function direction(scene, title, settings, cast, atmosphere) {
  return Object.freeze({ scene, title, settings, cast, atmosphere });
}

export const ART_DIRECTIONS = Object.freeze({
  cvgm: direction("skyline", "Neon corner",
    { cafe: "Warm cafe with striped awning and outdoor tables", records: "Record shop with vinyl displays and neon sign", bookshop: "Late-night bookshop with window shelves" },
    { commuter: "A commuter walking past a resting cat", friends: "Two friends meeting outside", courier: "A courier and a small delivery robot" },
    { rain: "Gentle rain and pavement reflections", clear: "Clear night with blinking windows", mist: "Low drifting mist" }),
  rainwave: direction("coast", "Harbor afterglow",
    { lighthouse: "Striped lighthouse above a rocky harbor", boathouse: "Timber boathouse on a long wooden pier", lookout: "Palm-shaded lookout above the beach" },
    { fisher: "A fisher and a gull by the water", sailors: "Two sailors meeting at the harbor", cat: "A dockside cat and a resting traveler" },
    { sunset: "Warm sunset and slow rippling water", breeze: "Drifting clouds and a steady sea breeze", stars: "Quiet starlight above the water" }),
  nectarine: direction("forest", "Fernwood clearing",
    { cottage: "Moss-roofed cottage in a fern clearing", shrine: "Old stone shrine surrounded by mushrooms", bridge: "Wooden footbridge across a woodland stream" },
    { fox: "A red fox exploring the undergrowth", ranger: "A ranger and woodland fox", fireflies: "A resting traveler beside a fox" },
    { fireflies: "Fireflies drifting between branches", leaves: "Falling golden leaves", rain: "Light woodland rain" }),
  slay: direction("castle", "Citadel watch",
    { gate: "Portcullis and flanking stone towers", keep: "High keep with banners and torchlit windows", ruins: "Broken arch and ivy-covered battlements" },
    { knight: "A knight guarding the gate", patrol: "Two guards on watch", mage: "A robed mage and a small familiar" },
    { embers: "Sparks rising from the braziers", stars: "Clear moonlit watch", mist: "Mist around the castle stones" }),
  kaaos: direction("handheld", "Pocket valley",
    { terraces: "Grass-topped brick terraces with coins", ruins: "Ancient pillars and a stepped platform", camp: "Tiny cabin and a flag over the valley" },
    { hero: "An adventurer crossing the platforms", robot: "A friendly robot exploring", party: "Two adventurers traveling together" },
    { breeze: "Drifting clouds over the hills", leaves: "Tiny leaves drifting through the valley", stars: "Twinkling collectible stars" }),
  kohina: direction("cosmos", "Orbital outpost",
    { observatory: "Domed observatory overlooking a ringed planet", landing: "Landing pad with a small shuttle", antenna: "Communications station and dish antenna" },
    { astronaut: "An astronaut surveying the outpost", robot: "A service robot on patrol", crew: "An astronaut and a service robot" },
    { stars: "Slowly twinkling distant stars", meteors: "Occasional shooting stars", beacon: "Blinking navigation lights" }),
  "keygen-fm": direction("code-tunnel", "Midnight desk",
    { terminal: "CRT terminal, floppy disks, books and a potted fern", servers: "Terminal desk beside a rack of servers", workshop: "Electronics bench with components and tools" },
    { coder: "A coder at the desk and a sleeping cat", robot: "A small repair robot and a coder", friends: "Two coders sharing the workshop" },
    { rain: "Rain at the window and a blinking cursor", stars: "Starry window and softly blinking screens", beacon: "Busy disk lights on the equipment" }),
  "sid-station": direction("chip-studio", "SID listening room",
    { synth: "Synthesizer, speakers and a CRT sequencer", vinyl: "Turntable, record shelves and speakers", tape: "Reel-to-reel deck and cassette shelves" },
    { musician: "A musician beside the keyboard", duo: "Two musicians rehearsing", cat: "A musician with a studio cat" },
    { rain: "Rain outside the studio window", stars: "Clear night and pulsing equipment lights", beacon: "Steady sequencer lights" }),
  rpgn: direction("overworld", "Wayfarer village",
    { inn: "A welcoming inn beside a winding stone path", mill: "Village windmill above the fields", tower: "Wizard tower among trees and stone walls" },
    { traveler: "An adventurer arriving in the village", party: "Two adventurers on the path", fox: "A traveler and a curious fox" },
    { leaves: "Autumn leaves over the path", breeze: "Clouds passing over the hills", fireflies: "Fireflies around the village" }),
  radiosega: direction("turbo-road", "Coastline garage",
    { garage: "Coastal garage with tools and a sports car", diner: "Roadside diner and a parked sports car", checkpoint: "Race checkpoint and a sports car" },
    { driver: "A driver waiting beside the car", crew: "Driver and mechanic preparing for a race", robot: "A mechanic and a service robot" },
    { sunset: "Warm coastal sunset", rain: "Rain on the road", stars: "Night sky above the coast" }),
  "gtt-radio": direction("quiz-stage", "After-hours arcade",
    { cabinets: "Rows of glowing arcade cabinets", pinball: "Pinball table beside arcade cabinets", prizes: "Claw machine and a shelf of prizes" },
    { player: "A player at the cabinets", friends: "Two friends visiting the arcade", robot: "A player and an arcade robot" },
    { beacon: "Changing cabinet lights", stars: "Quiet twinkling marquee lights", confetti: "A few pieces of celebratory confetti" }),
  ericade: direction("plasma", "Demoscene club",
    { stage: "Small live stage with speakers and keyboards", booth: "DJ booth with decks and vinyl shelves", rehearsal: "Rehearsal room with amps and synths" },
    { performer: "A performer at the keyboard", duo: "A duo on stage", robot: "A performer and a robot bandmate" },
    { beacon: "Chasing stage lights", stars: "Gentle sparkle from the disco ball", confetti: "Small falling pieces of confetti" }),
});

export function visualChoiceCriteria(roomId) {
  const art = ART_DIRECTIONS[roomId];
  return { setting: art.settings, cast: art.cast, atmosphere: art.atmosphere };
}

export function createVisualProgram(roomId, blockIndex = 0, candidateIndex = 0) {
  if (!Object.hasOwn(ART_DIRECTIONS, roomId)) return null;
  const art = ART_DIRECTIONS[roomId];
  const pick = (options, offset) => Object.keys(options)[offset % Object.keys(options).length];
  return {
    schemaVersion: 2, roomId, scene: art.scene,
    setting: pick(art.settings, candidateIndex + blockIndex),
    cast: pick(art.cast, candidateIndex + blockIndex * 2),
    atmosphere: pick(art.atmosphere, candidateIndex + blockIndex),
  };
}

export function validateVisualProgram(program, roomId) {
  if (!Object.hasOwn(ART_DIRECTIONS, roomId)) return false;
  const art = ART_DIRECTIONS[roomId];
  return Boolean(art && program && program.schemaVersion === 2
    && program.roomId === roomId && program.scene === art.scene
    && Object.hasOwn(art.settings, program.setting)
    && Object.hasOwn(art.cast, program.cast)
    && Object.hasOwn(art.atmosphere, program.atmosphere));
}

export function composeVisualProgram(program, decisions) {
  if (!validateVisualProgram(program, program?.roomId)) return null;
  const options = visualChoiceCriteria(program.roomId);
  const composed = { ...program };
  for (const key of ["setting", "cast", "atmosphere"]) {
    if (Object.hasOwn(options[key], decisions?.[key])) composed[key] = decisions[key];
  }
  return composed;
}

export function describeVisualProgram(program) {
  const art = ART_DIRECTIONS[program.roomId];
  return [art.settings[program.setting], art.cast[program.cast], art.atmosphere[program.atmosphere]].join("; ");
}

// Sixteen-colour base palette, remapped for the four-colour handheld room.
const PALETTE = Object.freeze({
  ink: "#17182e", shadow: "#29334f", slate: "#465575", stone: "#7486a0",
  light: "#b7c9c7", white: "#f5e6c8", wine: "#633b59", red: "#bc5669",
  orange: "#e99b68", gold: "#f4ce83", pine: "#274b45", green: "#50876b",
  mint: "#9fc987", blue: "#467e9b", cyan: "#8dc8c3", brown: "#705b58",
});
const HANDHELD = Object.freeze(Object.fromEntries(Object.keys(PALETTE).map((key, i) =>
  [key, ["#173d29", "#386548", "#88a85b", "#d3df9a"][[
    0, 0, 1, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 1, 2, 1,
  ][i]]],
)));

function rows(value) { return Object.freeze(value.trim().split("\n").map((row) => row.trim())); }
const PERSON_TOP = rows(`
.....kkkkkk.....
....krrrrrrk....
...krrrrrrrrk...
...krrRRRRrrk...
...kkkkkkkkkk...
....kssssk......
....ksksksk.....
....ksssssk.....
.....kssk.......
....krrrrk......
...krRrrRrk.....
..krRRrrRRrk....
..kskRrrRksk....
..kskrrrrksk....
...kkkkkkkk.....
`);
const PERSON_LEGS = [
  rows(`...kbbbbbk......
...kbkbkbk......
...kbk.kbk......
...kbk.kbk......
..kkkk.kkkk.....`),
  rows(`...kbbbbbk......
...kbkbkbk......
..kbk...kbk.....
..kbk...kbk.....
.kkkk...kkkk....`),
  rows(`...kbbbbbk......
....kbkbk.......
....kbkbk.......
....kbkbk.......
...kkkkkk.......`),
];
const CAT_BODY = rows(`
..kk......kk........
..krk....krk........
..krrkkkkrrk........
..krRrrrrRrk........
..krrwrrwrrk........
...krrkkrrk.........
....krrrrrkkkkkk....
...krRRrrrrrrrrrk...
...krrrrrrrrrrrrk...
....kkkkkkkkkkkk....
.....kk......kk.....
`);
const SPRITES = Object.freeze({
  person: PERSON_LEGS.map((legs) => [...PERSON_TOP, ...legs]),
  cat: [CAT_BODY, CAT_BODY],
  robot: [rows(`
......kk........
.....krrk.......
......kk........
...kkkkkkkk.....
..kLLLLLLLLk....
..kLccccccLk....
..kLckcckcLk....
..kLccccccLk....
..kLLLLLLLLk....
...kkkkkkkk.....
..kLLLrrLLLk....
.kLkLLLLLLkLk...
.kLkLkkkkLkLk...
.kkkLccccLkkk...
...kLLLLLLk.....
...kkkkkkkk.....
....kbkkbk......
...kkkkkkkk.....
`)],
  fox: [rows(`
.....kk.....kk..........
.....krk...krk..........
.....krrkkkrrk..........
.....krRRRRRrk..........
......krwRwrk...........
.......ksssksk..........
..kkk..kkkkkk...........
.kssrkkrRRRRRkk.........
ksssrrrRRRRRRrrk........
kssrrrRRRRRRRRrrk.......
.krrrrrRRRRRRrrrk.......
..kkkkrrrrrrrrkk........
......kbkkkkkbk.........
......kbk...kbk.........
.....kkkk...kkkk........
`)],
  fern: [rows(`
.......gg.......
...gg..gG..gg...
...gGg.gG.gGg...
....gGggGgGg....
..gg.gGGGGg.gg..
..gGg.gGGg.gGg..
...gGggGGggGg...
....gGGGGGGg....
.....ggGGgg.....
....kkkkkkkk....
....kRRRRRRk....
.....krrrrk.....
.....krrrrk.....
......kkkk......
`)],
  mushroom: [rows(`
....kkkk....
..kkrrrrkk..
.krrwrrwrrk.
krrrrrrrrrrk
kkkkkkkkkkkk
....ksssk...
....ksssk...
...kkkkkkk..
`)],
  gull: [rows(`
kk........kk
.kwk....kwk.
..kwwkkwwk..
...kwwwwk...
.....kwk....
......k.....
`), rows(`
............
............
.kkkkkkkkkk.
kwwwwwwwwwwk
.....kwk....
......k.....
`)],
  crate: [rows(`
kkkkkkkkkkkkkkkk
kRRRRRRRRRRRRRRk
kRrrrrrrrrrrrrRk
kRrRrrrrrrrrRrRk
kRrrRrrrrrrRrrRk
kRrrrRrrrrRrrrRk
kRrrrrRrrRrrrrRk
kRrrrrrRRrrrrrRk
kRrrrrrRRrrrrrRk
kRrrrrRrrRrrrrRk
kRrrrRrrrrRrrrRk
kRrrRrrrrrrRrrRk
kRrRrrrrrrrrRrRk
kRrrrrrrrrrrrrRk
kRRRRRRRRRRRRRRk
kkkkkkkkkkkkkkkk
`)],
});

// Handwritten 3x5 lettering stays aligned to the scene's pixel grid.
const FONT = {
  A:"010101111101101", B:"110101110101110", C:"011100100100011",
  D:"110101101101110", E:"111100110100111", F:"111100110100100",
  G:"011100101101011", H:"101101111101101", I:"111010010010111",
  J:"001001001101010", K:"101101110101101", L:"100100100100111",
  M:"101111111101101", N:"101111111111101", O:"010101101101010",
  P:"110101110100100", Q:"010101101111011", R:"110101110101101",
  S:"011100010001110", T:"111010010010010", U:"101101101101111",
  V:"101101101101010", W:"101101111111101", X:"101101010101101",
  Y:"101101010010010", Z:"111001010100111", "8":"111101111101111",
};

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function disk(ctx, x, y, radius, color) {
  for (let dy = -radius; dy <= radius; dy++) {
    const dx = Math.floor(Math.sqrt(radius * radius - dy * dy));
    rect(ctx, x - dx, y + dy, dx * 2 + 1, 1, color);
  }
}
function lettering(ctx, value, x, y, color) {
  for (const [i, letter] of [...value].entries()) {
    const glyph = FONT[letter];
    if (!glyph) continue;
    for (let bit = 0; bit < 15; bit++) {
      if (glyph[bit] === "1") rect(ctx, x + i * 4 + bit % 3, y + Math.floor(bit / 3), 1, 1, color);
    }
  }
}
function speckle(ctx, x, y, w, h, color, spacing = 8, seed = 3) {
  for (let row = 0; row < h; row += spacing) {
    for (let col = 0; col < w; col += spacing) {
      const offset = (row * 7 + col * 3 + seed * 13) % spacing;
      rect(ctx, x + col + offset, y + row, 2, 1, color);
    }
  }
}
function bricks(ctx, x, y, w, h, p, stone = false) {
  rect(ctx, x, y, w, h, stone ? p.slate : p.brown);
  for (let row = 0; row < h; row += 6) {
    rect(ctx, x, y + row, w, 1, p.shadow);
    for (let col = 0; col < w; col += 12) {
      const xx = col + (row % 12 === 0 ? 0 : 6);
      if (xx >= w) continue;
      rect(ctx, x + xx, y + row, 1, 6, p.shadow);
      rect(ctx, x + xx + 2, y + row + 1, Math.max(0, Math.min(7, w - xx - 2)), 1, stone ? p.stone : p.orange);
    }
  }
}
function sprite(ctx, name, x, y, time, p, costume = "red", flip = false) {
  const frames = SPRITES[name];
  const frame = Math.floor(time * 4) % frames.length;
  const data = frames[frame];
  const colors = {
    k: p.ink, r: p[costume], R: costume === "green" ? p.mint : p.orange,
    s: p.gold, w: p.white, b: p.slate, L: p.light, c: p.cyan, g: p.pine, G: p.green,
  };
  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < data[row].length; col++) {
      const color = colors[data[row][col]];
      if (color) rect(ctx, x + (flip ? data[row].length - col - 1 : col), y + row, 1, 1, color);
    }
  }
  if (name === "cat") {
    const flick = Math.floor(time * 2) % 3;
    rect(ctx, x + 17, y + 5 - flick, 2, 5, p.ink);
    rect(ctx, x + 18, y + 4 - flick, 3, 2, p[costume]);
  }
}

function sky(ctx, p, night = false) {
  rect(ctx, 0, 0, 320, 180, p.ink);
  const bands = night ? [p.ink, p.shadow, p.slate] : [p.slate, p.red, p.orange];
  for (let i = 0; i < 3; i++) rect(ctx, 0, i * 30, 320, 30, bands[i]);
  if (night) {
    for (let i = 0; i < 52; i++) rect(ctx, i * 83 % 320, i * 23 % 70, 1, 1, i % 3 ? p.stone : p.gold);
    disk(ctx, 246, 27, 12, p.light);
    disk(ctx, 250, 24, 10, p.shadow);
  } else {
    disk(ctx, 248, 39, 18, p.gold);
    for (let i = 0; i < 4; i++) rect(ctx, 224, 46 + i * 4, 50, 1, p.orange);
  }
}
function hills(ctx, p, y = 74) {
  for (let layer = 0; layer < 2; layer++) {
    for (let x = 0; x < 320; x += 2) {
      const top = y + layer * 16 + Math.round(Math.sin(x / (27 + layer * 20)) * 9 + Math.cos(x / 63) * 10);
      rect(ctx, x, top, 2, 130 - top, layer ? p.pine : p.slate);
    }
  }
}
function ground(ctx, p, y = 136, grass = false) {
  rect(ctx, 0, y, 320, 180 - y, grass ? p.pine : p.shadow);
  rect(ctx, 0, y, 320, 2, grass ? p.mint : p.stone);
  speckle(ctx, 0, y + 6, 315, 180 - y - 8, grass ? p.green : p.slate, 10);
  if (grass) {
    for (let x = 0; x < 320; x += 7) {
      rect(ctx, x + 1, y - 2, 1, 4, p.green);
      rect(ctx, x + 2, y - 4, 1, 5, p.mint);
    }
  } else {
    for (let yy = y + 12; yy < 180; yy += 12) {
      rect(ctx, 0, yy, 320, 1, p.ink);
      for (let x = yy % 24; x < 320; x += 24) rect(ctx, x, yy - 12, 1, 12, p.ink);
    }
  }
}
function tree(ctx, x, y, p, scale = 1) {
  rect(ctx, x + 17 * scale, y + 29 * scale, 8 * scale, 25 * scale, p.ink);
  rect(ctx, x + 19 * scale, y + 29 * scale, 4 * scale, 25 * scale, p.brown);
  rect(ctx, x + 20 * scale, y + 33 * scale, scale, 20 * scale, p.orange);
  for (const [dx, dy, r] of [[11, 25, 11], [30, 24, 12], [19, 10, 13], [20, 24, 14]]) {
    disk(ctx, x + dx * scale, y + dy * scale, r * scale, p.ink);
    disk(ctx, x + (dx - 1) * scale, y + (dy - 2) * scale, (r - 2) * scale, p.pine);
    disk(ctx, x + (dx - 4) * scale, y + (dy - 4) * scale, (r - 5) * scale, p.green);
  }
  speckle(ctx, x + 5 * scale, y + 6 * scale, 31 * scale, 22 * scale, p.mint, 7);
}
function windowPane(ctx, x, y, w, h, p, lit = true) {
  rect(ctx, x - 2, y - 2, w + 4, h + 5, p.ink);
  rect(ctx, x, y, w, h, lit ? p.orange : p.blue);
  rect(ctx, x + 1, y + 1, w - 2, Math.floor(h / 2), lit ? p.gold : p.cyan);
  rect(ctx, x + Math.floor(w / 2), y, 1, h, p.brown);
  rect(ctx, x, y + Math.floor(h / 2), w, 1, p.brown);
  rect(ctx, x - 3, y + h + 1, w + 6, 2, p.stone);
}
function roof(ctx, x, y, w, p) {
  for (let row = 0; row < 23; row++) {
    const inset = Math.max(0, 21 - row);
    rect(ctx, x + inset, y + row, w - inset * 2, 1, p.ink);
    if (row > 2) rect(ctx, x + inset + 2, y + row, w - inset * 2 - 4, 1, row % 4 ? p.wine : p.red);
  }
  for (let yy = 4; yy < 23; yy += 4) {
    for (let xx = 23 - yy; xx < w - 23 + yy; xx += 9) rect(ctx, x + xx, y + yy, 1, 3, p.ink);
  }
  rect(ctx, x - 2, y + 22, w + 4, 3, p.ink);
  rect(ctx, x, y + 22, w, 1, p.orange);
}
function cottage(ctx, x, y, p, label = "INN") {
  bricks(ctx, x + 4, y + 23, 76, 49, p);
  rect(ctx, x + 8, y + 24, 68, 45, p.light);
  for (const xx of [8, 38, 73]) rect(ctx, x + xx, y + 24, 3, 45, p.brown);
  rect(ctx, x + 8, y + 47, 68, 3, p.brown);
  rect(ctx, x + 57, y - 1, 10, 20, p.shadow);
  rect(ctx, x + 55, y - 3, 14, 4, p.stone);
  roof(ctx, x, y, 84, p);
  windowPane(ctx, x + 17, y + 34, 15, 17, p);
  windowPane(ctx, x + 50, y + 33, 17, 16, p);
  rect(ctx, x + 38, y + 52, 14, 20, p.ink);
  rect(ctx, x + 40, y + 54, 10, 16, p.brown);
  rect(ctx, x + 47, y + 62, 1, 1, p.gold);
  rect(ctx, x + 32, y + 71, 26, 3, p.stone);
  rect(ctx, x + 10, y + 56, 21, 9, p.ink);
  lettering(ctx, label, x + 13, y + 58, p.gold);
}
function lamp(ctx, x, y, p) {
  rect(ctx, x, y, 2, 43, p.ink);
  rect(ctx, x - 4, y - 11, 10, 13, p.ink);
  rect(ctx, x - 2, y - 8, 6, 8, p.gold);
  rect(ctx, x, y - 8, 1, 8, p.orange);
  rect(ctx, x - 5, y - 12, 12, 2, p.slate);
  rect(ctx, x - 3, y + 43, 8, 3, p.ink);
}
function cabinet(ctx, x, y, p, type = 0) {
  rect(ctx, x + 4, y, 24, 45, p.ink);
  rect(ctx, x + 6, y + 2, 20, 40, type % 2 ? p.wine : p.slate);
  rect(ctx, x + 7, y + 3, 18, 6, p.red);
  lettering(ctx, type % 2 ? "PLAY" : "CHIP", x + 8, y + 4, p.gold);
  rect(ctx, x + 7, y + 12, 18, 15, p.ink);
  rect(ctx, x + 9, y + 14, 14, 11, p.blue);
  rect(ctx, x + 12, y + 19, 7, 3, p.mint);
  rect(ctx, x + 15, y + 16, 2, 7, p.gold);
  rect(ctx, x + 2, y + 29, 28, 5, p.ink);
  rect(ctx, x + 3, y + 29, 26, 2, p.stone);
  rect(ctx, x + 9, y + 27, 2, 4, p.red);
  rect(ctx, x + 21, y + 29, 2, 1, p.gold);
  rect(ctx, x + 17, y + 36, 5, 3, p.ink);
}
function monitor(ctx, x, y, p) {
  rect(ctx, x, y, 35, 28, p.ink);
  rect(ctx, x + 2, y + 1, 30, 24, p.stone);
  rect(ctx, x + 4, y + 3, 24, 18, p.ink);
  rect(ctx, x + 5, y + 4, 22, 16, p.pine);
  for (let line = 0; line < 4; line++) rect(ctx, x + 7, y + 7 + line * 3, 6 + line % 3 * 4, 1, p.mint);
  rect(ctx, x + 14, y + 28, 7, 4, p.slate);
  rect(ctx, x + 8, y + 32, 19, 2, p.ink);
  rect(ctx, x + 29, y + 21, 2, 2, p.green);
}
function shelf(ctx, x, y, p, records = false) {
  rect(ctx, x - 2, y - 2, 48, 38, p.ink);
  rect(ctx, x, y, 44, 32, p.brown);
  for (let row = 0; row < 2; row++) {
    rect(ctx, x + 2, y + row * 16 + 2, 40, 12, p.shadow);
    for (let i = 0; i < 9; i++) {
      rect(ctx, x + 3 + i * 4, y + row * 16 + 3 + i % 3, 3, 10 - i % 3, [p.red, p.gold, p.green, p.blue][i % 4]);
      if (!records) rect(ctx, x + 3 + i * 4, y + row * 16 + 7, 3, 1, p.light);
    }
  }
}

function drawSetting(ctx, program, p) {
  const draw = {
    skyline: city, coast: harbor, forest: woodland, castle: citadel,
    handheld: valley, cosmos: outpost, "code-tunnel": workshop,
    "chip-studio": studio, overworld: village, "turbo-road": garage,
    "quiz-stage": arcade, plasma: club,
  }[program.scene];
  draw(ctx, program, p);
}

function city(ctx, program, p) {
  sky(ctx, p, true);
  for (let i = 0; i < 13; i++) {
    const x = i * 27 - 4;
    const y = 30 + i * 17 % 42;
    rect(ctx, x, y, 23, 124 - y, i % 2 ? p.shadow : p.slate);
    rect(ctx, x + 2, y + 2, 19, 1, p.stone);
    for (let yy = y + 7; yy < 117; yy += 8) {
      for (let xx = 3; xx < 19; xx += 6) {
        rect(ctx, x + xx, yy, 2, 3, (yy + xx + i) % 4 ? p.blue : p.gold);
      }
    }
    rect(ctx, x + 6, y - 6, 1, 6, p.stone);
  }
  ground(ctx, p);
  // Brick corner shop with upper apartment and display window.
  rect(ctx, 56, 29, 148, 109, p.ink);
  bricks(ctx, 59, 32, 141, 102, p);
  rect(ctx, 54, 27, 152, 4, p.stone);
  for (const x of [72, 110, 158]) windowPane(ctx, x, 41, 23, 21, p);
  rect(ctx, 67, 71, 120, 15, p.ink);
  rect(ctx, 70, 73, 114, 11, p.wine);
  const label = { cafe: "8BIT CAFE", records: "NIGHT RECORDS", bookshop: "PIXEL BOOKS" }[program.setting];
  lettering(ctx, label, 126 - label.length * 2, 76, p.gold);
  rect(ctx, 66, 91, 75, 35, p.ink);
  rect(ctx, 69, 94, 69, 29, p.orange);
  rect(ctx, 71, 96, 65, 15, p.gold);
  for (const x of [92, 116]) rect(ctx, x, 94, 2, 30, p.brown);
  if (program.setting === "cafe") {
    for (const x of [76, 100, 124]) {
      rect(ctx, x, 112, 9, 7, p.brown);
      rect(ctx, x + 2, 112, 5, 4, p.white);
    }
    rect(ctx, 221, 126, 29, 3, p.brown);
    rect(ctx, 233, 129, 3, 13, p.ink);
    for (const x of [214, 251]) {
      rect(ctx, x, 127, 3, 13, p.brown);
      rect(ctx, x, 134, 10, 2, p.stone);
      rect(ctx, x + 7, 136, 2, 8, p.ink);
    }
  } else if (program.setting === "records") {
    for (const x of [81, 104, 128]) {
      disk(ctx, x, 109, 7, p.ink);
      disk(ctx, x, 109, 2, p.red);
    }
  } else {
    for (let i = 0; i < 18; i++) rect(ctx, 73 + i * 3, 103 + i % 3, 2, 17 - i % 3, [p.blue, p.wine, p.green][i % 3]);
    rect(ctx, 70, 120, 68, 2, p.brown);
  }
  windowPane(ctx, 153, 92, 28, 40, p);
  rect(ctx, 173, 117, 2, 2, p.ink);
  rect(ctx, 59, 84, 141, 9, p.ink);
  for (let i = 0; i < 14; i++) {
    rect(ctx, 60 + i * 10, 84, 10, 7, i % 2 ? p.white : p.red);
    rect(ctx, 60 + i * 10, 91, 10, 3, i % 2 ? p.light : p.wine);
  }
  lamp(ctx, 30, 94, p);
  lamp(ctx, 285, 94, p);
  sprite(ctx, "fern", 45, 124, 0, p);
  sprite(ctx, "fern", 188, 124, 0, p);
  // Vending machine, crates and a hand-lettered pavement sign.
  rect(ctx, 263, 102, 17, 35, p.ink);
  rect(ctx, 265, 104, 13, 29, p.red);
  rect(ctx, 266, 106, 10, 15, p.cyan);
  for (let i = 0; i < 6; i++) rect(ctx, 267 + i % 3 * 3, 108 + Math.floor(i / 3) * 6, 2, 4, p.gold);
  rect(ctx, 270, 126, 6, 3, p.ink);
  rect(ctx, 202, 127, 13, 15, p.brown);
  rect(ctx, 204, 129, 9, 9, p.ink);
  lettering(ctx, "HI", 205, 131, p.gold);
  rect(ctx, 0, 154, 320, 2, p.stone);
  rect(ctx, 0, 156, 320, 24, p.ink);
  for (let x = 10; x < 320; x += 50) rect(ctx, x, 169, 25, 2, p.gold);
}

function water(ctx, p, y = 82) {
  rect(ctx, 0, y, 320, 98, p.blue);
  for (let row = 0; row < 13; row++) {
    const yy = y + row * 6;
    for (let i = 0; i < 10; i++) rect(ctx, (i * 37 + row * 11) % 320, yy, 7 + row % 7, 1, row % 3 ? p.cyan : p.slate);
  }
}
function pier(ctx, p) {
  for (let x = 6; x < 320; x += 12) {
    rect(ctx, x, 135, 10, 17, p.brown);
    rect(ctx, x, 136, 9, 1, p.orange);
    rect(ctx, x + 2, 146, 5, 1, p.ink);
  }
  rect(ctx, 0, 153, 320, 5, p.ink);
  for (const x of [18, 66, 118, 192, 247, 298]) {
    rect(ctx, x, 151, 6, 29, p.ink);
    rect(ctx, x + 1, 154, 2, 26, p.brown);
  }
}
function harbor(ctx, program, p) {
  sky(ctx, p, program.atmosphere === "stars");
  hills(ctx, p, 81);
  water(ctx, p, 92);
  pier(ctx, p);
  if (program.setting === "lighthouse") {
    for (let i = 0; i < 4; i++) disk(ctx, 69 + i * 15, 125 + i % 2 * 3, 18, p.slate);
    rect(ctx, 74, 40, 32, 89, p.ink);
    for (let y = 43; y < 128; y++) rect(ctx, 77, y, 26, 1, Math.floor(y / 14) % 2 ? p.white : p.red);
    rect(ctx, 97, 43, 6, 84, p.wine);
    for (const y of [57, 88, 116]) windowPane(ctx, 83, y, 7, 10, p, false);
    rect(ctx, 69, 33, 43, 6, p.ink);
    rect(ctx, 74, 18, 32, 15, p.gold);
    for (const x of [74, 88, 103]) rect(ctx, x, 18, 2, 16, p.ink);
    roof(ctx, 67, -6, 47, p);
    rect(ctx, 67, 34, 48, 1, p.light);
    sprite(ctx, "crate", 121, 120, 0, p);
  } else if (program.setting === "boathouse") {
    cottage(ctx, 52, 62, p, "DOCK");
    for (let x = 56; x < 130; x += 5) rect(ctx, x, 88, 1, 46, p.brown);
    windowPane(ctx, 68, 96, 21, 19, p);
  } else {
    rect(ctx, 68, 94, 4, 42, p.brown);
    rect(ctx, 111, 94, 4, 42, p.brown);
    roof(ctx, 52, 70, 78, p);
    rect(ctx, 77, 126, 29, 3, p.brown);
    rect(ctx, 80, 129, 3, 7, p.ink);
    rect(ctx, 100, 129, 3, 7, p.ink);
    tree(ctx, 236, 65, p);
  }
  lamp(ctx, 206, 90, p);
  sprite(ctx, "crate", 252, 120, 0, p);
  sprite(ctx, "crate", 268, 120, 0, p);
  rect(ctx, 262, 112, 13, 6, p.brown);
}

function woodland(ctx, program, p) {
  sky(ctx, p, true);
  hills(ctx, p, 65);
  for (const [x, y] of [[3, 24], [44, 49], [224, 33], [278, 21]]) tree(ctx, x, y, p, 2);
  ground(ctx, p, 137, true);
  // A winding brook and stepping stones continue into the foreground.
  for (let y = 117; y < 180; y++) {
    const x = 207 + Math.round(Math.sin(y / 14) * 15);
    rect(ctx, x, y, 24, 1, p.blue);
    if (y % 5 === 0) rect(ctx, x + 5, y, 9, 1, p.cyan);
  }
  if (program.setting === "cottage") {
    cottage(ctx, 90, 64, p, "HOME");
    speckle(ctx, 96, 78, 69, 8, p.green, 6);
  } else if (program.setting === "shrine") {
    bricks(ctx, 109, 76, 46, 54, p, true);
    rect(ctx, 119, 89, 25, 40, p.ink);
    disk(ctx, 131, 84, 14, p.ink);
    rect(ctx, 122, 88, 19, 40, p.shadow);
    rect(ctx, 102, 130, 61, 4, p.stone);
    rect(ctx, 97, 134, 71, 4, p.slate);
    rect(ctx, 129, 112, 4, 12, p.gold);
  } else {
    for (let x = 158; x < 260; x += 6) {
      rect(ctx, x, 128, 5, 7, p.brown);
      rect(ctx, x, 128, 5, 1, p.orange);
    }
    for (const x of [159, 207, 253]) rect(ctx, x, 116, 3, 23, p.ink);
    rect(ctx, 158, 117, 99, 2, p.brown);
    tree(ctx, 88, 72, p);
  }
  for (const x of [12, 54, 169, 260, 288]) {
    sprite(ctx, "mushroom", x, 148 + x % 7, 0, p);
    sprite(ctx, "fern", x + 13, 150 + x % 7, 0, p);
  }
  for (const [x, y] of [[187, 154], [209, 164], [202, 177]]) {
    rect(ctx, x, y, 10, 3, p.ink);
    rect(ctx, x + 1, y, 8, 2, p.light);
  }
}

function citadel(ctx, program, p) {
  sky(ctx, p, true);
  hills(ctx, p, 81);
  ground(ctx, p);
  const ruins = program.setting === "ruins";
  bricks(ctx, 49, ruins ? 96 : 77, 222, ruins ? 41 : 60, p, true);
  for (const x of [44, 232]) {
    bricks(ctx, x, 43, 43, 94, p, true);
    rect(ctx, x - 2, 41, 47, 4, p.light);
    for (let xx = 0; xx < 44; xx += 12) rect(ctx, x + xx, 32, 7, 11, p.slate);
    windowPane(ctx, x + 16, 59, 8, 19, p);
    windowPane(ctx, x + 16, 98, 8, 17, p);
  }
  if (program.setting === "keep") {
    bricks(ctx, 123, 31, 75, 107, p, true);
    for (let x = 123; x < 198; x += 13) rect(ctx, x, 23, 8, 10, p.stone);
    for (const x of [135, 169]) windowPane(ctx, x, 43, 11, 17, p);
  }
  disk(ctx, 162, 101, 23, p.ink);
  rect(ctx, 139, 101, 47, 36, p.ink);
  if (!ruins) {
    for (let x = 142; x < 184; x += 6) rect(ctx, x, 87, 2, 48, p.brown);
    for (const y of [100, 115]) rect(ctx, 140, y, 43, 2, p.brown);
  } else {
    for (const [x, y] of [[94, 133], [210, 141], [110, 146]]) bricks(ctx, x, y, 15, 7, p, true);
    sprite(ctx, "fern", 189, 124, 0, p);
  }
  for (const x of [109, 204]) {
    rect(ctx, x, 99, 3, 30, p.ink);
    rect(ctx, x - 3, 99, 9, 5, p.brown);
  }
  for (let y = 137; y < 180; y += 5) rect(ctx, 142 - (y - 137) / 2, y, 41 + y - 137, 4, p.slate);
  for (const x of [89, 216]) {
    rect(ctx, x, 68, 13, 24, p.red);
    rect(ctx, x + 5, 70, 3, 15, p.gold);
    rect(ctx, x + 2, 73, 9, 3, p.gold);
  }
}

function valley(ctx, program, p) {
  sky(ctx, p, program.atmosphere === "stars");
  hills(ctx, p, 74);
  ground(ctx, p, 139, true);
  bricks(ctx, 0, 141, 320, 39, p, true);
  for (const [x, y, w] of [[30, 117, 50], [125, 95, 48], [222, 116, 52]]) {
    bricks(ctx, x, y, w, 18, p, true);
    rect(ctx, x - 1, y - 3, w + 2, 4, p.mint);
    if (program.setting === "ruins") {
      rect(ctx, x + 8, y - 31, 9, 29, p.stone);
      rect(ctx, x + 5, y - 33, 15, 4, p.light);
      rect(ctx, x + 11, y - 28, 1, 23, p.shadow);
    }
  }
  if (program.setting === "camp") cottage(ctx, 220, 65, p, "CAMP");
  else {
    tree(ctx, 269, 82, p);
    sprite(ctx, "mushroom", 98, 131, 0, p);
  }
  for (const x of [20, 90, 187]) sprite(ctx, "fern", x, 124, 0, p);
  rect(ctx, 289, 68, 2, 72, p.ink);
  rect(ctx, 291, 71, 16, 9, p.red);
}

function outpost(ctx, program, p) {
  sky(ctx, p, true);
  disk(ctx, 232, 55, 32, p.wine);
  for (let row = -25; row < 27; row += 6) {
    const half = Math.floor(Math.sqrt(32 ** 2 - row ** 2));
    rect(ctx, 232 - half, 55 + row, half * 2, 2, row % 4 ? p.red : p.orange);
  }
  for (let x = 180; x < 284; x++) rect(ctx, x, 65 - (x - 232) / 5, 1, 3, p.gold);
  hills(ctx, { ...p, pine: p.shadow }, 112);
  ground(ctx, p, 145);
  if (program.setting === "observatory") {
    disk(ctx, 95, 96, 35, p.stone);
    disk(ctx, 89, 92, 26, p.light);
    rect(ctx, 58, 95, 75, 47, p.ink);
    rect(ctx, 61, 97, 69, 44, p.slate);
    windowPane(ctx, 71, 106, 49, 18, p, false);
    rect(ctx, 89, 128, 18, 14, p.ink);
    rect(ctx, 96, 63, 5, 31, p.ink);
  } else if (program.setting === "landing") {
    rect(ctx, 44, 129, 107, 13, p.stone);
    rect(ctx, 49, 132, 97, 7, p.shadow);
    rect(ctx, 65, 106, 74, 18, p.ink);
    rect(ctx, 70, 102, 62, 20, p.light);
    rect(ctx, 77, 98, 40, 12, p.stone);
    rect(ctx, 85, 101, 24, 8, p.cyan);
    rect(ctx, 77, 122, 4, 8, p.red);
    rect(ctx, 118, 122, 4, 8, p.red);
    rect(ctx, 62, 112, 8, 6, p.gold);
  } else {
    bricks(ctx, 56, 105, 79, 38, p, true);
    windowPane(ctx, 68, 115, 36, 15, p, false);
    rect(ctx, 95, 67, 5, 39, p.light);
    disk(ctx, 97, 66, 25, p.stone);
    disk(ctx, 105, 56, 24, p.ink);
    rect(ctx, 89, 65, 29, 2, p.gold);
  }
  for (const x of [32, 157, 278]) {
    rect(ctx, x, 119, 3, 25, p.stone);
    rect(ctx, x - 2, 117, 7, 4, p.red);
  }
  sprite(ctx, "crate", 251, 130, 0, p);
  sprite(ctx, "crate", 267, 130, 0, p);
}

function interior(ctx, p, tint = "shadow") {
  rect(ctx, 0, 0, 320, 180, p[tint]);
  for (let yy = 0; yy < 135; yy += 9) rect(ctx, 0, yy, 320, 1, p.ink);
  rect(ctx, 0, 13, 320, 3, p.stone);
  rect(ctx, 0, 133, 320, 4, p.brown);
  ground(ctx, p, 137);
  windowPane(ctx, 32, 33, 70, 54, p, false);
  rect(ctx, 33, 34, 68, 52, p.ink);
  for (let i = 0; i < 10; i++) {
    const yy = 53 + i * 7 % 19;
    rect(ctx, 34 + i * 7, yy, 7, 86 - yy, p.slate);
    rect(ctx, 36 + i * 7, yy + 4, 2, 2, p.gold);
  }
  disk(ctx, 82, 45, 6, p.gold);
  rect(ctx, 65, 33, 2, 54, p.stone);
  rect(ctx, 33, 60, 68, 2, p.stone);
  rect(ctx, 25, 29, 8, 61, p.wine);
  rect(ctx, 101, 29, 8, 61, p.wine);
  sprite(ctx, "fern", 36, 74, 0, p);
}
function desk(ctx, p, x = 119, y = 119, width = 144) {
  rect(ctx, x, y, width, 6, p.ink);
  rect(ctx, x + 2, y, width - 4, 3, p.brown);
  rect(ctx, x + 5, y + 6, 5, 24, p.ink);
  rect(ctx, x + width - 12, y + 6, 5, 24, p.ink);
}
function keyboard(ctx, x, y, width, p) {
  rect(ctx, x, y, width, 8, p.ink);
  for (let i = 0; i < width - 4; i += 3) {
    rect(ctx, x + i + 2, y + 1, 2, 5, p.white);
    if (i % 9) rect(ctx, x + i + 2, y + 1, 1, 3, p.ink);
  }
}
function workshop(ctx, program, p) {
  interior(ctx, p);
  shelf(ctx, 251, 36, p);
  rect(ctx, 145, 33, 43, 22, p.ink);
  rect(ctx, 147, 35, 39, 18, p.blue);
  lettering(ctx, "HELLO", 152, 39, p.gold);
  lettering(ctx, "WORLD", 152, 46, p.light);
  desk(ctx, p);
  monitor(ctx, 150, 78, p);
  keyboard(ctx, 139, 111, 48, p);
  rect(ctx, 193, 113, 6, 3, p.light);
  rect(ctx, 211, 110, 6, 8, p.white);
  rect(ctx, 217, 112, 3, 4, p.gold);
  sprite(ctx, "fern", 236, 103, 0, p);
  if (program.setting === "servers") {
    rect(ctx, 272, 84, 24, 56, p.ink);
    for (let row = 0; row < 6; row++) {
      rect(ctx, 274, 86 + row * 8, 20, 6, p.slate);
      rect(ctx, 276, 87 + row * 8, 12, 2, p.ink);
      rect(ctx, 291, 89 + row * 8, 1, 1, p.green);
    }
  } else if (program.setting === "workshop") {
    rect(ctx, 208, 69, 28, 22, p.brown);
    for (const x of [212, 221, 230]) {
      rect(ctx, x, 72, 2, 14, p.light);
      rect(ctx, x - 1, 80, 4, 7, p.red);
    }
    rect(ctx, 266, 125, 22, 12, p.red);
    rect(ctx, 273, 120, 9, 5, p.ink);
  } else {
    rect(ctx, 275, 104, 20, 32, p.light);
    for (let y = 108; y < 129; y += 5) rect(ctx, 277, y, 15, 2, p.slate);
  }
  shelf(ctx, 27, 101, p);
  rect(ctx, 99, 152, 149, 16, p.wine);
  rect(ctx, 101, 154, 145, 12, p.red);
  speckle(ctx, 104, 157, 136, 7, p.orange, 8);
}
function speaker(ctx, x, y, p, small = false) {
  const h = small ? 32 : 52;
  rect(ctx, x, y, 26, h, p.ink);
  rect(ctx, x + 2, y + 2, 22, h - 4, p.brown);
  for (const cy of small ? [y + 15] : [y + 13, y + 36]) {
    disk(ctx, x + 13, cy, 9, p.ink);
    disk(ctx, x + 13, cy, 6, p.slate);
    disk(ctx, x + 13, cy, 2, p.light);
  }
}
function studio(ctx, program, p) {
  interior(ctx, p, "wine");
  shelf(ctx, 242, 37, p, true);
  desk(ctx, p, 119, 119, 133);
  speaker(ctx, 79, 93, p);
  speaker(ctx, 272, 93, p);
  monitor(ctx, 166, 69, p);
  keyboard(ctx, 132, 110, 101, p);
  if (program.setting === "vinyl") {
    rect(ctx, 122, 94, 36, 15, p.stone);
    disk(ctx, 136, 101, 6, p.ink);
    disk(ctx, 136, 101, 2, p.red);
    rect(ctx, 149, 96, 1, 10, p.gold);
  } else if (program.setting === "tape") {
    rect(ctx, 217, 78, 32, 30, p.light);
    for (const x of [225, 240]) {
      disk(ctx, x, 87, 6, p.ink);
      disk(ctx, x, 87, 3, p.stone);
    }
    rect(ctx, 223, 99, 19, 4, p.ink);
  } else {
    rect(ctx, 214, 91, 38, 17, p.ink);
    for (let i = 0; i < 6; i++) rect(ctx, 217 + i * 5, 94, 2, 3, p.gold);
    keyboard(ctx, 215, 100, 36, p);
  }
  rect(ctx, 123, 28, 87, 19, p.ink);
  lettering(ctx, "SID LISTENING ROOM", 132, 35, p.gold);
  sprite(ctx, "fern", 42, 124, 0, p);
}

function village(ctx, program, p) {
  sky(ctx, p, program.atmosphere === "fireflies");
  hills(ctx, p, 74);
  ground(ctx, p, 136, true);
  tree(ctx, 14, 78, p);
  tree(ctx, 257, 78, p);
  for (let y = 135; y < 180; y++) rect(ctx, 148 + Math.sin(y / 18) * 18, y, 24, 1, p.brown);
  speckle(ctx, 152, 142, 20, 35, p.stone, 6);
  cottage(ctx, 49, 64, p);
  if (program.setting === "mill") {
    bricks(ctx, 201, 67, 35, 70, p, true);
    roof(ctx, 192, 44, 53, p);
    windowPane(ctx, 213, 107, 8, 17, p);
  } else if (program.setting === "tower") {
    bricks(ctx, 198, 46, 41, 90, p, true);
    roof(ctx, 190, 23, 57, p);
    for (const y of [56, 87, 118]) windowPane(ctx, 214, y, 9, 12, p);
  } else {
    cottage(ctx, 192, 71, p, "SHOP");
  }
  for (let x = 4; x < 143; x += 11) {
    rect(ctx, x, 141, 3, 15, p.brown);
    rect(ctx, x, 141, 3, 1, p.gold);
  }
  rect(ctx, 0, 145, 143, 2, p.orange);
  for (const x of [19, 65, 253, 291]) sprite(ctx, "mushroom", x, 161, 0, p);
}
function car(ctx, x, y, p) {
  rect(ctx, x + 8, y, 37, 3, p.ink);
  rect(ctx, x + 4, y + 3, 46, 11, p.ink);
  rect(ctx, x + 7, y + 4, 39, 10, p.red);
  rect(ctx, x + 12, y + 3, 27, 7, p.cyan);
  rect(ctx, x + 24, y + 3, 2, 7, p.ink);
  rect(ctx, x, y + 11, 59, 12, p.ink);
  rect(ctx, x + 2, y + 12, 55, 8, p.red);
  rect(ctx, x + 4, y + 12, 50, 2, p.orange);
  rect(ctx, x + 2, y + 15, 5, 3, p.gold);
  rect(ctx, x + 52, y + 15, 4, 3, p.white);
  for (const xx of [12, 46]) {
    disk(ctx, x + xx, y + 22, 6, p.ink);
    disk(ctx, x + xx, y + 22, 3, p.stone);
    disk(ctx, x + xx, y + 22, 1, p.light);
  }
}
function garage(ctx, program, p) {
  sky(ctx, p, program.atmosphere === "stars");
  water(ctx, p, 91);
  ground(ctx, p, 132);
  rect(ctx, 0, 156, 320, 24, p.ink);
  for (let x = 0; x < 320; x += 42) rect(ctx, x, 169, 23, 2, p.gold);
  bricks(ctx, 40, 57, 136, 77, p, true);
  rect(ctx, 37, 53, 142, 5, p.ink);
  rect(ctx, 43, 63, 129, 16, p.wine);
  lettering(ctx, { garage: "COAST GARAGE", diner: "TURBO DINER", checkpoint: "FINAL LAP" }[program.setting], 74, 69, p.gold);
  if (program.setting === "garage") {
    rect(ctx, 50, 86, 86, 47, p.ink);
    for (let y = 87; y < 105; y += 4) rect(ctx, 52, y, 82, 3, p.slate);
    rect(ctx, 148, 89, 15, 44, p.blue);
    for (const x of [57, 69, 82]) {
      rect(ctx, x, 112, 2, 15, p.light);
      rect(ctx, x - 2, 112, 6, 2, p.light);
    }
  } else if (program.setting === "diner") {
    for (const x of [52, 87, 139]) windowPane(ctx, x, 89, 22, 32, p);
    for (let i = 0; i < 13; i++) rect(ctx, 43 + i * 10, 79, 10, 7, i % 2 ? p.white : p.red);
  } else {
    rect(ctx, 52, 84, 67, 39, p.ink);
    lettering(ctx, "START", 65, 92, p.white);
    for (let i = 0; i < 18; i++) rect(ctx, 53 + i % 9 * 7, 105 + Math.floor(i / 9) * 7, 7, 7, i % 2 ? p.white : p.ink);
  }
  car(ctx, 201, 113, p);
  rect(ctx, 276, 102, 3, 36, p.ink);
  rect(ctx, 270, 104, 17, 9, p.red);
  lettering(ctx, "GO", 275, 106, p.gold);
}

function arcade(ctx, program, p) {
  interior(ctx, p, "wine");
  rect(ctx, 25, 27, 84, 65, p.ink);
  rect(ctx, 30, 31, 74, 57, p.blue);
  lettering(ctx, "BONUS", 43, 42, p.gold);
  lettering(ctx, "ROUND", 43, 50, p.white);
  disk(ctx, 67, 70, 10, p.gold);
  disk(ctx, 67, 70, 6, p.orange);
  rect(ctx, 66, 66, 2, 8, p.white);
  rect(ctx, 127, 32, 157, 14, p.ink);
  lettering(ctx, "AFTER HOURS ARCADE", 143, 37, p.cyan);
  for (let i = 0; i < 4; i++) cabinet(ctx, 131 + i * 35, 86, p, i);
  if (program.setting === "pinball") {
    rect(ctx, 40, 113, 53, 23, p.ink);
    rect(ctx, 44, 115, 45, 15, p.blue);
    for (const x of [54, 66, 78]) disk(ctx, x, 122, 3, p.red);
    rect(ctx, 43, 136, 3, 12, p.stone);
    rect(ctx, 86, 136, 3, 12, p.stone);
  } else if (program.setting === "prizes") {
    rect(ctx, 47, 96, 48, 48, p.ink);
    rect(ctx, 49, 99, 44, 30, p.blue);
    rect(ctx, 49, 131, 44, 10, p.red);
    rect(ctx, 70, 100, 1, 13, p.light);
    rect(ctx, 65, 113, 11, 2, p.light);
    for (const x of [54, 67, 80]) disk(ctx, x, 125, 4, p.gold);
  } else {
    cabinet(ctx, 42, 98, p, 1);
    cabinet(ctx, 77, 98, p);
  }
  for (let x = 8; x < 320; x += 16) rect(ctx, x, 17, 3, 2, x % 32 ? p.cyan : p.red);
  sprite(ctx, "fern", 296, 122, 0, p);
}
function club(ctx, program, p) {
  interior(ctx, p);
  rect(ctx, 20, 25, 280, 109, p.wine);
  for (let x = 20; x < 300; x += 9) rect(ctx, x, 25, 3, 109, p.red);
  rect(ctx, 96, 28, 127, 48, p.ink);
  lettering(ctx, "DEMO NIGHT", 120, 43, p.gold);
  lettering(ctx, "LIVE CHIP MUSIC", 108, 54, p.cyan);
  rect(ctx, 30, 128, 260, 10, p.brown);
  rect(ctx, 30, 128, 260, 2, p.gold);
  speaker(ctx, 37, 76, p);
  speaker(ctx, 263, 76, p);
  desk(ctx, p, 114, 111, 119);
  if (program.setting === "booth") {
    for (const x of [129, 190]) {
      rect(ctx, x, 98, 28, 13, p.stone);
      disk(ctx, x + 13, 104, 6, p.ink);
      disk(ctx, x + 13, 104, 2, p.gold);
    }
    shelf(ctx, 70, 90, p, true);
  } else {
    keyboard(ctx, 121, 101, 103, p);
    if (program.setting === "rehearsal") {
      speaker(ctx, 73, 96, p, true);
      monitor(ctx, 214, 76, p);
    } else {
      rect(ctx, 86, 94, 2, 33, p.stone);
      rect(ctx, 80, 92, 13, 3, p.ink);
      rect(ctx, 78, 126, 17, 2, p.ink);
    }
  }
  for (let x = 19; x < 300; x += 25) {
    rect(ctx, x, 19, 12, 6, p.ink);
    rect(ctx, x + 3, 24, 6, 2, p.gold);
  }
}

function drawCast(ctx, program, time, p) {
  const options = Object.keys(ART_DIRECTIONS[program.roomId].cast);
  const index = options.indexOf(program.cast);
  const anchors = {
    skyline: [154, 124], coast: [177, 116], forest: [132, 119],
    castle: [128, 119], handheld: [95, 119], cosmos: [173, 125],
    "code-tunnel": [188, 126], "chip-studio": [206, 126], overworld: [161, 120],
    "turbo-road": [180, 121], "quiz-stage": [186, 119], plasma: [93, 108],
  };
  const [x, y] = anchors[program.scene];
  const walks = ["skyline", "handheld", "overworld", "cosmos"].includes(program.scene);
  const drift = walks ? Math.round(Math.sin(time / 6) * 11) : 0;
  const frameTime = walks ? time : Math.floor(time / 3) % 2 / 4;
  const costume = ["forest", "overworld", "handheld"].includes(program.scene) ? "green"
    : program.scene === "cosmos" || program.scene === "castle" ? "light" : "red";
  const robotLead = program.cast === "robot" && ["handheld", "cosmos"].includes(program.scene);
  if (program.scene === "forest" && index === 0) {
    sprite(ctx, "fox", x + drift, y + 7, time, p);
  } else {
    sprite(ctx, robotLead ? "robot" : "person", x + drift, y, frameTime, p, costume, drift < 0);
  }
  if (["friends", "sailors", "patrol", "party", "duo", "crew"].includes(program.cast)) {
    sprite(ctx, program.cast === "crew" && program.scene === "cosmos" ? "robot" : "person", x + 28, y + 1, 0, p, "blue", true);
  } else if (["courier", "robot"].includes(program.cast) && !robotLead) {
    sprite(ctx, "robot", x + 30, y + 3, time, p);
  } else if (program.scene === "forest" || program.cast === "fox") {
    if (program.scene !== "forest" || index !== 0) sprite(ctx, "fox", x + 33, y + 8 + Math.floor(time * 2) % 2, time, p);
  } else if (["commuter", "cat", "coder", "mage"].includes(program.cast)) {
    sprite(ctx, "cat", x + 37, y + 11, time, p, "orange");
  }
  if (program.scene === "coast" && program.cast === "fisher") {
    for (let i = 0; i < 23; i++) rect(ctx, x + 12 + i, y + 8 - i / 2, 1, 1, p.brown);
    rect(ctx, x + 34, y - 3, 1, 39, p.light);
  }
}

function drawAmbientDetails(ctx, program, time, p) {
  const frame = Math.floor(time * 3);
  if (program.scene === "coast") {
    for (let i = 0; i < 14; i++) {
      rect(ctx, (i * 29 + time * 4) % 310, 94 + i % 7 * 5, 7 + i % 4, 1, p.light);
    }
    sprite(ctx, "gull", 225 + Math.sin(time / 4) * 28, 54 + Math.sin(time) * 2, time, p);
  }
  if (program.scene === "skyline") {
    rect(ctx, 268, 108 + frame % 2 * 6, 2, 4, p.white);
    if (program.setting === "cafe") {
      for (let i = 0; i < 3; i++) rect(ctx, 233 + Math.sin(time * 2 + i) * 2, 123 - i * 3, 2, 1, p.light);
    }
  }
  if (program.scene === "castle") {
    for (const x of [109, 204]) {
      const h = 5 + frame % 3;
      rect(ctx, x - 2, 98 - h, 7, h, p.orange);
      rect(ctx, x, 100 - h, 3, h - 1, p.gold);
    }
  }
  if (program.scene === "handheld") {
    for (const x of [45, 138, 240]) {
      const w = [5, 3, 1, 3][frame % 4];
      rect(ctx, x + (5 - w) / 2, 80 + Math.floor(x / 100) * 5, w, 7, p.gold);
    }
  }
  if (program.scene === "overworld" && program.setting === "mill") {
    const angle = time * 0.4;
    for (let arm = 0; arm < 4; arm++) {
      for (let r = 4; r < 32; r++) {
        const a = angle + arm * Math.PI / 2;
        rect(ctx, 218 + Math.cos(a) * r, 78 + Math.sin(a) * r, 3, 3, r > 13 ? p.light : p.brown);
      }
    }
    disk(ctx, 219, 79, 4, p.ink);
  }
  if (["code-tunnel", "chip-studio"].includes(program.scene)) {
    const x = program.scene === "code-tunnel" ? 159 : 175;
    const y = program.scene === "code-tunnel" ? 97 : 88;
    rect(ctx, x, y, 4, 1, frame % 2 ? p.gold : p.pine);
  }
  if (program.scene === "quiz-stage") {
    for (let i = 0; i < 4; i++) rect(ctx, 144 + i * 35 + frame % 5, 105, 2, 2, p.gold);
  }
  if (program.scene === "plasma") {
    for (let i = 0; i < 11; i++) rect(ctx, 22 + i * 25, 24, 6, 2, (i + frame) % 3 ? p.red : p.cyan);
  }
  if (program.scene === "cosmos") {
    for (const x of [32, 157, 278]) rect(ctx, x - 1, 118, 5, 2, frame % 4 ? p.red : p.gold);
  }
}

function drawAtmosphere(ctx, program, time, p) {
  const type = program.atmosphere;
  const indoor = ["code-tunnel", "chip-studio"].includes(program.scene);
  if (type === "rain") {
    for (let i = 0; i < (indoor ? 16 : 65); i++) {
      const x = indoor ? 35 + (i * 31 + time * 12) % 64 : (i * 47 + time * 16) % 320;
      const y = indoor ? 35 + (i * 19 + time * 70) % 49 : (i * 29 + time * 70) % 148;
      rect(ctx, x, y, 1, 3, p.blue);
    }
    if (!indoor) {
      for (let i = 0; i < 13; i++) rect(ctx, i * 27, 146 + i % 5 * 4, 3 + Math.floor(time * 4 + i) % 5, 1, p.blue);
    }
  } else if (type === "leaves" || type === "confetti" || type === "embers") {
    for (let i = 0; i < 17; i++) {
      const x = (i * 47 + time * 5 + Math.sin(time + i) * 8) % 320;
      const y = type === "embers" ? 134 - (i * 7 + time * 9) % 85 : (i * 19 + time * 8) % 156;
      rect(ctx, x, y, type === "embers" ? 1 : 2, 1, [p.gold, p.orange, p.red][i % 3]);
    }
  } else if (type === "fireflies" || type === "stars" || type === "meteors") {
    for (let i = 0; i < 22; i++) {
      if ((Math.floor(time * 2) + i) % 5 > 1) continue;
      const x = indoor ? 37 + i * 13 % 61 : 8 + i * 53 % 300;
      const y = indoor ? 37 + i * 7 % 46 : type === "fireflies" ? 88 + i * 13 % 56 : 18 + i * 17 % 66;
      rect(ctx, x, y, 1, 1, p.gold);
    }
    if (type === "meteors" && time % 9 < 1) {
      for (let i = 0; i < 12; i++) rect(ctx, 174 + time % 9 * 67 + i, 15 + time % 9 * 19 + i / 3, 1, 1, p.light);
    }
  } else if (type === "breeze" || type === "mist") {
    for (let i = 0; i < 4; i++) {
      const x = ((i * 92 + time * 3) % 380) - 50;
      const y = type === "mist" ? 123 + i % 2 * 8 : 22 + i % 3 * 8;
      rect(ctx, x, y, 32, 1, p.stone);
      rect(ctx, x + 8, y - 2, 16, 1, p.stone);
    }
  } else if (type === "sunset") {
    for (let i = 0; i < 6; i++) rect(ctx, 230 - i * 3 + Math.sin(time + i) * 2, 98 + i * 4, 14 + i * 5, 1, p.gold);
  } else if (type === "beacon" || type === "clear") {
    // Additional tiny lights complement the scene-specific animated machinery.
    for (const x of [22, 117, 292]) rect(ctx, x, 19, 2, 1, Math.floor(time * 2 + x) % 3 ? p.red : p.gold);
  }
}

const backgrounds = new Map();
function sceneKey(program) {
  return program.roomId + ":" + program.setting + ":" + program.atmosphere;
}

export function renderPixelScene(canvas, program, elapsed = 0) {
  if (!validateVisualProgram(program, program?.roomId)) return;
  // Fixed logical coordinates prevent giant sprites in small thumbnails and
  // aspect-ratio-dependent layouts. CSS contains the complete scene on phones.
  if (canvas.width !== ART_WIDTH) canvas.width = ART_WIDTH;
  if (canvas.height !== ART_HEIGHT) canvas.height = ART_HEIGHT;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const p = program.roomId === "kaaos" ? HANDHELD : PALETTE;
  const key = sceneKey(program);
  let backdrop = backgrounds.get(key);
  if (!backdrop) {
    backdrop = document.createElement("canvas");
    backdrop.width = ART_WIDTH;
    backdrop.height = ART_HEIGHT;
    drawSetting(backdrop.getContext("2d"), program, p);
    // Keep at most 24 cached 320×180 backgrounds (about 5.3 MiB of pixels).
    if (backgrounds.size >= 24) backgrounds.delete(backgrounds.keys().next().value);
    backgrounds.set(key, backdrop);
  }
  ctx.drawImage(backdrop, 0, 0);
  // Quantized time gives sprite animation a deliberate twelve-frame cadence.
  const time = Math.floor(Math.max(0, elapsed) * 12) / 12;
  drawAmbientDetails(ctx, program, time, p);
  drawCast(ctx, program, time, p);
  drawAtmosphere(ctx, program, time, p);
}
