# 8bit.cafe

8bit.cafe is a browser-based generative chiptune player. Each stage has its own
musical preset. The frontend generates valid 16-bar candidates, asks TypeSafe
AI's Jev model to choose the next continuation, and synthesizes the result with
the Web Audio API.

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
python3 -m http.server -d dist 8000
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
with an explicit spend limit, and TypeSafe must allow requests from the site
origin. Never commit a key or store it in localStorage.

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
