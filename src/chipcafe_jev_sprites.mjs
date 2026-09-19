import { ART_DIRECTIONS, spriteReference, validateVisualProgram } from "./chipcafe_art.mjs";
import { readSpriteDesign, spriteDesignQuestions, spriteGuide } from "./chipcafe_sprite_design.mjs";

// Bound each request well below Jev's shared state/questions token budget.
export const PIXELS_PER_REQUEST = 96;
const COLOURS = Object.freeze({
  ".": "Transparent background", k: "Dark ink outline", r: "Main fabric or fur",
  R: "Warm highlight", s: "Skin or cream fur", w: "White eye or shine",
  b: "Blue-grey shadow", L: "Pale metal", c: "Cyan screen", g: "Dark leaf", G: "Green leaf",
});
const MATERIALS = {
  person: ".krRswbL", cat: ".krRswb", fox: ".krRswb", robot: ".krbLcw",
  fern: ".kgGrR", mushroom: ".krRsw", gull: ".kwb", crate: ".krR",
};
const PEOPLE = {
  cvgm: "Night commuter wearing headphones, a short hooded jacket and a shoulder bag; no peaked cap",
  rainwave: "Harbor sailor with a wool beanie, striped shirt and weatherproof boots",
  nectarine: "Woodland ranger with a pointed hood, leaf brooch, belt and hiking boots",
  slay: "Castle guard with a silver helmet, shoulder armour and a small bright tabard",
  kaaos: "Pocket-sized explorer with spiky hair, scarf, backpack and chunky boots",
  kohina: "Astronaut with a round helmet, dark visor, life-support backpack and spacesuit",
  "keygen-fm": "Night coder with tousled hair, headphones, a hoodie and rolled-up sleeves",
  "sid-station": "Synth musician with long hair, headphones, a vest and dark trousers",
  rpgn: "Fantasy traveler with a feathered hat, short cloak, satchel and sturdy boots",
  radiosega: "Racing driver with a visor helmet, bright jacket and gloves",
  "gtt-radio": "Arcade player with a backwards cap, varsity jacket and trainers",
  ericade: "Stage performer with spiky hair, dark glasses, a bright jacket and boots",
};
const SUBJECTS = {
  cat: "A sitting tabby cat with pointed ears, bright eyes, striped fur and a curled tail on the right",
  fox: "A woodland fox with pointed ears, white muzzle, four paws and a bushy cream-tipped tail on the left",
  robot: "A friendly service robot with a small antenna, cyan face screen, metal body and short jointed limbs",
  fern: "A lush potted fern with arching green fronds, dark stems and a terracotta pot",
  mushroom: "A red woodland mushroom with white cap spots, a shaded cream stalk and dark outline",
  gull: "A small white seabird in flight with spread wings, dark wing tips and a tiny beak",
  crate: "A wooden supply crate with a square outer frame, diagonal braces and warm highlights",
};

export function spriteSpec(program, name) {
  if (!validateVisualProgram(program, program?.roomId) || !Object.hasOwn(MATERIALS, name)) return null;
  const reference = spriteReference(name);
  const art = ART_DIRECTIONS[program.roomId];
  const criteria = Object.fromEntries([...MATERIALS[name]].map((key) => [key, COLOURS[key]]));
  return {
    name, width: reference[0][0].length, height: reference[0].length, criteria,
    state: {
      task: "paint_sprite", room: program.roomId, scene: art.title,
      setting: art.settings[program.setting], cast: art.cast[program.cast],
      sprite: name, subject: name === "person" ? PEOPLE[program.roomId] : SUBJECTS[name],
      grid: { width: reference[0][0].length, height: reference[0].length, origin: "top-left, zero-based x and y" },
      palette: criteria,
      art_direction: "Design a recognizable 8-bit game sprite for this room and subject. Use clean proportions, separate eyes, connected limbs and a one-pixel dark border. Keep the background transparent. No lettering or dithering.",
    },
  };
}

export function pixelBatches(spec, pixels, state = spec.state) {
  const batches = [];
  for (let start = 0; start < pixels.length; start += PIXELS_PER_REQUEST) {
    const cells = pixels.slice(start, start + PIXELS_PER_REQUEST);
    const questions = Object.fromEntries(cells.map(([x, y]) => [
      `pixel_${x}_${y}`,
      {
        type: "choice",
        instructions: `Paint pixel x=${x}, y=${y} of the ${spec.name}. Reference: '${state.reference_grid[y][x]}' (${spec.criteria[state.reference_grid[y][x]]}), row '${state.reference_grid[y]}'. ${state.reference_grid[y][x] === "." ? "This is empty space: choose transparent unless a one-pixel adjustment to an adjacent outline is essential. Never add an unattached mark." : "Preserve this anatomical detail, customizing its colour for the subject. Keep outlines thin and eyes distinct."}`,
        criteria: spec.criteria,
      },
    ]));
    batches.push({ state, questions, cells });
  }
  return batches;
}

function allPixels(spec) {
  return Array.from({ length: spec.width * spec.height }, (_, index) => [index % spec.width, Math.floor(index / spec.width)]);
}

export function validateSpriteFrame(frame, spec) {
  if (!Array.isArray(frame) || frame.length !== spec.height
    || frame.some((row) => typeof row !== "string" || row.length !== spec.width
      || [...row].some((cell) => !Object.hasOwn(spec.criteria, cell)))) return false;
  const occupied = new Set();
  const colours = new Set();
  frame.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell !== ".") { occupied.add(y * spec.width + x); colours.add(cell); }
  }));
  // Empty, solid, single-colour or fragmented responses keep the fallback art.
  if (occupied.size < spec.width * spec.height * 0.12
    || (spec.name !== "crate" && occupied.size > spec.width * spec.height * 0.95)
    || colours.size < 2 || !colours.has("k")) return false;
  const unseen = new Set(occupied);
  let largest = 0;
  while (unseen.size) {
    const stack = [unseen.values().next().value];
    unseen.delete(stack[0]);
    let size = 0;
    while (stack.length) {
      const pixel = stack.pop();
      size++;
      const x = pixel % spec.width;
      const y = Math.floor(pixel / spec.width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= spec.width || ny < 0 || ny >= spec.height) continue;
        const neighbour = ny * spec.width + nx;
        if (unseen.delete(neighbour)) stack.push(neighbour);
      }
    }
    largest = Math.max(largest, size);
  }
  return largest >= occupied.size * 0.9;
}

function motionPixels(spec) {
  return allPixels(spec).filter(([x, y]) => {
    if (spec.name === "person") return y >= 15;
    if (spec.name === "cat") return x >= 14 || (y === 4 && x >= 4 && x <= 10);
    if (spec.name === "fox") return y === 4 && x >= 10 && x <= 17;
    if (spec.name === "robot") return y === 6 && x >= 4 && x <= 9;
    return spec.name === "gull";
  });
}

async function paintFrame(spec, batches, request, signal, previous) {
  const frame = previous ? previous.map((row) => [...row])
    : Array.from({ length: spec.height }, () => Array(spec.width).fill("."));
  for (const { state, questions, cells } of batches) {
    signal.throwIfAborted();
    const response = await request({ state, questions });
    signal.throwIfAborted();
    for (const [x, y] of cells) {
      const colour = response?.answers?.[`pixel_${x}_${y}`]?.choice;
      if (typeof colour !== "string" || !Object.hasOwn(spec.criteria, colour)) throw new Error("Invalid sprite pixel");
      frame[y][x] = colour;
    }
  }
  const rows = frame.map((row) => row.join(""));
  if (!validateSpriteFrame(rows, spec)) throw new Error("Invalid sprite shape");
  return Object.freeze(rows);
}

export async function generateSprite(program, name, request, signal) {
  const spec = spriteSpec(program, name);
  if (!spec) throw new Error("Unknown sprite");
  signal.throwIfAborted();
  const response = await request({ state: { ...spec.state, task: "design_sprite" }, questions: spriteDesignQuestions(name) });
  signal.throwIfAborted();
  const design = readSpriteDesign(name, response);
  spec.state = {
    ...spec.state, design, reference_grid: spriteGuide(spec, design),
    art_direction: "Paint this sprite using the spatial guide rasterized from your design choices. Preserve its proportions, separate eyes, connected limbs and thin outline. Customize interior colours for the subject. Keep transparent space empty unless making a one-pixel edge adjustment. Do not add noise or disconnected pixels. Every question paints one cell of the same sprite.",
  };
  const base = await paintFrame(spec, pixelBatches(spec, allPixels(spec)), request, signal);
  const pixels = motionPixels(spec);
  if (pixels.length === 0) return Object.freeze([base]);
  const nextGuide = spriteGuide(spec, design, 1);
  const pose = base.map((row) => [...row]);
  for (const [x, y] of pixels) {
    pose[y][x] = nextGuide[y][x];
  }
  const state = {
    ...spec.state, reference_grid: pose.map((row) => row.join("")), base_frame: base, task: "animate_sprite",
    art_direction: "Paint the next pose of this exact sprite using reference_grid as the pose guide and base_frame for its identity and colours. Keep unasked pixels unchanged. The person takes a small step; the cat blinks; the fox blinks; the robot blinks its screen eyes; the gull lowers its wings. This is one frame of a gentle two-frame loop. Preserve the guide's thin outlines and transparent background.",
  };
  try {
    const next = await paintFrame(spec, pixelBatches(spec, pixels, state), request, signal, base);
    return Object.freeze(base.join("") === next.join("") ? [base] : [base, next]);
  } catch (_error) {
    signal.throwIfAborted();
    // A failed optional motion pass must not throw away a complete base sprite.
    return Object.freeze([base]);
  }
}
