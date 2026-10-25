import chipcafe
import gleam/list
import gleam/option.{None, Some}
import gleeunit

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn catalog_opens_with_newest_release_test() {
  let queue = chipcafe.catalog()
  let first = chipcafe.now_playing(queue)

  assert first.id == "neon-cartridge"
  assert first.title == "NEON CARTRIDGE"
  assert first.artist == "KILOBYTE KID"
  assert first.released == "2026-10-21"
}

pub fn catalog_is_ordered_newest_first_test() {
  let dates = list.map(chipcafe.catalog(), fn(track) { track.released })

  assert dates
    == [
      "2026-10-21",
      "2026-10-14",
      "2026-10-03",
      "2026-09-26",
      "2026-09-18",
      "2026-09-09",
      "2026-08-30",
      "2026-08-22",
    ]
}

pub fn catalog_has_unique_releases_test() {
  let ids = list.map(chipcafe.catalog(), fn(track) { track.id })
  let unique_ids = list.unique(ids)

  assert list.length(ids) == list.length(unique_ids)
  assert list.length(ids) >= 6
}

pub fn advance_moves_to_the_next_newest_release_test() {
  let queue = chipcafe.catalog()
  let assert Some(next) = chipcafe.up_next(queue)
  let advanced = chipcafe.advance(queue)

  assert next.id == "sunset-arcade"
  assert chipcafe.now_playing(advanced).id == next.id
  assert list.length(advanced) == list.length(queue)
}

pub fn advancing_a_whole_set_returns_to_the_first_release_test() {
  let queue = chipcafe.catalog()
  let laps = list.repeat(0, list.length(queue))
  let wrapped =
    list.fold(laps, queue, fn(current, _) { chipcafe.advance(current) })

  assert chipcafe.now_playing(wrapped).id == "neon-cartridge"
}

pub fn up_next_is_empty_for_a_single_track_test() {
  let only = [chipcafe.now_playing(chipcafe.catalog())]

  assert chipcafe.up_next(only) == None
}

pub fn empty_queue_stays_empty_test() {
  assert chipcafe.advance([]) == []
}

pub fn every_track_has_a_playable_length_test() {
  list.each(chipcafe.catalog(), fn(track) {
    assert chipcafe.track_seconds(track) > 0
  })
}

pub fn track_length_matches_bpm_test() {
  let track = chipcafe.now_playing(chipcafe.catalog())

  // 16 bars of 16 steps at 152 BPM is 3840 / 152 = 25 whole seconds.
  assert chipcafe.track_seconds(track) == 25
}

pub fn mix_counter_is_zero_padded_test() {
  assert chipcafe.mix_number(1) == "001"
  assert chipcafe.mix_number(9) == "009"
  assert chipcafe.mix_number(42) == "042"
  assert chipcafe.mix_number(999) == "999"
}

pub fn on_air_label_comes_from_stream_status_test() {
  assert chipcafe.status_label(chipcafe.Tuning) == "TUNING"
  assert chipcafe.status_label(chipcafe.Live) == "ON AIR"
  assert chipcafe.status_label(chipcafe.Blocked) == "SOUND LOCKED"
  assert chipcafe.status_label(chipcafe.Failed) == "SIGNAL LOST"
}
