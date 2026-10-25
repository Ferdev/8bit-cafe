-module(chipcafe_ffi).
-export([
    start_dj/7,
    play_track/5,
    set_muted/1,
    load_favorite/0,
    save_favorite/1,
    clear_favorite/0,
    track_event/2
]).

%% Used by the Erlang target (tests and any headless run). The real audio DJ
%% lives in chipcafe_ffi.mjs and only runs in the browser.
start_dj(_TrackId, _Bpm, _Seed, _Accent, _AccentAlt, _OnFinish, _OnStatus) -> nil.
play_track(_TrackId, _Bpm, _Seed, _Accent, _AccentAlt) -> nil.
set_muted(_Muted) -> nil.

load_favorite() -> <<>>.
save_favorite(_RoomId) -> nil.
clear_favorite() -> nil.
track_event(_Name, _RoomId) -> nil.
