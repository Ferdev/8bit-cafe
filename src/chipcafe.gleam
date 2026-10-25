import gleam/int
import gleam/option.{type Option, None, Some}
import gleam/string
import lustre
import lustre/attribute
import lustre/effect.{type Effect}
import lustre/element.{type Element}
import lustre/element/html
import lustre/event

// ---------------------------------------------------------------- identity

pub const station_name = "8BIT.CAFE"

pub const dj_name = "DJ PIXEL"

pub const station_tagline = "ONE CHANNEL · ONE AUTO-DJ · FRESH CHIPTUNE"

// ------------------------------------------------------------------ model

/// The release currently on the decks. The DJ engine fills this from the live
/// feed, so the UI never needs to know where the track came from.
pub type NowPlaying {
  NowPlaying(
    title: String,
    artist: String,
    album: String,
    released: String,
    artist_url: String,
    track_url: String,
    license: String,
    license_url: String,
    seconds: Int,
    accent: String,
    accent_alt: String,
  )
}

pub type UpNext {
  UpNext(title: String, artist: String)
}

pub type StreamStatus {
  Tuning
  Live
  Paused
  Blocked
  Failed
}

pub type Model {
  Model(
    now: NowPlaying,
    next: Option(UpNext),
    status: StreamStatus,
    mixes: Int,
    muted: Bool,
    playing: Bool,
    position: Int,
    duration: Int,
  )
}

fn placeholder() -> NowPlaying {
  NowPlaying(
    title: "TUNING THE FEED",
    artist: "8BIT.CAFE",
    album: "LATEST CHIPTUNE",
    released: "",
    artist_url: "",
    track_url: "",
    license: "",
    license_url: "",
    seconds: 0,
    accent: "#3ae8ff",
    accent_alt: "#ff3ad4",
  )
}

// ---------------------------------------------------------------- helpers

pub fn format_time(seconds: Int) -> String {
  let safe = case seconds < 0 {
    True -> 0
    False -> seconds
  }
  let assert Ok(minutes) = int.divide(safe, 60)
  let rest = safe % 60
  let suffix = case rest < 10 {
    True -> "0" <> int.to_string(rest)
    False -> int.to_string(rest)
  }
  int.to_string(minutes) <> ":" <> suffix
}

pub fn progress_percent(position: Int, duration: Int) -> Int {
  case duration <= 0 {
    True -> 0
    False -> {
      let assert Ok(percent) = int.divide(position * 100, duration)
      case percent {
        _ if percent < 0 -> 0
        _ if percent > 100 -> 100
        _ -> percent
      }
    }
  }
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
    Paused -> "PAUSED"
    Blocked -> "SOUND LOCKED"
    Failed -> "SIGNAL LOST"
  }
}

// ------------------------------------------------------------------- ffi

@external(erlang, "chipcafe_ffi", "start_dj")
@external(javascript, "./chipcafe_ffi.mjs", "startDj")
fn start_dj(
  on_track: fn(
    String,
    String,
    String,
    String,
    String,
    String,
    String,
    String,
    String,
    String,
    Int,
    String,
    String,
  ) -> Nil,
  on_progress: fn(Int, Int) -> Nil,
  on_state: fn(String, Bool) -> Nil,
) -> Nil

@external(erlang, "chipcafe_ffi", "toggle_playback")
@external(javascript, "./chipcafe_ffi.mjs", "togglePlayback")
fn toggle_playback() -> Nil

@external(erlang, "chipcafe_ffi", "next_track")
@external(javascript, "./chipcafe_ffi.mjs", "nextTrack")
fn next_track() -> Nil

@external(erlang, "chipcafe_ffi", "previous_track")
@external(javascript, "./chipcafe_ffi.mjs", "previousTrack")
fn previous_track() -> Nil

@external(erlang, "chipcafe_ffi", "set_muted")
@external(javascript, "./chipcafe_ffi.mjs", "setMuted")
fn set_muted(muted: Bool) -> Nil

// ------------------------------------------------------------------ update

pub type Msg {
  TrackChanged(NowPlaying, UpNext)
  ProgressChanged(Int, Int)
  StateChanged(String, Bool)
  ToggleMute
  TogglePlayback
  NextTrack
  PreviousTrack
}

fn init(_) -> #(Model, Effect(Msg)) {
  let model =
    Model(
      now: placeholder(),
      next: None,
      status: Tuning,
      mixes: 0,
      muted: False,
      playing: False,
      position: 0,
      duration: 0,
    )
  let effect =
    effect.from(fn(dispatch) {
      start_dj(
        fn(
          title,
          artist,
          album,
          released,
          artist_url,
          track_url,
          license,
          license_url,
          next_title,
          next_artist,
          seconds,
          accent,
          accent_alt,
        ) {
          dispatch(TrackChanged(
            NowPlaying(
              title:,
              artist:,
              album:,
              released:,
              artist_url:,
              track_url:,
              license:,
              license_url:,
              seconds:,
              accent:,
              accent_alt:,
            ),
            UpNext(title: next_title, artist: next_artist),
          ))
        },
        fn(position, duration) { dispatch(ProgressChanged(position, duration)) },
        fn(status, playing) { dispatch(StateChanged(status, playing)) },
      )
    })
  #(model, effect)
}

fn update(model: Model, msg: Msg) -> #(Model, Effect(Msg)) {
  case msg {
    TrackChanged(now, next) -> #(
      Model(
        ..model,
        now:,
        next: Some(next),
        mixes: model.mixes + 1,
        position: 0,
        duration: now.seconds,
      ),
      effect.none(),
    )
    ProgressChanged(position, duration) -> #(
      Model(..model, position:, duration: case duration {
        0 -> model.duration
        _ -> duration
      }),
      effect.none(),
    )
    StateChanged("live", playing) -> #(
      Model(..model, status: Live, playing:),
      effect.none(),
    )
    StateChanged("paused", playing) -> #(
      Model(..model, status: Paused, playing:),
      effect.none(),
    )
    StateChanged("blocked", playing) -> #(
      Model(..model, status: Blocked, playing:),
      effect.none(),
    )
    StateChanged("failed", playing) -> #(
      Model(..model, status: Failed, playing:),
      effect.none(),
    )
    StateChanged(_, playing) -> #(Model(..model, playing:), effect.none())
    ToggleMute -> {
      let muted = !model.muted
      let effect = effect.from(fn(_) { set_muted(muted) })
      #(Model(..model, muted:), effect)
    }
    TogglePlayback -> #(model, effect.from(fn(_) { toggle_playback() }))
    NextTrack -> #(model, effect.from(fn(_) { next_track() }))
    PreviousTrack -> #(model, effect.from(fn(_) { previous_track() }))
  }
}

// -------------------------------------------------------------------- view

fn view(model: Model) -> Element(Msg) {
  let status_class = case model.status {
    Live -> "is-live"
    Paused -> "is-paused"
    Blocked -> "is-blocked"
    Failed -> "is-failed"
    Tuning -> "is-tuning"
  }
  html.div(
    [
      attribute.class("dj-screen " <> status_class),
      attribute.style("--accent", model.now.accent),
      attribute.style("--accent-alt", model.now.accent_alt),
    ],
    [
      html.canvas([
        attribute.id("vj-art"),
        attribute.class("vj-art"),
        attribute.width(320),
        attribute.height(180),
        attribute.aria("hidden", "true"),
      ]),
      html.div([attribute.class("vj-shade")], []),
      view_topbar(model.status),
      view_deck(model),
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

fn view_deck(model: Model) -> Element(Msg) {
  html.main([attribute.class("deck")], [
    html.section([attribute.class("now-card")], [
      html.p([attribute.class("eyebrow")], [element.text("NOW MIXING")]),
      html.h1([attribute.class("track-title")], [element.text(model.now.title)]),
      html.p([attribute.class("track-artist")], [
        view_artist(model.now),
        case model.now.album {
          "" -> element.none()
          album ->
            html.span([attribute.class("album")], [
              html.span([attribute.class("dot")], [element.text("·")]),
              element.text(album),
            ])
        },
      ]),
      view_meta(model.now),
      view_transport(model),
      view_progress(model),
      view_caption(model),
    ]),
    view_next_card(model),
  ])
}

fn view_artist(now: NowPlaying) -> Element(Msg) {
  case now.artist_url {
    "" -> element.text(now.artist)
    href ->
      html.a(
        [
          attribute.href(href),
          attribute.target("_blank"),
          attribute.rel("noopener noreferrer"),
          attribute.class("artist-link"),
        ],
        [element.text(now.artist)],
      )
  }
}

fn view_meta(now: NowPlaying) -> Element(Msg) {
  html.div([attribute.class("track-meta")], [
    case now.released {
      "" -> element.none()
      released -> html.span([], [element.text("RELEASED " <> released)])
    },
    case now.license {
      "" -> element.none()
      license ->
        html.a(
          [
            attribute.href(now.license_url),
            attribute.target("_blank"),
            attribute.rel("noopener noreferrer"),
            attribute.class("meta-link"),
            attribute.title("License"),
          ],
          [element.text(license)],
        )
    },
    case now.track_url {
      "" -> element.none()
      track_url ->
        html.a(
          [
            attribute.href(track_url),
            attribute.target("_blank"),
            attribute.rel("noopener noreferrer"),
            attribute.class("meta-link"),
            attribute.title("Listen on Audius"),
          ],
          [element.text("AUDIUS ↗")],
        )
    },
  ])
}

fn view_transport(model: Model) -> Element(Msg) {
  let play_icon = case model.playing {
    True -> "❚❚"
    False -> "▶"
  }
  let play_label = case model.playing {
    True -> "Pause"
    False -> "Play"
  }
  html.div([attribute.class("transport")], [
    html.button(
      [
        attribute.class("transport-btn"),
        attribute.title("Previous track"),
        attribute.aria("label", "Previous track"),
        event.on_click(PreviousTrack),
      ],
      [element.text("◀◀")],
    ),
    html.button(
      [
        attribute.class("transport-btn play"),
        attribute.title(play_label),
        attribute.aria("label", play_label),
        event.on_click(TogglePlayback),
      ],
      [element.text(play_icon)],
    ),
    html.button(
      [
        attribute.class("transport-btn"),
        attribute.title("Next track"),
        attribute.aria("label", "Next track"),
        event.on_click(NextTrack),
      ],
      [element.text("▶▶")],
    ),
  ])
}

fn view_progress(model: Model) -> Element(Msg) {
  let percent = progress_percent(model.position, model.duration)
  html.div([attribute.class("mix-progress"), attribute.aria("hidden", "true")], [
    html.div(
      [
        attribute.class("mix-fill"),
        attribute.style("width", int.to_string(percent) <> "%"),
      ],
      [],
    ),
  ])
}

fn view_caption(model: Model) -> Element(Msg) {
  html.div([attribute.class("mix-caption")], [
    html.span([], [element.text("MIX #" <> mix_number(model.mixes))]),
    html.span([attribute.class("mix-time")], [
      element.text(
        format_time(model.position) <> " / " <> format_time(model.duration),
      ),
    ]),
    html.span([], [element.text("LIVE BLEND")]),
  ])
}

fn view_next_card(model: Model) -> Element(Msg) {
  html.aside([attribute.class("next-card")], [
    html.p([attribute.class("eyebrow")], [element.text("UP NEXT")]),
    case model.next {
      Some(next) ->
        html.div([], [
          html.h2([attribute.class("next-title")], [element.text(next.title)]),
          html.p([attribute.class("next-artist")], [element.text(next.artist)]),
        ])
      None ->
        html.p([attribute.class("next-artist")], [
          element.text("BUILDING THE NEXT MIX"),
        ])
    },
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
      element.text("LATEST CHIPTUNE · AUTO-MIXED · 24/7"),
    ]),
    html.div([attribute.class("console-controls")], [
      html.span([attribute.class("set-clock")], [element.text("LIVE FEED")]),
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
