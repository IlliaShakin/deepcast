// Minimal OpenStreetMap raster-tile loader for the optional map basemap.
// Tiles are only fetched when the user turns Map mode on. drawImage doesn't
// taint for display purposes, so no crossOrigin is needed.

const cache = new Map(); // "z/x/y" -> { img, ok }
const MAX_CACHE = 400;

export const lon2tileX = (lon, z) => ((lon + 180) / 360) * 2 ** z;
export const lat2tileY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};
export const tileX2lon = (x, z) => (x / 2 ** z) * 360 - 180;
export const tileY2lat = (y, z) => {
  const t = Math.PI * (1 - (2 * y) / 2 ** z);
  return (Math.atan(Math.sinh(t)) * 180) / Math.PI;
};

// Ground resolution (m/px) of a slippy tile pixel at a given latitude.
export const groundResolution = (lat, z) =>
  (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

export function getTile(z, x, y, onLoad) {
  const key = `${z}/${x}/${y}`;
  const hit = cache.get(key);
  if (hit) return hit.ok ? hit.img : null;
  const img = new Image();
  const entry = { img, ok: false };
  cache.set(key, entry);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  img.onload = () => {
    entry.ok = true;
    onLoad && onLoad();
  };
  img.onerror = () => {
    entry.ok = false;
  };
  const sub = ['a', 'b', 'c'][(x + y) % 3];
  img.src = `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
  return null;
}
