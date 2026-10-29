import chipcafe
import gleeunit

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn time_is_formatted_as_minutes_and_seconds_test() {
  assert chipcafe.format_time(0) == "0:00"
  assert chipcafe.format_time(9) == "0:09"
  assert chipcafe.format_time(59) == "0:59"
  assert chipcafe.format_time(60) == "1:00"
  assert chipcafe.format_time(125) == "2:05"
  assert chipcafe.format_time(3605) == "60:05"
}

pub fn negative_time_is_clamped_test() {
  assert chipcafe.format_time(-4) == "0:00"
}

pub fn progress_percent_tracks_playback_test() {
  assert chipcafe.progress_percent(0, 240) == 0
  assert chipcafe.progress_percent(60, 240) == 25
  assert chipcafe.progress_percent(120, 240) == 50
  assert chipcafe.progress_percent(240, 240) == 100
  assert chipcafe.progress_percent(300, 240) == 100
}

pub fn progress_percent_is_zero_without_a_duration_test() {
  assert chipcafe.progress_percent(30, 0) == 0
  assert chipcafe.progress_percent(30, -1) == 0
}

pub fn mix_counter_is_zero_padded_test() {
  assert chipcafe.mix_number(1) == "001"
  assert chipcafe.mix_number(9) == "009"
  assert chipcafe.mix_number(42) == "042"
  assert chipcafe.mix_number(999) == "999"
}

pub fn stream_status_labels_test() {
  assert chipcafe.status_label(chipcafe.Tuning) == "TUNING"
  assert chipcafe.status_label(chipcafe.Live) == "ON AIR"
  assert chipcafe.status_label(chipcafe.Paused) == "PAUSED"
  assert chipcafe.status_label(chipcafe.Blocked) == "SOUND LOCKED"
  assert chipcafe.status_label(chipcafe.Failed) == "SIGNAL LOST"
}

pub fn seek_target_is_clamped_to_the_track_test() {
  assert chipcafe.seek_seconds("42", 180) == 42
  assert chipcafe.seek_seconds("0", 180) == 0
  assert chipcafe.seek_seconds("-5", 180) == 0
  assert chipcafe.seek_seconds("400", 180) == 180
  assert chipcafe.seek_seconds("not a number", 180) == 0
}
