import chipcafe
import gleam/list
import gleam/string
import gleeunit

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn catalog_opens_with_newest_release_test() {
  let tracks = chipcafe.catalog()
  let first = chipcafe.track_at(tracks, 0)

  assert first.id == "komiku-boss-fight-circuit"
  assert first.artist == "Komiku"
  assert first.title == "Boss Fight Circuit"
  assert first.released == "2021-01-01"
}

pub fn catalog_is_ordered_newest_first_test() {
  let dates = list.map(chipcafe.catalog(), fn(track) { track.released })

  assert dates
    == [
      "2021-01-01",
      "2018-01-15",
      "2017-10-14",
      "2017-05-12",
      "2016-04-26",
      "2014-01-01",
      "2005-10-28",
    ]
}

pub fn catalog_has_unique_real_releases_test() {
  let ids = list.map(chipcafe.catalog(), fn(track) { track.id })
  let unique_ids = list.unique(ids)

  assert list.length(ids) == list.length(unique_ids)
  assert list.length(ids) >= 7
}

pub fn every_track_streams_a_real_open_release_test() {
  list.each(chipcafe.catalog(), fn(track) {
    assert string.starts_with(track.audio_url, "https://archive.org/download/")
    assert string.contains(track.audio_url, ".mp3")
    assert string.starts_with(track.artist_url, "http")
    assert string.starts_with(track.license_url, "https://creativecommons.org/")
    assert string.starts_with(track.source_url, "https://archive.org/details/")
    assert track.seconds > 30
    assert track.artist != ""
    assert track.album != ""
  })
}

pub fn licenses_allow_streaming_with_credit_test() {
  let allowed = [
    "CC0 1.0",
    "CC BY 3.0",
    "CC BY 4.0",
    "CC BY-SA 3.0",
    "CC BY-SA 4.0",
  ]

  list.each(chipcafe.catalog(), fn(track) {
    assert list.contains(allowed, track.license)
  })
}

pub fn up_next_is_the_next_newest_release_test() {
  let tracks = chipcafe.catalog()
  let next = chipcafe.up_next(tracks, 0)

  assert next.id == "ozzed-top-city"
}

pub fn next_index_wraps_at_the_end_of_the_set_test() {
  let tracks = chipcafe.catalog()
  let length = list.length(tracks)

  assert chipcafe.next_index(length, length - 1) == 0
  assert chipcafe.up_next(tracks, length - 1).id == "komiku-boss-fight-circuit"
}

pub fn track_at_wraps_both_ways_test() {
  let tracks = chipcafe.catalog()
  let length = list.length(tracks)

  assert chipcafe.track_at(tracks, length).id == "komiku-boss-fight-circuit"
  assert chipcafe.track_at(tracks, -1).id == "eric-skiff-chibi-ninja"
}

pub fn every_track_has_a_real_length_test() {
  list.each(chipcafe.catalog(), fn(track) {
    assert chipcafe.track_seconds(track) > 0
  })

  assert chipcafe.track_seconds(chipcafe.track_at(chipcafe.catalog(), 0)) == 208
}

pub fn playlist_json_contains_the_real_audio_urls_test() {
  let json = chipcafe.playlist_json()

  assert string.starts_with(json, "[")
  assert string.ends_with(json, "]")

  list.each(chipcafe.catalog(), fn(track) {
    assert string.contains(json, "\"id\":\"" <> track.id <> "\"")
    assert string.contains(json, "\"audio_url\":\"" <> track.audio_url <> "\"")
  })
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
