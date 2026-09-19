// Jev chooses anatomical proportions and details; this small rasterizer turns
// those choices into a shared spatial guide for its independent pixel questions.
// No finished sprite from the fallback library is sent to the model.
const DESIGNS = {
  person: {
    shape: { slim: "Slender explorer", broad: "Broad-shouldered chibi character", round: "Round-headed compact character" },
    detail: { hood: "Pointed hood", headphones: "Tousled hair and headphones", helmet: "Round visor helmet", hat: "Small brimmed hat" },
    marking: { scarf: "Bright scarf", satchel: "Shoulder strap and satchel", vest: "Vest with bright buttons" },
  },
  cat: {
    shape: { sitting: "Small sitting cat", plump: "Round fluffy cat", tall: "Tall alert cat" },
    detail: { raised: "Raised tail", curled: "Curled tail", low: "Low sweeping tail" },
    marking: { tabby: "Tabby stripes", tuxedo: "Pale chest and muzzle", patched: "Patches of pale fur" },
  },
  fox: {
    shape: { slender: "Slender fox", round: "Round fluffy fox", sturdy: "Sturdy woodland fox" },
    detail: { raised: "Upright bushy tail", swept: "Swept-back tail", curled: "Curled bushy tail" },
    marking: { mask: "Cream cheek mask", socks: "Pale paws and tail tip", blaze: "Pale forehead blaze" },
  },
  robot: {
    shape: { square: "Boxy robot", round: "Rounded robot", tall: "Tall narrow robot" },
    detail: { antenna: "Single antenna", ears: "Round side receivers", visor: "Wide face visor" },
    marking: { panel: "Control panel", stripes: "Bright body stripes", badge: "Bright chest badge" },
  },
  fern: {
    shape: { fan: "Wide fan of fronds", tall: "Tall upright fronds", cascade: "Cascading fronds" },
    detail: { round: "Rounded terracotta pot", square: "Square planter", banded: "Banded terracotta pot" },
    marking: { lush: "Dense leaf clusters", fine: "Fine pointed leaves", broad: "Broad leaf clusters" },
  },
  mushroom: {
    shape: { dome: "Domed cap", flat: "Wide flat cap", pointed: "Pointed cap" },
    detail: { short: "Short stem", tall: "Tall stem", wide: "Thick stem" },
    marking: { spots: "Large white spots", rim: "Pale cap rim", speckles: "Small white spots" },
  },
  gull: {
    shape: { wide: "Long wings", compact: "Short compact wings", swept: "Swept wings" },
    detail: { raised: "Raised wingbeat", level: "Level glide", down: "Low wingbeat" },
    marking: { tips: "Dark wing tips", band: "Dark wing bands", pale: "Mostly white plumage" },
  },
  crate: {
    shape: { square: "Square frame", bevel: "Bevelled corners", double: "Double outer frame" },
    detail: { cross: "Cross braces", diagonal: "Single diagonal brace", bars: "Vertical braces" },
    marking: { rivet: "Dark corner rivets", grain: "Dark wood grain", label: "Small pale shipping label" },
  },
};

export function spriteDesignQuestions(name) {
  return Object.fromEntries(Object.entries(DESIGNS[name]).map(([key, criteria]) => [key, {
    type: "choice", criteria,
    instructions: `Which ${key} should this original ${name} sprite have? Match the subject, cast and room.`,
  }]));
}

export function readSpriteDesign(name, response) {
  const result = {};
  for (const [key, options] of Object.entries(DESIGNS[name])) {
    const value = response?.answers?.[key]?.choice;
    if (!Object.hasOwn(options, value)) throw new Error("Invalid sprite design");
    result[key] = value;
  }
  return result;
}

export function spriteGuide(spec, design, phase = 0) {
  const { name, width, height } = spec;
  const { shape, detail, marking } = design;
  const grid = Array.from({ length: height }, () => Array(width).fill("."));
  const pixel = (x, y, c) => { if (x >= 0 && y >= 0 && x < width && y < height) grid[y][x] = c; };
  const rect = (x, y, w, h, c) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) pixel(xx, yy, c);
  };
  const box = (x, y, w, h, c) => { rect(x, y, w, h, "k"); rect(x + 1, y + 1, w - 2, h - 2, c); };
  const oval = (x, y, rx, ry, c) => {
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
      if (dx * dx / (rx * rx) + dy * dy / (ry * ry) <= 1.1) pixel(x + dx, y + dy, c);
    }
  };
  const round = (x, y, rx, ry, c) => { oval(x, y, rx, ry, "k"); oval(x, y, Math.max(1, rx - 1), Math.max(1, ry - 1), c); };
  const line = (x, y, xx, yy, c) => {
    const steps = Math.max(Math.abs(xx - x), Math.abs(yy - y));
    for (let i = 0; i <= steps; i++) pixel(Math.round(x + (xx - x) * i / (steps || 1)), Math.round(y + (yy - y) * i / (steps || 1)), c);
  };

  if (name === "person") {
    const radius = shape === "round" ? 5 : 4;
    const body = shape === "broad" ? 9 : shape === "slim" ? 5 : 7;
    const left = 7 - Math.floor(body / 2);
    round(7, 5, radius, 4, "s");
    if (detail === "helmet") {
      round(7, 4, radius, 4, "L");
      box(7 - radius + 1, 4, radius * 2 - 1, 4, "b");
      rect(5, 5, 2, 1, "w");
    } else {
      rect(3, 2, 9, 2, "r");
      if (detail === "hood") { rect(5, 0, 4, 2, "k"); rect(6, 1, 2, 2, "R"); }
      if (detail === "hat") { rect(3, 1, 8, 2, "k"); rect(2, 3, 11, 1, "R"); }
      if (detail === "headphones") { rect(2, 4, 2, 3, "k"); rect(11, 4, 2, 3, "k"); pixel(6, 1, "r"); pixel(8, 0, "k"); }
      pixel(5, 5, "k"); pixel(9, 5, "k"); pixel(7, 7, "R");
    }
    box(left, 9, body, 7, "r");
    line(left + 1, 10, left + 1, 13, "R");
    rect(left - 1, 10, 1, 5, "k"); rect(left + body, 10, 1, 5, "k");
    pixel(left - 1, 14, "s"); pixel(left + body, 14, "s");
    if (marking === "scarf") { rect(left, 9, body, 1, "R"); rect(left + body - 2, 10, 2, 3, "R"); }
    if (marking === "satchel") { line(left + 1, 10, left + body - 2, 14, "b"); box(left + body - 2, 12, 3, 4, "R"); }
    if (marking === "vest") { rect(6, 10, 3, 4, "b"); pixel(7, 11, "w"); pixel(7, 13, "w"); }
    rect(4, 15, 7, 2, "k"); rect(5, 15, 5, 1, "b");
    const foot = phase ? 1 : 0;
    rect(4 - foot, 16, 3, 3, "k"); rect(5 - foot, 16, 1, 3, "b");
    rect(8 + foot, 16, 3, 3, "k"); rect(9 + foot, 16, 1, 3, "b");
    rect(3 - foot, 19, 4, 1, "k"); rect(8 + foot, 19, 4, 1, "k");
  } else if (name === "cat") {
    round(11, 7, shape === "plump" ? 6 : 5, 3, "r");
    round(6, 4, shape === "tall" ? 3 : 4, 3, "r");
    line(2, 0, 5, 3, "k"); line(10, 0, 8, 3, "k");
    line(2, 0, 2, 4, "k"); line(10, 0, 10, 4, "k");
    pixel(3, 2, "R"); pixel(9, 2, "R");
    pixel(4, 4, phase ? "k" : "w"); pixel(8, 4, phase ? "k" : "w");
    pixel(6, 5, "k"); rect(5, 6, 3, 1, "s");
    rect(6, 10, 2, 1, "k"); rect(13, 10, 2, 1, "k");
    const tailY = detail === "raised" ? 2 : detail === "curled" ? 4 : 7;
    line(15, 8, 18, tailY, "k"); line(16, 8, 19, tailY, "r"); pixel(18, tailY - 1 + phase, "k");
    if (marking === "tabby") for (const x of [9, 12, 15]) line(x, 6, x - 1, 8, "b");
    if (marking === "tuxedo") rect(5, 7, 3, 2, "s");
    if (marking === "patched") rect(10, 6, 3, 2, "s");
  } else if (name === "fox") {
    const radius = shape === "round" ? 6 : 5;
    round(4, detail === "raised" ? 6 : 9, 4, detail === "curled" ? 4 : 3, "r");
    oval(2, detail === "raised" ? 5 : 8, 2, 2, "s");
    round(12, 9, radius, shape === "slender" ? 3 : 4, "R");
    round(14, 4, 4, 3, "r");
    line(10, 0, 10, 4, "k"); line(10, 0, 13, 3, "k");
    line(17, 0, 17, 4, "k"); line(17, 0, 15, 3, "k");
    pixel(12, 4, phase ? "k" : "w"); pixel(16, 4, phase ? "k" : "w");
    rect(13, 6, 4, 1, "s"); pixel(17, 5, "k");
    if (marking === "mask") { pixel(11, 5, "s"); pixel(16, 5, "s"); }
    if (marking === "blaze") line(14, 2, 14, 5, "s");
    for (const x of [9, 15]) { rect(x, 11, 2, 3, "b"); rect(x - 1, 14, 3, 1, marking === "socks" ? "s" : "k"); }
  } else if (name === "robot") {
    const head = shape === "tall" ? 8 : 10;
    const x = 7 - head / 2;
    if (detail === "antenna") { line(7, 0, 7, 3, "k"); pixel(7, 0, "r"); }
    if (shape === "round") round(7, 6, 5, 4, "L"); else box(x, 3, head, 7, "L");
    box(x + 1, 5, head - 2, 4, "c");
    pixel(5, 6, phase ? "c" : "k"); pixel(9, 6, phase ? "c" : "k");
    if (detail === "ears") { box(0, 5, 3, 3, "r"); box(12, 5, 3, 3, "r"); }
    if (detail === "visor") rect(x + 1, 5, head - 2, 1, "b");
    box(3, 10, 9, 6, "L");
    box(1, 11, 3, 4, "L"); box(11, 11, 3, 4, "L");
    if (marking === "panel") box(5, 11, 5, 3, "c");
    if (marking === "stripes") { rect(4, 11, 7, 1, "r"); rect(4, 14, 7, 1, "r"); }
    if (marking === "badge") rect(6, 11, 3, 2, "r");
    rect(4, 16, 3, 2, "k"); rect(8, 16, 3, 2, "k");
  } else if (name === "fern") {
    const top = shape === "tall" ? 0 : 2;
    line(8, 10, 8, top, "g");
    for (let branch = 0; branch < 3; branch++) for (const side of [-1, 1]) {
      const x = 8 + side * (shape === "tall" ? 3 + branch : 6 - branch);
      const y = shape === "cascade" ? 5 + branch : 1 + branch * 2;
      line(8, 8 - branch, x, y, "g");
      if (marking === "fine") line(x, y, x + side, y - 1, "G");
      else oval(x, y, marking === "broad" ? 2 : 1, 1, "G");
      pixel(8 + side * 2, 6 - branch, "G");
    }
    box(detail === "square" ? 4 : 5, 9, detail === "square" ? 8 : 6, 5, "r");
    rect(4, 9, 8, 1, "k"); rect(5, 10, 6, 1, "R");
    if (detail === "banded") rect(6, 12, 4, 1, "R");
  } else if (name === "mushroom") {
    const stem = detail === "wide" ? 5 : 3;
    box(6 - Math.floor(stem / 2), 3, stem, 5, "s");
    if (shape === "flat") { round(6, 3, 5, 2, "r"); }
    else if (shape === "pointed") { for (let y = 0; y <= 4; y++) { rect(5 - y, y, 2 + y * 2, 1, "k"); if (y > 0) rect(6 - y, y, y * 2, 1, "r"); } }
    else round(6, detail === "tall" ? 2 : 3, 5, 3, "r");
    if (marking === "rim") rect(3, 4, 6, 1, "s");
    else for (const [x, y] of [[4, 2], [8, 2], [6, 1]]) rect(x, y, marking === "spots" ? 2 : 1, 1, "w");
    const capBottom = detail === "tall" ? 3 : 4;
    rect(0, capBottom + 1, width, height - capBottom - 1, ".");
    box(6 - Math.floor(stem / 2), capBottom, stem, height - capBottom, "s");
  } else if (name === "gull") {
    const end = shape === "compact" ? 2 : 0;
    const tipY = phase ? 4 : detail === "raised" ? 0 : detail === "down" ? 4 : 2;
    line(5, 3, end, tipY, "k"); line(6, 3, 11 - end, tipY, "k");
    line(5, 2, end + 1, Math.max(0, tipY - 1), "w"); line(6, 2, 10 - end, Math.max(0, tipY - 1), "w");
    box(4, 2, 4, 3, "w"); pixel(6, 5, "k"); pixel(8, 3, "b");
    if (marking === "band") { pixel(2, tipY, "b"); pixel(9, tipY, "b"); }
    if (marking === "pale") { pixel(end, tipY, "w"); pixel(11 - end, tipY, "w"); }
  } else if (name === "crate") {
    box(0, 0, 16, 16, "r"); box(2, 2, 12, 12, "R"); rect(3, 3, 10, 10, "r");
    if (shape === "bevel") for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15]]) pixel(x, y, ".");
    if (shape === "double") box(4, 4, 8, 8, "r");
    if (detail !== "bars") line(3, 3, 12, 12, "R");
    if (detail === "cross") line(12, 3, 3, 12, "R");
    if (detail === "bars") for (const x of [5, 10]) line(x, 3, x, 12, "R");
    if (marking === "rivet") for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) pixel(x, y, "k");
    if (marking === "grain") for (const y of [5, 9]) line(6, y, 9, y, "k");
    if (marking === "label") box(8, 4, 5, 4, "R");
  }
  return grid.map((row) => row.join(""));
}
