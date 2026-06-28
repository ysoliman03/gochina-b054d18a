import { wgs84ToGcj02 } from "@/lib/gochina/coord";

type Point = {
  lat: number;
  lng: number;
  name?: string;
};

function isPoint(value: unknown): value is Point {
  const point = value as Partial<Point>;
  return typeof point?.lat === "number" && typeof point?.lng === "number";
}

function formatCoord(value: number) {
  return Number(value.toFixed(6)).toString();
}

function pointParam(point: Point, fallbackName: string) {
  const [lng, lat] = wgs84ToGcj02(point.lng, point.lat);
  const name = (point.name || fallbackName).trim();
  return `${formatCoord(lng)},${formatCoord(lat)},${name}`;
}

export function getGaodeDirectionsUrl(from: unknown, to: unknown): string | null {
  if (!isPoint(from) || !isPoint(to)) return null;

  const params = new URLSearchParams({
    from: pointParam(from, "Start"),
    to: pointParam(to, "Destination"),
    mode: "bus",
    coordinate: "gaode",
    callnative: "0",
    src: "gochina",
  });

  return `https://uri.amap.com/navigation?${params.toString()}`;
}
