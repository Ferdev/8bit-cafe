# 8bit.cafe

8bit.cafe is a browser-based generative chiptune player. Each stage has its own
musical preset. The frontend generates valid 16-bar candidates, asks TypeSafe
AI's Jev model to choose the next continuation, and synthesizes the result with
the Web Audio API. Candidates follow an evolving intro/theme/lift/chorus/finale
form and layer eight tonal voices (lead, counter-melody, arpeggio, pulse, pad,
bass, chord stabs, and texture) over channel-specific drum and groove rules.
Recurring themes return between sections, while supporting layered oscillators
and per-voice filters give the arrangement depth without doubling the lead.
Each stage has its own original two-part melody and rhythmic grid, from broad
one-beat themes to rapid quarter-beat tracker lines. The arrangement repeats
that theme clearly across the block while Jev varies the surrounding harmony,
orchestration, intensity, and scene treatment.
Jev also composes the artwork and paints its sprite library. The
same request includes three independent typed choices: setting, cast, and
atmosphere. Each room has three settings, three casts, and three atmospheres
(27 combinations), including cafes, cottages, a harbor, a studio and an arcade.
Characters, tiled roofs, brickwork, shop signs, furniture and plants are drawn
on a fixed 320×180 pixel canvas with a sixteen-colour palette (four colours in
Pocket pulse). Character frames, water, rain, equipment and other small details
animate at twelve frames per second; reduced-motion mode shows a still frame.
Once music is buffered, the browser asks Jev to paint the room's character,
animal and small prop sprites. First Jev chooses proportions, features and
markings. The app rasterizes those choices into an anatomy guide, then each
typed pixel question chooses a palette colour or transparency. Finished sprites
from the fallback library are never sent as generation references. A separate
pass paints the moving parts of a second character
frame. Buildings, furniture, landscapes and the scene animation code remain
authored. No generated JavaScript or drawing commands are executed.

Painting runs in the background in batches of at most 96 pixel questions, up
to six requests per sprite, including its design (eight sprite types across the library). Only
sprites needed by the selected room are requested, one at a time, with a
six-second timeout and no automatic retry. Complete sheets are checked for
dimensions, palette and connected shapes before replacing the fallback art.
An unavailable or invalid result leaves the original sprite visible, and an
unavailable animation pass retains the generated base frame. Pausing or leaving
the room cancels pending requests. Validated sprites are cached per room for
the page visit, including across pause/resume, and shared with lobby thumbnails.
These extra pixel questions use the same browser key and its usage budget.

The lobby uses the same renderer and remembers the latest selected composition
for each room during the page visit. Before a room has played, its thumbnail
shows a local default without making an API call. Scene backgrounds are cached
by room, setting and atmosphere, with a limit of 24 cached backgrounds. The full
scene keeps its proportions and sits above the controls on narrow screens.
No additional service or credential is required. The credential-free debug
view `window.__chipcafePlayerDebug()` includes `spriteStatus`, `spriteApiCalls`,
`generatedSprites` and `generatedSpriteFrames` to distinguish painting,
validated results and fallback art.

The app remains a static Gleam/Lustre site. It has no application backend. When
a stage starts, the UI shows the current `STARTING AUDIO`, `COMPOSING`, and
`BUFFERING` phases. Playback begins after a complete block is scheduled, and a
rolling buffer is replenished while it plays. If Jev is unavailable, the browser
selects a valid continuation locally so playback can continue.

## Development

Requirements: Gleam 1.17, Erlang/OTP 27, and Node.js 20 or newer.

```sh
npm ci
gleam deps download
gleam test
npm test
tools/build.sh
node tools/preview-server.mjs dist 8000
```

`config.js` contains empty local defaults. To exercise Jev locally, set a
restricted test key in that file without committing it, or replace
`window.CHIPCAFE_CONFIG` before `chipcafe.js` loads:

```js
window.CHIPCAFE_CONFIG = {
  typesafeApiKey: "your-restricted-test-key",
  typesafeModel: "jev-latest",
};
```

TypeSafe's SDK requires `dangerouslyAllowBrowser: true` for this architecture.
That name is intentional: any credential sent to a public browser can be viewed
and reused by a visitor. Production must use a restricted/revocable browser key
with an explicit spend limit. The local server and production nginx relay only
the fixed `/typesafe/v1/systemone` path because TypeSafe currently rejects
cross-origin browser requests; candidate generation and SDK response handling
remain in the browser. Never commit a key or store it in localStorage.

## Production configuration

The nginx container writes public `config.js` at startup from:

- `TYPESAFE_API_KEY` — restricted TypeSafe browser credential
- `TYPESAFE_MODEL` — optional model alias; defaults to `jev-latest`

Kamal injects the key as a runtime secret. Rondar previews generate the same
public configuration after the bundle is built, using the preview runtime's
`RONDAR_PREVIEW_HOSTS` signal. Ordinary builds and CI retain the checked-in
empty placeholder even if their environment can access the key. CI and unit
tests use synthetic configuration and mocked decisions; they do not call
TypeSafe.
