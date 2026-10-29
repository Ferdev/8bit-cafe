-module(chipcafe_ffi).
-export([start_dj/4, toggle_playback/0, next_track/0, previous_track/0, set_muted/1, seek_to/1]).

%% Used by the Erlang target (tests and any headless run). The real streaming
%% DJ lives in chipcafe_ffi.mjs and only runs in the browser.
start_dj(_OnTrack, _OnProgress, _OnState, _OnMix) -> nil.
toggle_playback() -> nil.
next_track() -> nil.
previous_track() -> nil.
set_muted(_Muted) -> nil.
seek_to(_Seconds) -> nil.
