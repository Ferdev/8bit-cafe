import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/string
import lustre
import lustre/attribute
import lustre/effect.{type Effect}
import lustre/element.{type Element}
import lustre/element/html
import lustre/element/keyed
import lustre/event

// ---------------------------------------------------------------- identity

pub const station_name = "8BIT.CAFE"

pub const dj_name = "DJ PIXEL"

pub const station_tagline = "ONE CHANNEL · ONE AUTO-DJ · ALL CHIPTUNE"

// ------------------------------------------------------------------ model

/// A chiptune release from the cafe's roster. The DJ plays the newest one
/// first and keeps mixing down the list, oldest-but-still-latest last.
pub type Track {
  Track(
    id: String,
    artist: String,
    title: String,
    released: String,
    bpm: Int,
    key: String,
    seed: Int,
    accent: String,
    accent_alt: String,
  )
}

pub type StreamStatus {
  Tuning
  Live
  Blocked
  Failed
}

pub type Model {
  Model(queue: List(Track), status: StreamStatus, mixes: Int, muted: Bool)
}

// ---------------------------------------------------------------- catalog

/// The station playlist: newest release first. The auto-DJ walks this list in
/// order and loops back to the top, so the freshest material always opens the
/// set.
pub fn catalog() -> List(Track) {
  [
    Track(
      id: "neon-cartridge",
      artist: "KILOBYTE KID",
      title: "NEON CARTRIDGE",
      released: "2026-10-21",
      bpm: 152,
      key: "A MINOR",
      seed: 90_210,
      accent: "#3ae8ff",
      accent_alt: "#ff3ad4",
    ),
    Track(
      id: "sunset-arcade",
      artist: "MIRA 8",
      title: "SUNSET ARCADE",
      released: "2026-10-14",
      bpm: 132,
      key: "E MINOR",
      seed: 48_151,
      accent: "#ffb03a",
      accent_alt: "#ff3ad4",
    ),
    Track(
      id: "forest-frequency",
      artist: "THE BITSMITHS",
      title: "FOREST FREQUENCY",
      released: "2026-10-03",
      bpm: 118,
      key: "D MAJOR",
      seed: 77_321,
      accent: "#3affa0",
      accent_alt: "#b46bff",
    ),
    Track(
      id: "boss-rush",
      artist: "NULLPOINTER",
      title: "BOSS RUSH",
      released: "2026-09-26",
      bpm: 168,
      key: "F MINOR",
      seed: 63_104,
      accent: "#ff3a3a",
      accent_alt: "#ffb03a",
    ),
    Track(
      id: "sid-sanctuary",
      artist: "PIXEL VEIL",
      title: "SID SANCTUARY",
      released: "2026-09-18",
      bpm: 96,
      key: "C MINOR",
      seed: 22_778,
      accent: "#b46bff",
      accent_alt: "#3ae8ff",
    ),
    Track(
      id: "moonlit-modem",
      artist: "GLITCH GRRRL",
      title: "MOONLIT MODEM",
      released: "2026-09-09",
      bpm: 140,
      key: "G MINOR",
      seed: 55_031,
      accent: "#8a84b0",
      accent_alt: "#3ae8ff",
    ),
    Track(
      id: "overworld-overdrive",
      artist: "HERTZ SO GOOD",
      title: "OVERWORLD OVERDRIVE",
      released: "2026-08-30",
      bpm: 158,
      key: "B MAJOR",
      seed: 31_415,
      accent: "#9bbc0f",
      accent_alt: "#ffb03a",
    ),
    Track(
      id: "keygen-cathedral",
      artist: "CHIP DANGER",
      title: "KEYGEN CATHEDRAL",
      released: "2026-08-22",
      bpm: 124,
      key: "A MINOR",
      seed: 80_808,
      accent: "#ff3ad4",
      accent_alt: "#b46bff",
    ),
  ]
}

/// The track currently on the decks (the head of the queue).
pub fn now_playing(queue: List(Track)) -> Track {
  let assert [current, ..] = queue
  current
}

/// The track the DJ has already lined up next.
pub fn up_next(queue: List(Track)) -> Option(Track) {
  case queue {
    [_, next, ..] -> Some(next)
    _ -> None
  }
}

/// Rotate the queue so the auto-DJ always moves to the next newest release.
pub fn advance(queue: List(Track)) -> List(Track) {
  case queue {
    [] -> []
    [head, ..rest] -> list.append(rest, [head])
  }
}

/// How long a generated track runs, in whole seconds. Every track is 16 bars
/// of 16 steps at the listed BPM.
pub fn track_seconds(track: Track) -> Int {
  let assert Ok(seconds) = int.divide(16 * 16 * 60, track.bpm * 4)
  seconds
}

/// Zero-padded set counter used by the broadcast deck.
pub fn mix_number(mixes: Int) -> String {
  let text = int.to_string(mixes)
  case string.length(text) {
    1 -> "00" <> text
    2 -> "0" <> text
    _ -> text
  }
}

pub fn status_label(status: StreamStatus) -> String {
  case status {
    Tuning -> "TUNING"
    Live -> "ON AIR"
    Blocked -> "SOUND LOCKED"
    Failed -> "SIGNAL LOST"
  }
}

// ------------------------------------------------------------------- ffi

@external(erlang, "chipcafe_ffi", "start_dj")
@external(javascript, "./chipcafe_ffi.mjs", "startDj")
fn start_dj(
  track_id: String,
  bpm: Int,
  seed: Int,
  accent: String,
  accent_alt: String,
  on_finish: fn() -> Nil,
  on_status: fn(String) -> Nil,
) -> Nil

@external(erlang, "chipcafe_ffi", "play_track")
@external(javascript, "./chipcafe_ffi.mjs", "playTrack")
fn play_track(
  track_id: String,
  bpm: Int,
  seed: Int,
  accent: String,
  accent_alt: String,
) -> Nil

@external(erlang, "chipcafe_ffi", "set_muted")
@external(javascript, "./chipcafe_ffi.mjs", "setMuted")
fn set_muted(muted: Bool) -> Nil

// ------------------------------------------------------------------ update

pub type Msg {
  TrackFinished
  StatusChanged(String)
  ToggleMute
}

fn init(_) -> #(Model, Effect(Msg)) {
  let queue = catalog()
  let first = now_playing(queue)
  let model = Model(queue:, status: Tuning, mixes: 1, muted: False)
  let effect =
    effect.from(fn(dispatch) {
      start_dj(
        first.id,
        first.bpm,
        first.seed,
        first.accent,
        first.accent_alt,
        fn() { dispatch(TrackFinished) },
        fn(status) { dispatch(StatusChanged(status)) },
      )
    })
  #(model, effect)
}

fn update(model: Model, msg: Msg) -> #(Model, Effect(Msg)) {
  case msg {
    TrackFinished -> {
      let queue = advance(model.queue)
      let next = now_playing(queue)
      let model = Model(..model, queue:, mixes: model.mixes + 1)
      #(model, play_track_effect(next))
    }
    StatusChanged("live") -> #(Model(..model, status: Live), effect.none())
    StatusChanged("blocked") -> #(
      Model(..model, status: Blocked),
      effect.none(),
    )
    StatusChanged("failed") -> #(Model(..model, status: Failed), effect.none())
    StatusChanged(_) -> #(model, effect.none())
    ToggleMute -> {
      let muted = !model.muted
      let effect = effect.from(fn(_) { set_muted(muted) })
      #(Model(..model, muted:), effect)
    }
  }
}

fn play_track_effect(track: Track) -> Effect(Msg) {
  effect.from(fn(_) {
    play_track(track.id, track.bpm, track.seed, track.accent, track.accent_alt)
  })
}

// -------------------------------------------------------------------- view

fn view(model: Model) -> Element(Msg) {
  let track = now_playing(model.queue)
  let status_class = case model.status {
    Live -> "is-live"
    Blocked -> "is-blocked"
    Failed -> "is-failed"
    Tuning -> "is-tuning"
  }
  html.div(
    [
      attribute.class("dj-screen " <> status_class),
      attribute.style("--accent", track.accent),
      attribute.style("--accent-alt", track.accent_alt),
    ],
    [
      html.canvas([
        attribute.id("vj-art"),
        attribute.class("vj-art"),
        attribute.width(480),
        attribute.height(270),
        attribute.aria("hidden", "true"),
      ]),
      html.div([attribute.class("vj-shade")], []),
      view_topbar(model.status),
      view_deck(track, model),
      view_console(model),
      case model.status {
        Blocked -> view_sound_gate()
        _ -> element.none()
      },
    ],
  )
}

fn view_topbar(status: StreamStatus) -> Element(Msg) {
  html.header([attribute.class("topbar")], [
    html.div([attribute.class("brand")], [
      html.span([attribute.class("logo")], [element.text(station_name)]),
      html.span([attribute.class("brand-sub")], [element.text(station_tagline)]),
    ]),
    html.div([attribute.class("signal-cluster")], [
      html.span([attribute.class("dj-tag")], [
        element.text("AUTO-DJ · " <> dj_name),
      ]),
      html.span([attribute.class("on-air")], [
        html.span([attribute.class("on-air-dot")], []),
        element.text(status_label(status)),
      ]),
    ]),
  ])
}

fn view_deck(track: Track, model: Model) -> Element(Msg) {
  html.main([attribute.class("deck")], [
    html.section([attribute.class("now-card")], [
      html.p([attribute.class("eyebrow")], [element.text("NOW MIXING")]),
      html.h1([attribute.class("track-title")], [element.text(track.title)]),
      html.p([attribute.class("track-artist")], [
        element.text(track.artist),
        html.span([attribute.class("dot")], [element.text("·")]),
        element.text("RELEASED " <> track.released),
      ]),
      html.div([attribute.class("track-meta")], [
        html.span([], [element.text(int.to_string(track.bpm) <> " BPM")]),
        html.span([], [element.text(track.key)]),
        html.span([], [element.text("CHIPTUNE")]),
      ]),
      view_progress(track),
      html.div([attribute.class("mix-caption")], [
        html.span([], [element.text("MIX #" <> mix_number(model.mixes))]),
        html.span([], [element.text("LIVE BLEND · NO REQUESTS")]),
      ]),
    ]),
    view_next_card(track, model),
  ])
}

fn view_progress(track: Track) -> Element(Msg) {
  let duration = int.to_string(track_seconds(track)) <> "s"
  html.div([attribute.class("mix-progress"), attribute.aria("hidden", "true")], [
    keyed.element("div", [], [
      #(
        track.id,
        html.div(
          [
            attribute.class("mix-fill"),
            attribute.style("animation-duration", duration),
          ],
          [],
        ),
      ),
    ]),
  ])
}

fn view_next_card(track: Track, model: Model) -> Element(Msg) {
  let next = case up_next(model.queue) {
    Some(track) -> track
    None -> track
  }
  html.aside([attribute.class("next-card")], [
    html.p([attribute.class("eyebrow")], [element.text("UP NEXT")]),
    html.h2([attribute.class("next-title")], [element.text(next.title)]),
    html.p([attribute.class("next-artist")], [element.text(next.artist)]),
    html.div(
      [attribute.class("equalizer")],
      list.map(list.repeat(0, 12), fn(_) { html.span([], []) }),
    ),
    html.p([attribute.class("next-note")], [
      element.text("THE DJ IS ALREADY BEATMATCHING IT"),
    ]),
  ])
}

fn view_console(model: Model) -> Element(Msg) {
  let sound_label = case model.muted {
    True -> "SOUND OFF"
    False -> "SOUND ON"
  }
  html.footer([attribute.class("console")], [
    html.div([attribute.class("console-ticker")], [
      html.span([attribute.class("ticker-dot")], []),
      element.text(
        "BROADCASTING THE LATEST " <> "RELEASES FROM THE CAFE ROSTER",
      ),
    ]),
    html.div([attribute.class("console-controls")], [
      html.span([attribute.class("set-clock")], [element.text("24/7 · AUTO")]),
      html.button(
        [
          attribute.class("sound-btn"),
          attribute.aria_pressed(case model.muted {
            True -> "true"
            False -> "false"
          }),
          event.on_click(ToggleMute),
        ],
        [element.text(sound_label)],
      ),
    ]),
  ])
}

fn view_sound_gate() -> Element(Msg) {
  html.div([attribute.class("sound-gate")], [
    html.span([attribute.class("gate-icon")], [element.text("🔈")]),
    html.span([], [element.text("CLICK OR TAP ANYWHERE TO UNLOCK THE DECK")]),
  ])
}

// -------------------------------------------------------------------- main

pub fn main() {
  let app = lustre.application(init, update, view)
  let assert Ok(_) = lustre.start(app, "#app", Nil)
  Nil
}
