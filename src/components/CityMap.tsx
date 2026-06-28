import { useEffect, useRef, useState } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import { wgs84ToGcj02 } from "@/lib/gochina/coord";

const KEY = (import.meta as any).env?.VITE_GAODE_API_KEY as string | undefined;
const SEC = (import.meta as any).env?.VITE_GAODE_SECURITY_KEY as string | undefined;

type Marker = { id: string; lat: number; lng: number; name: string; category?: string };

const CATEGORY_COLOR: Record<string, string> = {
  attraction: "#9b2c2c",
  restaurant: "#c2410c",
  experience: "#0f766e",
  nightlife: "#5b21b6",
  shopping: "#a16207",
};

export function CityMap({
  center,
  markers,
  className,
  onMarkerClick,
  selectedId,
}: {
  center: { lat: number; lng: number };
  markers: Marker[];
  className?: string;
  onMarkerClick?: (id: string) => void;
  selectedId?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!KEY || !ref.current) return;
    setLoadFailed(false);
    if (SEC) (window as any)._AMapSecurityConfig = { securityJsCode: SEC };
    let mounted = true;
    AMapLoader.load({ key: KEY, version: "2.0", plugins: [] })
      .then((AMap) => {
        if (!mounted || !ref.current) return;
        const [lng, lat] = wgs84ToGcj02(center.lng, center.lat);
        const map = new AMap.Map(ref.current, {
          zoom: 12,
          center: [lng, lat],
          viewMode: "2D",
        });
        mapRef.current = map;
        markers.forEach((m) => {
          const [mlng, mlat] = wgs84ToGcj02(m.lng, m.lat);
          const isSelected = m.id === selectedId;
          const color = isSelected
            ? "#1d4ed8"
            : CATEGORY_COLOR[m.category || "attraction"] || "#9b2c2c";
          const size = isSelected ? 30 : 22;
          const height = isSelected ? 38 : 28;
          const marker = new AMap.Marker({
            position: [mlng, mlat],
            title: m.name,
            zIndex: isSelected ? 200 : 100,
            content: `<div style="width:${size}px;height:${height}px;transform:translate(-${size / 2}px,-${height}px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))"><svg viewBox="0 0 22 28" xmlns="http://www.w3.org/2000/svg"><path d="M11 0C4.9 0 0 4.9 0 11c0 8 11 17 11 17s11-9 11-17C22 4.9 17.1 0 11 0z" fill="${color}"/><circle cx="11" cy="11" r="${isSelected ? 5 : 4}" fill="#fff"/></svg></div>`,
          });
          if (onMarkerClick) marker.on("click", () => onMarkerClick(m.id));
          map.add(marker);
        });
      })
      .catch(() => {
        if (mounted) setLoadFailed(true);
      });
    return () => {
      mounted = false;
      if (mapRef.current) {
        try {
          mapRef.current.destroy();
        } catch {}
        mapRef.current = null;
      }
    };
  }, [center.lat, center.lng, markers, onMarkerClick, selectedId]);

  if (!KEY || loadFailed) {
    // Fallback styled placeholder when no AMap key configured
    return (
      <div
        className={
          "relative w-full rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-accent/30 via-secondary to-muted " +
          (className || "h-56")
        }
      >
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:32px_32px]" />
        {markers.slice(0, 8).map((m, i) => {
          const left = 15 + ((i * 53) % 70);
          const top = 18 + ((i * 37) % 60);
          const isSelected = m.id === selectedId;
          const color = isSelected
            ? "#1d4ed8"
            : CATEGORY_COLOR[m.category || "attraction"] || "#9b2c2c";
          const size = isSelected ? 30 : 22;
          const height = isSelected ? 38 : 28;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onMarkerClick?.(m.id)}
              className={
                "absolute cursor-pointer transition-transform" + (isSelected ? " z-10" : "")
              }
              style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%,-100%)" }}
              title={m.name}
            >
              <svg width={size} height={height} viewBox="0 0 22 28">
                <path
                  d="M11 0C4.9 0 0 4.9 0 11c0 8 11 17 11 17s11-9 11-17C22 4.9 17.1 0 11 0z"
                  fill={color}
                />
                <circle cx="11" cy="11" r={isSelected ? 5 : 4} fill="#fff" />
              </svg>
            </button>
          );
        })}
        <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground bg-background/70 px-2 py-0.5 rounded">
          Map preview · set VITE_GAODE_API_KEY for live map
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={"w-full rounded-2xl overflow-hidden border border-border " + (className || "h-56")}
    />
  );
}
