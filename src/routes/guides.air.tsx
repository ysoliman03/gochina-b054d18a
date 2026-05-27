import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { GuideHeader } from "@/components/GuideHeader";
import { useAppStore } from "@/store/useAppStore";
import { cities } from "@/data/cities";
import { pageHead, articleJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/guides/air")({
  component: AirQuality,
  head: () => {
    const base = pageHead({
      path: "/guides/air",
      title: "China Air Quality Guide — AQI by City | GoChina",
      description:
        "Understand AQI levels in Beijing, Shanghai, and other Chinese cities, plus mask and activity tips for travelers.",
      type: "article",
    });
    return {
      ...base,
      scripts: [
        articleJsonLd(
          "China Air Quality Guide",
          "AQI explained for travelers, with city forecasts and mask guidance.",
          "/guides/air",
        ),
      ],
    };
  },
});

function aqiBand(aqi: number) {
  if (aqi <= 50) return { label: "Good", color: "bg-emerald-500", text: "text-emerald-50", advice: "Air quality is satisfactory. Outdoor activities are safe for everyone." };
  if (aqi <= 100) return { label: "Moderate", color: "bg-yellow-500", text: "text-yellow-50", advice: "Acceptable for most. Unusually sensitive people should limit prolonged outdoor exertion." };
  if (aqi <= 150) return { label: "Unhealthy for Sensitive Groups", color: "bg-orange-500", text: "text-orange-50", advice: "Children, elderly, and those with lung disease should reduce outdoor exertion." };
  if (aqi <= 200) return { label: "Unhealthy", color: "bg-red-500", text: "text-red-50", advice: "Everyone may begin to feel effects. Wear an N95 mask outdoors and limit time outside." };
  if (aqi <= 300) return { label: "Very Unhealthy", color: "bg-purple-600", text: "text-purple-50", advice: "Health alert. Avoid all outdoor activity. Run an air purifier indoors." };
  return { label: "Hazardous", color: "bg-rose-900", text: "text-rose-50", advice: "Serious health effects. Stay indoors. Mask required if you must go out." };
}

function AirQuality() {
  const trip = useAppStore((s) => s.trip);
  const weather = useAppStore((s) => s.mockWeather);
  const city = (cities as any)[trip.currentCityId];
  const aqi = weather?.aqi ?? 85;
  const band = aqiBand(aqi);

  return (
    <MobileShell>
      <GuideHeader emoji="🌫️" title="Air Quality" />

      <section className="px-5 pb-5">
        <div className={`rounded-2xl ${band.color} ${band.text} p-6`}>
          <p className="text-xs font-bold uppercase tracking-wide opacity-80">
            {city?.name || "Current City"} · Right now
          </p>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-6xl font-bold">{aqi}</span>
            <span className="text-sm pb-2 opacity-80">AQI</span>
          </div>
          <p className="text-lg font-semibold mt-1">{band.label}</p>
          <p className="text-sm opacity-90 mt-2 leading-snug">{band.advice}</p>
        </div>
      </section>

      <section className="px-5 pb-5">
        <div className="rounded-2xl bg-card border border-border p-5">
          <h2 className="font-bold text-foreground mb-3">What the AQI Means</h2>
          <div className="space-y-2">
            {[
              { range: "0–50", label: "Good", color: "bg-emerald-500" },
              { range: "51–100", label: "Moderate", color: "bg-yellow-500" },
              { range: "101–150", label: "Sensitive Groups", color: "bg-orange-500" },
              { range: "151–200", label: "Unhealthy", color: "bg-red-500" },
              { range: "201–300", label: "Very Unhealthy", color: "bg-purple-600" },
              { range: "301+", label: "Hazardous", color: "bg-rose-900" },
            ].map((row) => (
              <div key={row.range} className="flex items-center gap-3">
                <div className={`w-12 h-6 rounded-md ${row.color}`} />
                <span className="text-sm font-mono text-muted-foreground w-20">{row.range}</span>
                <span className="text-sm text-foreground">{row.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-5">
        <div className="rounded-2xl bg-card border border-border p-5">
          <h2 className="font-bold text-foreground mb-3">Practical Tips</h2>
          <ul className="space-y-2.5 text-sm text-foreground">
            <li className="flex gap-2"><span>😷</span> Pack N95/KN95 masks — easy to buy at pharmacies if you forget.</li>
            <li className="flex gap-2"><span>📱</span> Check AQI daily — readings change fast with weather.</li>
            <li className="flex gap-2"><span>🏨</span> Hotels in the 4★+ range usually have HEPA filtration.</li>
            <li className="flex gap-2"><span>🌳</span> Mornings are often cleaner than afternoons. Plan outdoor sights early.</li>
            <li className="flex gap-2"><span>💧</span> Stay hydrated — pollution irritates eyes and throat faster when dry.</li>
          </ul>
        </div>
      </section>

      <section className="px-5 pb-10">
        <a
          href="https://aqicn.org/city/beijing/"
          target="_blank"
          rel="noreferrer"
          className="block w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-primary/90"
        >
          Live AQI on aqicn.org →
        </a>
      </section>
    </MobileShell>
  );
}