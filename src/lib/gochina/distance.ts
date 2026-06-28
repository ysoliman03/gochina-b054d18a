import { wgs84ToGcj02 } from "@/lib/gochina/coord";

type LatLng = {
  lat: number;
  lng: number;
};

const EARTH_RADIUS_KM = 6371;

function isCoordinate(value: unknown): value is LatLng {
  const point = value as Partial<LatLng>;
  return typeof point?.lat === "number" && typeof point?.lng === "number";
}

export function getGaodeDistanceKm(from: unknown, to: unknown): number | null {
  if (!isCoordinate(from) || !isCoordinate(to)) return null;

  const [fromLng, fromLat] = wgs84ToGcj02(from.lng, from.lat);
  const [toLng, toLat] = wgs84ToGcj02(to.lng, to.lat);
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistanceKm(distanceKm: number | null): string | null {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
}
