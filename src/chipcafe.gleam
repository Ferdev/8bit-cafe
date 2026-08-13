import gleam/dynamic/decode
import gleam/list
import gleam/option.{type Option, None, Some}
import lustre
import lustre/attribute
import lustre/element.{type Element}
import lustre/element/html
import lustre/event

// ------------------------------------------------------------------- model

pub type Room {
  Room(
    id: String,
    name: String,
    station: String,
    station_url: String,
    description: String,
    sources: List(#(String, String)),
    art: String,
    accent: String,
  )
}

pub type Screen {
  Boot
  Lobby
  InRoom(Room)
}

pub type StreamStatus {
  Tuning
  Playing
  StreamFailed
}

pub type Model {
  Model(
    screen: Screen,
    playing: Bool,
    status: StreamStatus,
    saved_room: Option(Room),
  )
}

@external(erlang, "chipcafe_ffi", "load_favorite")
@external(javascript, "./chipcafe_ffi.mjs", "loadFavorite")
fn load_favorite() -> String

@external(erlang, "chipcafe_ffi", "save_favorite")
@external(javascript, "./chipcafe_ffi.mjs", "saveFavorite")
fn save_favorite(room_id: String) -> Nil

@external(erlang, "chipcafe_ffi", "clear_favorite")
@external(javascript, "./chipcafe_ffi.mjs", "clearFavorite")
fn clear_favorite() -> Nil

@external(erlang, "chipcafe_ffi", "track_event")
@external(javascript, "./chipcafe_ffi.mjs", "trackEvent")
fn track_event(name: String, room_id: String) -> Nil

fn rooms() -> List(Room) {
  [
    Room(
      id: "cvgm",
      name: "NEON CITY",
      station: "CVGM",
      station_url: "https://www.cvgm.net/",
      description: "CHIPTUNE, DEMOSCENE & VIDEO GAME MUSIC",
      sources: [
        #("https://slacker.cvgm.net/cvgm192.ogg", "audio/ogg"),
        #("https://slacker.cvgm.net/cvgm192", "audio/mpeg"),
      ],
      art: "city.gif",
      accent: "accent-city",
    ),
    Room(
      id: "rainwave",
      name: "SUNSET BAY",
      station: "RAINWAVE CHIPTUNE",
      station_url: "https://rainwave.cc/chiptune/",
      description: "THE CHIPTUNE CHANNEL OF RAINWAVE VIDEO GAME RADIO",
      sources: [
        #("https://relay.rainwave.cc/chiptune.ogg", "audio/ogg"),
        #("https://relay.rainwave.cc/chiptune.mp3", "audio/mpeg"),
      ],
      art: "ocean.gif",
      accent: "accent-ocean",
    ),
    Room(
      id: "nectarine",
      name: "FIREFLY WOODS",
      station: "NECTARINE DEMOSCENE",
      station_url: "https://scenestream.net/",
      description: "TRACKER MODULES & SCENE MUSIC, ON AIR SINCE 2001",
      sources: [
        #("https://nectarine.inversi0n.org/necta192.mp3", "audio/mpeg"),
      ],
      art: "forest.gif",
      accent: "accent-forest",
    ),
    Room(
      id: "slay",
      name: "CASTLE PEAK",
      station: "SLAY RADIO",
      station_url: "https://www.slayradio.org/",
      description: "COMMODORE 64 & AMIGA REMIXES, LIVE FROM SWEDEN",
      sources: [
        #("/streams/slay", "audio/mpeg"),
        #("http://relay4.slayradio.org:8000/", "audio/mpeg"),
      ],
      art: "castle.gif",
      accent: "accent-castle",
    ),
    Room(
      id: "kaaos",
      name: "POCKET BOY",
      station: "KAAOSRADIO CHIPSTREAM",
      station_url: "https://www.kaaosradio.fi/",
      description: "FINNISH CHIPTUNES, BITPOP & TRACKER MUSIC",
      sources: [
        #("/streams/kaaos", "audio/mpeg"),
        #("http://stream.kaaosradio.fi:8000/chip", "audio/mpeg"),
      ],
      art: "gameboy.gif",
      accent: "accent-gb",
    ),
    Room(
      id: "kohina",
      name: "DEEP SPACE",
      station: "KOHINA RADIO",
      station_url: "https://kohina.com/",
      description: "OLD SCHOOL 8-BIT GAME MUSIC, 24/7 FROM FINLAND",
      sources: [
        #("/streams/kohina", "audio/ogg"),
        #("/streams/kohina-aac", "audio/aac"),
        #("http://kohina.duckdns.org:8000/stream.ogg", "audio/ogg"),
        #("http://kohina.duckdns.org:8000/stream.aac", "audio/aac"),
      ],
      art: "starfield.gif",
      accent: "accent-space",
    ),
  ]
}

pub fn find_room(room_id: String) -> Option(Room) {
  case list.find(rooms(), fn(room) { room.id == room_id }) {
    Ok(room) -> Some(room)
    Error(_) -> None
  }
}

fn init(_) -> Model {
  Model(
    screen: Boot,
    playing: False,
    status: Tuning,
    saved_room: find_room(load_favorite()),
  )
}

// ------------------------------------------------------------------ update

pub type Msg {
  InsertCoin
  ResumeRoom(Room)
  SelectRoom(Room)
  LeaveRoom
  TogglePlay
  ToggleSave(Room)
  StreamPlaying
  StreamBuffering
  StreamError
}

fn update(model: Model, msg: Msg) -> Model {
  case msg {
    InsertCoin -> Model(..model, screen: Lobby)
    ResumeRoom(room) -> {
      track_event("return_listener_resume", room.id)
      Model(..model, screen: InRoom(room), playing: True, status: Tuning)
    }
    SelectRoom(room) -> {
      track_event("station_started", room.id)
      Model(..model, screen: InRoom(room), playing: True, status: Tuning)
    }
    LeaveRoom -> Model(..model, screen: Lobby, playing: False, status: Tuning)
    TogglePlay -> Model(..model, playing: !model.playing, status: Tuning)
    ToggleSave(room) ->
      case is_saved(model.saved_room, room) {
        True -> {
          clear_favorite()
          track_event("station_unsaved", room.id)
          Model(..model, saved_room: None)
        }
        False -> {
          save_favorite(room.id)
          track_event("station_saved", room.id)
          Model(..model, saved_room: Some(room))
        }
      }
    StreamPlaying -> Model(..model, status: Playing)
    StreamBuffering -> Model(..model, status: Tuning)
    StreamError -> Model(..model, status: StreamFailed)
  }
}

// -------------------------------------------------------------------- view

fn view(model: Model) -> Element(Msg) {
  case model.screen {
    Boot -> view_boot(model.saved_room)
    Lobby -> view_lobby(model.saved_room)
    InRoom(room) ->
      view_room(room, model.playing, model.status, model.saved_room)
  }
}

fn view_boot(saved_room: Option(Room)) -> Element(Msg) {
  html.div([attribute.class("screen boot")], [
    html.div([attribute.class("boot-box")], [
      html.h1([attribute.class("logo glitch")], [element.text("8BIT.CAFE")]),
      html.p([attribute.class("tagline")], [
        element.text("CHIPTUNE RADIO FOR STUDY, WORK & BOSS FIGHTS"),
      ]),
      case saved_room {
        Some(room) ->
          html.div([attribute.class("return-player")], [
            html.p([attribute.class("return-label")], [
              element.text("SAVE DATA FOUND"),
            ]),
            html.button(
              [
                attribute.class("pixel-btn resume-btn"),
                event.on_click(ResumeRoom(room)),
              ],
              [element.text("▶ CONTINUE " <> room.name)],
            ),
            html.button(
              [attribute.class("text-btn"), event.on_click(InsertCoin)],
              [element.text("CHOOSE ANOTHER STAGE")],
            ),
          ])
        None ->
          html.button(
            [
              attribute.class("insert-coin blink text-btn"),
              event.on_click(InsertCoin),
            ],
            [element.text("- INSERT COIN -")],
          )
      },
      html.p([attribute.class("credits")], [
        element.text("6 STATIONS · 0 COINS REQUIRED"),
      ]),
    ]),
  ])
}

fn view_lobby(saved_room: Option(Room)) -> Element(Msg) {
  html.div([attribute.class("screen lobby")], [
    html.header([attribute.class("lobby-header")], [
      html.h1([attribute.class("logo")], [element.text("8BIT.CAFE")]),
      html.p([attribute.class("tagline")], [
        element.text("SELECT YOUR STAGE"),
      ]),
    ]),
    case saved_room {
      Some(room) ->
        html.aside([attribute.class("continue-strip")], [
          html.div([], [
            html.span([attribute.class("continue-eyebrow")], [
              element.text("YOUR SAVED STAGE"),
            ]),
            html.strong([], [element.text(room.name <> " · " <> room.station)]),
          ]),
          html.button(
            [attribute.class("pixel-btn"), event.on_click(ResumeRoom(room))],
            [element.text("▶ RESUME")],
          ),
        ])
      None ->
        html.p([attribute.class("save-hint")], [
          element.text("TIP: SAVE A STAGE TO RESUME IT ON YOUR NEXT VISIT"),
        ])
    },
    html.main(
      [attribute.class("room-grid")],
      list.map(rooms(), fn(room) { view_room_card(room, saved_room) }),
    ),
    html.footer([attribute.class("lobby-footer")], [
      html.p([attribute.class("footer-links")], [
        element.text("MADE BY FER · "),
        html.a(
          [
            attribute.href("https://twitter.com/ferdev"),
            attribute.target("_blank"),
            attribute.rel("noopener noreferrer"),
          ],
          [element.text("@FERDEV")],
        ),
        element.text(" · "),
        html.a(
          [
            attribute.href("https://ferdev.com"),
            attribute.target("_blank"),
            attribute.rel("noopener noreferrer"),
          ],
          [element.text("FERDEV.COM")],
        ),
      ]),
      html.p([], [
        element.text("ALL STATIONS STREAMED BY THEIR OWNERS"),
      ]),
    ]),
  ])
}

fn view_room_card(room: Room, saved_room: Option(Room)) -> Element(Msg) {
  html.button(
    [
      attribute.class("room-card " <> room.accent),
      event.on_click(SelectRoom(room)),
    ],
    [
      html.img([
        attribute.src(room.art),
        attribute.alt(room.name),
        attribute.class("room-art"),
      ]),
      html.div([attribute.class("room-info")], [
        html.span([attribute.class("room-name")], [element.text(room.name)]),
        html.span([attribute.class("room-station")], [
          element.text(room.station),
        ]),
      ]),
      html.span([attribute.class("room-press blink")], [
        element.text("▶ PRESS START"),
      ]),
      case is_saved(saved_room, room) {
        True ->
          html.span([attribute.class("saved-badge")], [element.text("★ SAVED")])
        False -> element.none()
      },
    ],
  )
}

pub fn is_saved(saved_room: Option(Room), room: Room) -> Bool {
  case saved_room {
    Some(saved) -> saved.id == room.id
    None -> False
  }
}

fn view_room(
  room: Room,
  playing: Bool,
  status: StreamStatus,
  saved_room: Option(Room),
) -> Element(Msg) {
  html.div([attribute.class("screen room " <> room.accent)], [
    html.img([
      attribute.src(room.art),
      attribute.alt(room.name),
      attribute.class("room-bg"),
    ]),
    html.div([attribute.class("room-overlay")], [
      html.header([attribute.class("room-header")], [
        html.button(
          [attribute.class("pixel-btn back-btn"), event.on_click(LeaveRoom)],
          [element.text("◀ LOBBY")],
        ),
        html.div(
          [
            attribute.class(case playing {
              True -> "live-badge on"
              False -> "live-badge"
            }),
          ],
          [element.text("● LIVE")],
        ),
      ]),
      html.div([attribute.class("room-panel")], [
        html.h2([attribute.class("room-title")], [element.text(room.name)]),
        html.p([attribute.class("room-station-big")], [
          html.a(
            [
              attribute.href(room.station_url),
              attribute.target("_blank"),
              attribute.rel("noopener noreferrer"),
              attribute.class("station-link"),
            ],
            [element.text(room.station)],
          ),
        ]),
        html.p([attribute.class("room-desc")], [
          element.text(room.description),
        ]),
        view_status(playing, status),
        html.div([attribute.class("player-actions")], [
          html.button(
            [attribute.class("pixel-btn play-btn"), event.on_click(TogglePlay)],
            [
              element.text(case playing {
                True -> "❚❚ PAUSE"
                False -> "▶ PLAY"
              }),
            ],
          ),
          html.button(
            [
              attribute.class(case is_saved(saved_room, room) {
                True -> "pixel-btn save-btn saved"
                False -> "pixel-btn save-btn"
              }),
              attribute.aria_pressed(case is_saved(saved_room, room) {
                True -> "true"
                False -> "false"
              }),
              event.on_click(ToggleSave(room)),
            ],
            [
              element.text(case is_saved(saved_room, room) {
                True -> "★ STAGE SAVED"
                False -> "☆ SAVE STAGE"
              }),
            ],
          ),
        ]),
        html.p([attribute.class("save-note")], [
          element.text("SAVED ONLY IN THIS BROWSER · NO SIGN-UP"),
        ]),
      ]),
    ]),
    case playing {
      True -> view_player(room)
      False -> element.none()
    },
  ])
}

fn view_status(playing: Bool, status: StreamStatus) -> Element(Msg) {
  case playing, status {
    False, _ ->
      html.p([attribute.class("stream-status")], [element.text("PAUSED")])
    True, Tuning ->
      html.p([attribute.class("stream-status blink")], [
        element.text("TUNING IN..."),
      ])
    True, Playing ->
      html.p([attribute.class("stream-status ok")], [
        element.text("♪ NOW PLAYING ♪"),
      ])
    True, StreamFailed ->
      html.p([attribute.class("stream-status error")], [
        element.text("STREAM ERROR - TRY ANOTHER STAGE"),
      ])
  }
}

fn view_player(room: Room) -> Element(Msg) {
  let last = list.length(room.sources) - 1
  let sources =
    list.index_map(room.sources, fn(source, i) {
      let #(url, mime) = source
      case i == last {
        // Only the last <source> firing "error" means every source failed.
        True ->
          html.source([
            attribute.src(url),
            attribute.type_(mime),
            event.on("error", decode.success(StreamError)),
          ])
        False -> html.source([attribute.src(url), attribute.type_(mime)])
      }
    })
  html.audio(
    [
      attribute.autoplay(True),
      attribute.class("hidden-player"),
      event.on("playing", decode.success(StreamPlaying)),
      event.on("waiting", decode.success(StreamBuffering)),
      event.on("stalled", decode.success(StreamBuffering)),
    ],
    sources,
  )
}

// -------------------------------------------------------------------- main

pub fn main() {
  let app = lustre.simple(init, update, view)
  let assert Ok(_) = lustre.start(app, "#app", Nil)
  Nil
}
