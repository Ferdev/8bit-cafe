import gleam/int
import gleam/list
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

pub const station_tagline = "ONE CHANNEL · ONE AUTO-DJ · REAL OPEN CHIPTUNE"

// ------------------------------------------------------------------ model

/// A real, openly licensed chiptune release from an artist in the cafe's
/// roster. Every track keeps the credits needed to stream it legally:
/// the artist's site, the release source, and the license.
pub type Track {
  Track(
    id: String,
    artist: String,
    title: String,
    album: String,
    released: String,
    seconds: Int,
    audio_url: String,
    artist_url: String,
    license: String,
    license_url: String,
    source_url: String,
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
  Model(
    tracks: List(Track),
    active_index: Int,
    status: StreamStatus,
    mixes: Int,
    muted: Bool,
  )
}

// ---------------------------------------------------------------- catalog

/// Real releases from artists who publish their chiptune openly. Ordered
/// newest first, so the auto-DJ always opens with the freshest release in the
/// roster. Audio is streamed from the Internet Archive's open music collection.
pub fn catalog() -> List(Track) {
  [
    Track(
      id: "komiku-boss-fight-circuit",
      artist: "Komiku",
      title: "Boss Fight Circuit",
      album: "Incredible Kart Game",
      released: "2021-01-01",
      seconds: 208,
      audio_url: "https://archive.org/download/komiku-incredible-kart-game/Boss%20Fight%20Circuit.mp3",
      artist_url: "https://loyaltyfreakmusic.com/",
      license: "CC0 1.0",
      license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
      source_url: "https://archive.org/details/komiku-incredible-kart-game",
      accent: "#3affa0",
      accent_alt: "#3ae8ff",
    ),
    Track(
      id: "ozzed-top-city",
      artist: "Ozzed",
      title: "Top City",
      album: "Friendship Adventure",
      released: "2018-01-15",
      seconds: 100,
      audio_url: "https://archive.org/download/jamendo-174068/06-1513270-Ozzed-Top%20City.mp3",
      artist_url: "https://ozzed.net/",
      license: "CC BY-SA 3.0",
      license_url: "https://creativecommons.org/licenses/by-sa/3.0/",
      source_url: "https://archive.org/details/jamendo-174068",
      accent: "#ffb03a",
      accent_alt: "#ff3ad4",
    ),
    Track(
      id: "rolemusic-the-white-kitty",
      artist: "Rolemusic",
      title: "The White Kitty",
      album: "The Black Dot",
      released: "2017-10-14",
      seconds: 198,
      audio_url: "https://archive.org/download/TheBlackDot/01_rolemusic_-_the_white_kitty.mp3",
      artist_url: "http://rolemusic.sawsquarenoise.com/",
      license: "CC BY 4.0",
      license_url: "https://creativecommons.org/licenses/by/4.0/",
      source_url: "https://archive.org/details/TheBlackDot",
      accent: "#b46bff",
      accent_alt: "#3ae8ff",
    ),
    Track(
      id: "juhani-grasslands",
      artist: "Juhani Junkala",
      title: "Grasslands",
      album: "JRPG Pack 1: Exploration",
      released: "2017-05-12",
      seconds: 72,
      audio_url: "https://archive.org/download/JuhaniJunkala-JRPGpack1-Exploration/Exploration1%20-%20Grasslands.mp3",
      artist_url: "https://juhanijunkala.com/",
      license: "CC0 1.0",
      license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
      source_url: "https://archive.org/details/JuhaniJunkala-JRPGpack1-Exploration",
      accent: "#9bbc0f",
      accent_alt: "#3affa0",
    ),
    Track(
      id: "visager-battle",
      artist: "Visager",
      title: "Battle!",
      album: "Songs From An Unmade World 2",
      released: "2016-04-26",
      seconds: 125,
      audio_url: "https://archive.org/download/Songs_From_An_Unmade_World_2-20459/Visager_-_05_-_Battle.mp3",
      artist_url: "https://visager.net/",
      license: "CC BY 4.0",
      license_url: "https://creativecommons.org/licenses/by/4.0/",
      source_url: "https://archive.org/details/Songs_From_An_Unmade_World_2-20459",
      accent: "#ff3ad4",
      accent_alt: "#ffb03a",
    ),
    Track(
      id: "roccow-play-nicely",
      artist: "RoccoW",
      title: "Play Nicely",
      album: "Weeklybeats 2014",
      released: "2014-01-01",
      seconds: 120,
      audio_url: "https://archive.org/download/Weeklybeats_2014-15889/RoccoW_-_03_-_Weeklybeats_2014_3_-_Play_Nicely.mp3",
      artist_url: "https://roccow.bandcamp.com/",
      license: "CC BY-SA 4.0",
      license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
      source_url: "https://archive.org/details/Weeklybeats_2014-15889",
      accent: "#3ae8ff",
      accent_alt: "#b46bff",
    ),
    Track(
      id: "eric-skiff-chibi-ninja",
      artist: "Eric Skiff",
      title: "Chibi Ninja",
      album: "Resistor Anthems",
      released: "2005-10-28",
      seconds: 123,
      audio_url: "https://archive.org/download/Resistor_Anthems-9016/Eric_Skiff_-_03_-_Chibi_Ninja.mp3",
      artist_url: "https://ericskiff.com/music/",
      license: "CC BY 3.0",
      license_url: "https://creativecommons.org/licenses/by/3.0/",
      source_url: "https://archive.org/details/Resistor_Anthems-9016",
      accent: "#3ae8ff",
      accent_alt: "#ff3ad4",
    ),
  ]
}

/// The release currently on the decks. `active_index` is driven by the DJ
/// engine and always wraps around the roster.
pub fn track_at(tracks: List(Track), index: Int) -> Track {
  let assert [_, ..] = tracks
  let length = list.length(tracks)
  let offset = { index % length + length } % length
  let assert [track, ..] = list.drop(tracks, offset)
  track
}

pub fn next_index(length: Int, index: Int) -> Int {
  case length {
    0 -> 0
    _ -> { index + 1 } % length
  }
}

/// The release the DJ has already lined up next.
pub fn up_next(tracks: List(Track), index: Int) -> Track {
  track_at(tracks, next_index(list.length(tracks), index))
}

pub fn track_seconds(track: Track) -> Int {
  track.seconds
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

/// The DJ engine receives the whole catalog as JSON so it can stream the real
/// audio files and crossfade between them without a round-trip to the UI.
pub fn playlist_json() -> String {
  "[" <> string.join(list.map(catalog(), track_json), ",") <> "]"
}

fn track_json(track: Track) -> String {
  "{\"id\":\""
  <> json_escape(track.id)
  <> "\",\"artist\":\""
  <> json_escape(track.artist)
  <> "\",\"title\":\""
  <> json_escape(track.title)
  <> "\",\"album\":\""
  <> json_escape(track.album)
  <> "\",\"released\":\""
  <> json_escape(track.released)
  <> "\",\"seconds\":"
  <> int.to_string(track.seconds)
  <> ",\"audio_url\":\""
  <> json_escape(track.audio_url)
  <> "\",\"artist_url\":\""
  <> json_escape(track.artist_url)
  <> "\",\"license\":\""
  <> json_escape(track.license)
  <> "\",\"license_url\":\""
  <> json_escape(track.license_url)
  <> "\",\"source_url\":\""
  <> json_escape(track.source_url)
  <> "\",\"accent\":\""
  <> json_escape(track.accent)
  <> "\",\"accent_alt\":\""
  <> json_escape(track.accent_alt)
  <> "\"}"
}

fn json_escape(value: String) -> String {
  value
  |> string.replace("\\", "\\\\")
  |> string.replace("\"", "\\\"")
}

// ------------------------------------------------------------------- ffi

@external(erlang, "chipcafe_ffi", "start_dj")
@external(javascript, "./chipcafe_ffi.mjs", "startDj")
fn start_dj(
  playlist_json: String,
  on_track: fn(Int) -> Nil,
  on_status: fn(String) -> Nil,
) -> Nil

@external(erlang, "chipcafe_ffi", "set_muted")
@external(javascript, "./chipcafe_ffi.mjs", "setMuted")
fn set_muted(muted: Bool) -> Nil

// ------------------------------------------------------------------ update

pub type Msg {
  TrackChanged(Int)
  StatusChanged(String)
  ToggleMute
}

fn init(_) -> #(Model, Effect(Msg)) {
  let tracks = catalog()
  let model =
    Model(tracks:, active_index: 0, status: Tuning, mixes: 1, muted: False)
  let effect =
    effect.from(fn(dispatch) {
      start_dj(
        playlist_json(),
        fn(index) { dispatch(TrackChanged(index)) },
        fn(status) { dispatch(StatusChanged(status)) },
      )
    })
  #(model, effect)
}

fn update(model: Model, msg: Msg) -> #(Model, Effect(Msg)) {
  case msg {
    TrackChanged(index) -> #(
      Model(..model, active_index: index, mixes: model.mixes + 1),
      effect.none(),
    )
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

// -------------------------------------------------------------------- view

fn view(model: Model) -> Element(Msg) {
  let track = track_at(model.tracks, model.active_index)
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
        element.text("AUTO-DJ · REAL OPEN RELEASES"),
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
        html.a(
          [
            attribute.href(track.artist_url),
            attribute.target("_blank"),
            attribute.rel("noopener noreferrer"),
            attribute.class("artist-link"),
          ],
          [element.text(track.artist)],
        ),
        html.span([attribute.class("dot")], [element.text("·")]),
        element.text(track.album),
      ]),
      html.div([attribute.class("track-meta")], [
        html.span([], [element.text("RELEASED " <> track.released)]),
        html.a(
          [
            attribute.href(track.license_url),
            attribute.target("_blank"),
            attribute.rel("noopener noreferrer"),
            attribute.class("meta-link"),
            attribute.title("License for this track"),
          ],
          [element.text(track.license)],
        ),
        html.a(
          [
            attribute.href(track.artist_url),
            attribute.target("_blank"),
            attribute.rel("noopener noreferrer"),
            attribute.class("meta-link"),
            attribute.title("Artist website"),
          ],
          [element.text("ARTIST SITE ↗")],
        ),
        html.a(
          [
            attribute.href(track.source_url),
            attribute.target("_blank"),
            attribute.rel("noopener noreferrer"),
            attribute.class("meta-link"),
            attribute.title("Original open release"),
          ],
          [element.text("OPEN RELEASE ↗")],
        ),
      ]),
      view_progress(track),
      html.div([attribute.class("mix-caption")], [
        html.span([], [element.text("MIX #" <> mix_number(model.mixes))]),
        html.span([], [element.text("LIVE BLEND · ARTISTS CREDITED")]),
      ]),
    ]),
    view_next_card(model),
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

fn view_next_card(model: Model) -> Element(Msg) {
  let next = up_next(model.tracks, model.active_index)
  html.aside([attribute.class("next-card")], [
    html.p([attribute.class("eyebrow")], [element.text("UP NEXT")]),
    html.h2([attribute.class("next-title")], [element.text(next.title)]),
    html.p([attribute.class("next-artist")], [
      html.a(
        [
          attribute.href(next.artist_url),
          attribute.target("_blank"),
          attribute.rel("noopener noreferrer"),
          attribute.class("artist-link"),
        ],
        [element.text(next.artist)],
      ),
    ]),
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
        "STREAMING REAL OPEN CHIPTUNE VIA INTERNET ARCHIVE · ARTISTS CREDITED",
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
