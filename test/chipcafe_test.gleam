import chipcafe
import gleam/option.{None, Some}
import gleeunit

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn saved_room_can_be_restored_test() {
  let assert Some(room) = chipcafe.find_room("cvgm")

  assert room.name == "NEON CITY"
  assert chipcafe.is_saved(Some(room), room)
}

pub fn unknown_saved_room_is_ignored_test() {
  assert chipcafe.find_room("retired-station") == None
}
