import gleam/list
import gleam/option.{type Option, None, Some}
import lustre
import lustre/attribute
import lustre/effect.{type Effect}
import lustre/element.{type Element}
import lustre/element/html
import lustre/event

pub type Room {
  Room(
    id: String,
    name: String,
    station: String,
    description: String,
    preset: String,
    accent: String,
  )
}

pub type Screen {
  Boot
  Lobby
  InRoom(Room)
}

pub type PlayerStatus {
  Idle
  StartingAudio
  Composing
  Buffering
  PlayingJev
  PlayingLocal
  Recovering
  Paused
  PlayerFailed
}

pub type Model {
  Model(
    screen: Screen,
    playing: Bool,
    status: PlayerStatus,
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

@external(erlang, "chipcafe_ffi", "start_player")
@external(javascript, "./chipcafe_ffi.mjs", "startPlayer")
fn start_player(room_id: String, on_status: fn(String) -> Nil) -> Nil

@external(erlang, "chipcafe_ffi", "pause_player")
@external(javascript, "./chipcafe_ffi.mjs", "pausePlayer")
fn pause_player() -> Nil

@external(erlang, "chipcafe_ffi", "stop_player")
@external(javascript, "./chipcafe_ffi.mjs", "stopPlayer")
fn stop_player() -> Nil

@external(erlang, "chipcafe_ffi", "start_lobby_visuals")
@external(javascript, "./chipcafe_ffi.mjs", "startLobbyVisuals")
fn start_lobby_visuals() -> Nil

fn rooms() -> List(Room) {
  [
    Room(
      id: "cvgm",
      name: "NEON CITY",
      station: "JEV NEON DRIVE",
      description: "BRIGHT ARPEGGIOS, PULSE LEADS & MIDNIGHT BASSLINES",
      preset: "neon-drive",
      accent: "accent-city",
    ),
    Room(
      id: "rainwave",
      name: "SUNSET BAY",
      station: "JEV COASTAL WAVE",
      description: "WARM CHIP CHORDS, EASY DRUMS & OCEAN-SIDE MELODIES",
      preset: "coastal-wave",
      accent: "accent-ocean",
    ),
    Room(
      id: "nectarine",
      name: "FIREFLY WOODS",
      station: "JEV FOREST QUEST",
      description: "PLAYFUL QUEST THEMES, WOODLAND ARPS & SOFT PERCUSSION",
      preset: "forest-quest",
      accent: "accent-forest",
    ),
    Room(
      id: "slay",
      name: "CASTLE PEAK",
      station: "JEV BOSS MODE",
      description: "DRIVING BASS, HEROIC LEADS & BOSS-BATTLE ENERGY",
      preset: "boss-mode",
      accent: "accent-castle",
    ),
    Room(
      id: "kaaos",
      name: "POCKET BOY",
      station: "JEV POCKET PULSE",
      description: "TINY SPEAKERS, BIG HOOKS & HANDHELD ADVENTURES",
      preset: "pocket-pulse",
      accent: "accent-gb",
    ),
    Room(
      id: "kohina",
      name: "DEEP SPACE",
      station: "JEV ORBITAL CHIP",
      description: "SLOW ARPEGGIOS, DISTANT SIGNALS & ZERO-GROOVE BASS",
      preset: "orbital-chip",
      accent: "accent-space",
    ),
    Room(
      id: "keygen-fm",
      name: "BYTE VAULT",
      station: "JEV CRACKTRO LAB",
      description: "FAST TRACKER RIFFS, GLITCHY FILLS & CODE-SCREEN SWAGGER",
      preset: "cracktro-lab",
      accent: "accent-gb",
    ),
    Room(
      id: "sid-station",
      name: "SID TEMPLE",
      station: "JEV SID RITUAL",
      description: "WIDE PULSE LEADS, FILTERED BASS & CEREMONIAL GROOVES",
      preset: "sid-ritual",
      accent: "accent-castle",
    ),
    Room(
      id: "rpgn",
      name: "RPG REALM",
      station: "JEV ADVENTURE LOOP",
      description: "OVERWORLD THEMES, VICTORY HOOKS & CAMPFIRE CHORDS",
      preset: "adventure-loop",
      accent: "accent-forest",
    ),
    Room(
      id: "radiosega",
      name: "SPEED CIRCUIT",
      station: "JEV TURBO DRIVE",
      description: "HIGH-BPM LEADS, RACING BASS & CHECKERED-FLAG FILLS",
      preset: "turbo-drive",
      accent: "accent-city",
    ),
    Room(
      id: "gtt-radio",
      name: "QUIZ ARENA",
      station: "JEV PARTY MODE",
      description: "BOUNCY HOOKS, SURPRISE BREAKS & CO-OP ENERGY",
      preset: "party-mode",
      accent: "accent-ocean",
    ),
    Room(
      id: "ericade",
      name: "DEMO HALL",
      station: "JEV TRACKER STAGE",
      description: "DEMO-SCENE ARPS, SYNCOPATED DRUMS & MOD-STYLE MOTION",
      preset: "tracker-stage",
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

fn init(_) -> #(Model, Effect(Msg)) {
  #(
    Model(
      screen: Boot,
      playing: False,
      status: Idle,
      saved_room: find_room(load_favorite()),
    ),
    effect.none(),
  )
}

pub type Msg {
  InsertCoin
  ResumeRoom(Room)
  SelectRoom(Room)
  LeaveRoom
  TogglePlay(Room)
  ToggleSave(Room)
  PlayerStateChanged(String)
}

fn start_player_effect(room_id: String) -> Effect(Msg) {
  effect.from(fn(dispatch) {
    start_player(room_id, fn(status) { dispatch(PlayerStateChanged(status)) })
  })
}

fn pause_player_effect() -> Effect(Msg) {
  effect.from(fn(_) { pause_player() })
}

fn stop_player_effect() -> Effect(Msg) {
  effect.from(fn(_) { stop_player() })
}

fn start_lobby_effect() -> Effect(Msg) {
  effect.from(fn(_) { start_lobby_visuals() })
}

fn no_effect(model: Model) -> #(Model, Effect(Msg)) {
  #(model, effect.none())
}

fn start_room(
  model: Model,
  room: Room,
  event_name: String,
) -> #(Model, Effect(Msg)) {
  track_event(event_name, room.id)
  #(
    Model(
      screen: InRoom(room),
      playing: True,
      status: StartingAudio,
      saved_room: model.saved_room,
    ),
    start_player_effect(room.id),
  )
}

fn status_from_string(status: String) -> PlayerStatus {
  case status {
    "starting-audio" -> StartingAudio
    "composing" -> Composing
    "buffering" -> Buffering
    "playing-jev" -> PlayingJev
    "playing-local" -> PlayingLocal
    "recovering" -> Recovering
    "paused" -> Paused
    "failed" -> PlayerFailed
    _ -> PlayerFailed
  }
}

fn update(model: Model, msg: Msg) -> #(Model, Effect(Msg)) {
  case msg {
    InsertCoin -> #(Model(..model, screen: Lobby), start_lobby_effect())
    ResumeRoom(room) -> start_room(model, room, "return_listener_resume")
    SelectRoom(room) -> start_room(model, room, "station_started")
    LeaveRoom -> #(
      Model(..model, screen: Lobby, playing: False, status: Idle),
      effect.batch([stop_player_effect(), start_lobby_effect()]),
    )
    TogglePlay(room) ->
      case model.playing {
        True -> #(
          Model(..model, playing: False, status: Paused),
          pause_player_effect(),
        )
        False -> #(
          Model(..model, playing: True, status: StartingAudio),
          start_player_effect(room.id),
        )
      }
    ToggleSave(room) ->
      case is_saved(model.saved_room, room) {
        True -> {
          clear_favorite()
          track_event("station_unsaved", room.id)
          no_effect(Model(..model, saved_room: None))
        }
        False -> {
          save_favorite(room.id)
          track_event("station_saved", room.id)
          no_effect(Model(..model, saved_room: Some(room)))
        }
      }
    PlayerStateChanged(status) -> {
      let decoded = status_from_string(status)
      let is_playing = case decoded {
        Paused | PlayerFailed -> False
        _ -> model.playing
      }
      no_effect(Model(..model, playing: is_playing, status: decoded))
    }
  }
}

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
        element.text("GENERATIVE CHIPTUNE FOR STUDY, WORK & BOSS FIGHTS"),
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
        element.text("12 GENERATIVE STAGES · 0 COINS REQUIRED"),
      ]),
    ]),
  ])
}

fn view_lobby(saved_room: Option(Room)) -> Element(Msg) {
  html.div([attribute.class("screen lobby")], [
    html.header([attribute.class("lobby-header")], [
      html.h1([attribute.class("logo")], [element.text("8BIT.CAFE")]),
      html.p([attribute.class("tagline")], [
        element.text("SELECT YOUR GENERATIVE STAGE"),
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
      html.p([], [element.text("ORIGINAL GENERATIVE MUSIC · GUIDED BY JEV")]),
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
      html.canvas([
        attribute.class("room-art"),
        attribute.data("room-id", room.id),
        attribute.aria_hidden(True),
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

fn is_live(status: PlayerStatus) -> Bool {
  case status {
    PlayingJev | PlayingLocal -> True
    _ -> False
  }
}

fn view_room(
  room: Room,
  playing: Bool,
  status: PlayerStatus,
  saved_room: Option(Room),
) -> Element(Msg) {
  html.div([attribute.class("screen room " <> room.accent)], [
    html.canvas([
      attribute.class("room-visual"),
      attribute.aria_hidden(True),
    ]),
    html.div([attribute.class("room-overlay")], [
      html.header([attribute.class("room-header")], [
        html.button(
          [attribute.class("pixel-btn back-btn"), event.on_click(LeaveRoom)],
          [element.text("◀ LOBBY")],
        ),
        html.div(
          [
            attribute.class(case is_live(status) {
              True -> "live-badge on"
              False -> "live-badge"
            }),
          ],
          [
            element.text(case is_live(status) {
              True -> "● GENERATING"
              False -> "○ STANDBY"
            }),
          ],
        ),
      ]),
      html.div([attribute.class("room-panel")], [
        html.h2([attribute.class("room-title")], [element.text(room.name)]),
        html.p([attribute.class("room-station-big")], [
          html.span([attribute.class("generator-label")], [
            element.text(room.station),
          ]),
        ]),
        html.p([attribute.class("room-desc")], [
          element.text(room.description),
        ]),
        view_status(playing, status),
        html.div([attribute.class("player-actions")], [
          html.button(
            [
              attribute.class("pixel-btn play-btn"),
              attribute.aria_pressed(case playing {
                True -> "true"
                False -> "false"
              }),
              event.on_click(TogglePlay(room)),
            ],
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
  ])
}

fn is_buffering(status: PlayerStatus) -> Bool {
  case status {
    StartingAudio | Composing | Buffering | Recovering -> True
    _ -> False
  }
}

fn status_text(playing: Bool, status: PlayerStatus) -> String {
  case playing, status {
    False, PlayerFailed -> "AUDIO UNAVAILABLE · PRESS PLAY TO RETRY"
    False, _ -> "PAUSED"
    True, StartingAudio -> "STARTING AUDIO..."
    True, Composing -> "JEV IS COMPOSING..."
    True, Buffering -> "BUFFERING THE NEXT BARS..."
    True, Recovering -> "KEEPING THE BEAT..."
    True, PlayingJev -> "♪ JEV GENERATING LIVE ♪"
    True, PlayingLocal -> "♪ GENERATIVE FALLBACK ♪"
    True, Paused -> "PAUSED"
    True, PlayerFailed -> "AUDIO UNAVAILABLE · PRESS PLAY TO RETRY"
    True, Idle -> "READY"
  }
}

fn view_status(playing: Bool, status: PlayerStatus) -> Element(Msg) {
  let buffering = is_buffering(status)
  let status_class = case status {
    PlayingJev | PlayingLocal -> "stream-status ok"
    PlayerFailed -> "stream-status error"
    _ -> "stream-status"
  }
  html.div(
    [
      attribute.class(status_class),
      attribute.role("status"),
      attribute.aria_live("polite"),
      attribute.aria_busy(buffering),
    ],
    [
      case buffering {
        True ->
          html.span(
            [
              attribute.class("pixel-spinner"),
              attribute.aria_hidden(True),
            ],
            [],
          )
        False -> element.none()
      },
      html.span([], [element.text(status_text(playing, status))]),
    ],
  )
}

pub fn main() {
  let app = lustre.application(init, update, view)
  let assert Ok(_) = lustre.start(app, "#app", Nil)
  Nil
}
