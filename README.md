# 8bit.cafe

[8bit.cafe](https://8bit.cafe) is a chiptune radio with an auto-DJ that runs in your browser. It selects tracks from Audius and Jamendo and mixes them automatically.

The player shows the current track and what is up next, with pixel art that reacts to the music. You can pause playback, go to the previous or next track, seek within a track, or mute the sound. Artist and track links take you to the source. Release dates and Creative Commons license links appear when available. If the browser blocks autoplay, click or tap the page to start the sound.

## How it works

The UI is written in Gleam with Lustre and compiled to JavaScript. JavaScript modules use the Web Audio API for two-deck playback and mixing. The auto-DJ ranks chiptune tracks by plays and favourites. Audio analysis helps it choose the next track and time transitions. The pixel art is drawn on a canvas.

nginx serves the static build and proxies the Audius API. GitHub Actions runs the checks and deploys a Docker image with Kamal when changes reach `trunk`.

## Run locally

Use Gleam 1.17.0 and Erlang/OTP 27, the versions used in CI. You also need Python 3 to serve the build.

From the repository root:

```sh
gleam deps download
tools/build.sh
python3 -m http.server -d dist 8000
```

Open <http://localhost:8000>. Run `tools/build.sh` again after changes.

This static server does not provide the `/api/audius/` proxy in `nginx.conf`, so the local player uses Jamendo only. Playback needs internet access to reach the music sources.

## Tests

```sh
gleam test
```

The JavaScript checks need Node.js:

```sh
node tools/test_feed.mjs
node tools/test_mix.mjs
node tools/test_tempo.mjs
```
