const favoriteKey = "8bit-cafe.favorite-room";

export function loadFavorite() {
  try {
    return window.localStorage.getItem(favoriteKey) || "";
  } catch (_error) {
    return "";
  }
}

export function saveFavorite(roomId) {
  try {
    window.localStorage.setItem(favoriteKey, roomId);
  } catch (_error) {
    // Listening still works when storage is blocked or unavailable.
  }
}

export function clearFavorite() {
  try {
    window.localStorage.removeItem(favoriteKey);
  } catch (_error) {
    // Listening still works when storage is blocked or unavailable.
  }
}

export function trackEvent(name, roomId) {
  if (typeof window.umami?.track !== "function") return;

  const data = roomId ? { room: roomId } : undefined;
  window.umami.track(name, data);
}
