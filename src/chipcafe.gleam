import gleam/dynamic/decode
import gleam/list
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
  Model(screen: Screen, playing: Bool, status: StreamStatus)
}

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
    Room(
      id: "keygen-fm",
      name: "BYTE VAULT",
      station: "KEYGEN-FM",
      station_url: "https://keygen-fm.kodatek.app/",
      description: "KEYGEN, CRACKTRO & TRACKER CHIPTUNES AROUND THE CLOCK",
      sources: [
        #(
          "https://keygen-fm.kodatek.app/listen/keygen-fm/radio.mp3",
          "audio/mpeg",
        ),
      ],
      art: "keygen-vault.gif",
      accent: "accent-gb",
    ),
    Room(
      id: "sid-station",
      name: "SID TEMPLE",
      station: "THE SID STATION",
      station_url: "https://c64radio.com/",
      description: "COMMODORE 64 SID MUSIC & SCENE CLASSICS, LIVE 24/7",
      sources: [
        #(
          "https://solid24.streamupsolutions.com/proxy/icfablwz/stream",
          "audio/mpeg",
        ),
      ],
      art: "sid-studio.gif",
      accent: "accent-castle",
    ),
    Room(
      id: "rpgn",
      name: "RPG REALM",
      station: "RPGN RADIO",
      station_url: "https://www.rpgamers.net/radio/",
      description: "VIDEO GAME MUSIC FROM 8-BIT CLASSICS TO NEW RELEASES",
      sources: [
        #("https://listen.rpgamers.net/rpgn", "audio/mpeg"),
      ],
      art: "rpg-overworld.gif",
      accent: "accent-forest",
    ),
  ]
}

fn init(_) -> Model {
  Model(screen: Boot, playing: False, status: Tuning)
}

// ------------------------------------------------------------------ update

pub type Msg {
  InsertCoin
  SelectRoom(Room)
  LeaveRoom
  TogglePlay
  StreamPlaying
  StreamBuffering
  StreamError
}

fn update(model: Model, msg: Msg) -> Model {
  case msg {
    InsertCoin -> Model(..model, screen: Lobby)
    SelectRoom(room) ->
      Model(screen: InRoom(room), playing: True, status: Tuning)
    LeaveRoom -> Model(screen: Lobby, playing: False, status: Tuning)
    TogglePlay -> Model(..model, playing: !model.playing, status: Tuning)
    StreamPlaying -> Model(..model, status: Playing)
    StreamBuffering -> Model(..model, status: Tuning)
    StreamError -> Model(..model, status: StreamFailed)
  }
}

// -------------------------------------------------------------------- view

fn view(model: Model) -> Element(Msg) {
  case model.screen {
    Boot -> view_boot()
    Lobby -> view_lobby()
    InRoom(room) -> view_room(room, model.playing, model.status)
  }
}

fn view_boot() -> Element(Msg) {
  html.div([attribute.class("screen boot"), event.on_click(InsertCoin)], [
    html.div([attribute.class("boot-box")], [
      html.h1([attribute.class("logo glitch")], [element.text("8BIT.CAFE")]),
      html.p([attribute.class("tagline")], [
        element.text("CHIPTUNE RADIO FOR STUDY, WORK & BOSS FIGHTS"),
      ]),
      html.p([attribute.class("blink insert-coin")], [
        element.text("- INSERT COIN -"),
      ]),
      html.p([attribute.class("credits")], [
        element.text("9 STATIONS · 0 COINS REQUIRED · PRESS ANYWHERE"),
      ]),
    ]),
  ])
}

fn view_lobby() -> Element(Msg) {
  html.div([attribute.class("screen lobby")], [
    html.header([attribute.class("lobby-header")], [
      html.h1([attribute.class("logo")], [element.text("8BIT.CAFE")]),
      html.p([attribute.class("tagline")], [
        element.text("SELECT YOUR STAGE"),
      ]),
    ]),
    html.main([attribute.class("room-grid")], list.map(rooms(), view_room_card)),
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

fn view_room_card(room: Room) -> Element(Msg) {
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
    ],
  )
}

fn view_room(room: Room, playing: Bool, status: StreamStatus) -> Element(Msg) {
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
        html.button(
          [attribute.class("pixel-btn play-btn"), event.on_click(TogglePlay)],
          [
            element.text(case playing {
              True -> "❚❚ PAUSE"
              False -> "▶ PLAY"
            }),
          ],
        ),
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
