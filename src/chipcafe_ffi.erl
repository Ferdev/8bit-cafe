-module(chipcafe_ffi).
-export([start_dj/3, set_muted/1]).

%% Used by the Erlang target (tests and any headless run). The real streaming
%% DJ lives in chipcafe_ffi.mjs and only runs in the browser.
start_dj(_PlaylistJson, _OnTrack, _OnStatus) -> nil.
set_muted(_Muted) -> nil.
