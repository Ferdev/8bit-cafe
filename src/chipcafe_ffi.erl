-module(chipcafe_ffi).
-export([load_favorite/0, save_favorite/1, clear_favorite/0, track_event/2]).

load_favorite() -> <<>>.
save_favorite(_RoomId) -> nil.
clear_favorite() -> nil.
track_event(_Name, _RoomId) -> nil.
