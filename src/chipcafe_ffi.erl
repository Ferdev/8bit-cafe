-module(chipcafe_ffi).
-export([
  load_favorite/0,
  save_favorite/1,
  clear_favorite/0,
  track_event/2,
  start_player/2,
  pause_player/0,
  stop_player/0,
  start_lobby_visuals/0
]).

load_favorite() -> <<>>.
save_favorite(_RoomId) -> nil.
clear_favorite() -> nil.
track_event(_Name, _RoomId) -> nil.
start_player(_RoomId, _OnStatus) -> nil.
pause_player() -> nil.
stop_player() -> nil.
start_lobby_visuals() -> nil.
