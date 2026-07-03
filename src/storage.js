const KEY = 'deepcast.spots.v2';

export function loadSpots() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveSpots(spots) {
  try {
    localStorage.setItem(KEY, JSON.stringify(spots));
  } catch {
    // storage full or unavailable — spots just won't persist
  }
}
