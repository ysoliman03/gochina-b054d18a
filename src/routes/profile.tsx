import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { useAppStore } from "@/store/useAppStore";
import { pois } from "@/data/generated/pois";
import { Bookmark, LogOut, Settings, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/profile")({
  component: Profile,
  head: () =>
    pageHead({
      path: "/profile",
      title: "Your Profile | GoChina",
      description:
        "Manage your travel preferences, saved places, and trip insights on GoChina.",
    }),
});

function Profile() {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const savedPois = useAppStore((s) => s.savedPois);
  const recentActivity = useAppStore((s) => s.recentActivity);
  const toggleSavePoi = useAppStore((s) => s.toggleSavePoi);
  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const insights = useAppStore((s) => s.getInsights)();

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  return (
    <MobileShell>
      <header className="px-5 pt-8 pb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-primary-foreground">
          {(profile.name || "G")[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{profile.name || "Guest"}</h1>
          <p className="text-sm text-muted-foreground">{profile.nationality || "Traveller"} · {profile.groupType}</p>
        </div>
        <button aria-label="Settings" className="p-2 text-muted-foreground">
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <section className="px-5 pb-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Your travel insights</h2>
        <div className="space-y-2">
          {insights.map((i, idx) => (
            <div key={idx} className="rounded-xl bg-card border border-border p-3 flex gap-3">
              <span className="text-2xl">{i.icon}</span>
              <div>
                <p className="text-sm font-semibold text-foreground">{i.label}</p>
                <p className="text-xs text-muted-foreground">{i.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
          <Bookmark className="w-3.5 h-3.5" /> Saved places ({savedPois.length})
        </h2>
        <div className="space-y-2">
          {savedPois.length === 0 && (
            <p className="text-sm text-muted-foreground">Tap the bookmark icon on any place to save it.</p>
          )}
          {savedPois.map((id) => {
            const p: any = (pois as any)[id];
            if (!p) return null;
            return (
              <div key={id} className="rounded-xl bg-card border border-border p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.district}</p>
                </div>
                <button onClick={() => toggleSavePoi(id, p.name)} aria-label={`Remove ${p.name} from saved`} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {recentActivity.length > 0 && (
        <section className="px-5 pb-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent activity</h2>
          <ul className="space-y-1.5">
            {recentActivity.slice(0, 6).map((a, i) => (
              <li key={i} className="text-sm text-foreground flex justify-between border-b border-border/60 pb-1.5">
                <span>{a.text}</span>
                <span className="text-xs text-muted-foreground">{a.time}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="px-5 pb-8">
        <button
          onClick={signOut}
          className="w-full rounded-xl bg-card border border-border py-3 text-sm font-medium text-foreground flex items-center justify-center gap-2 mb-3"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
        <button
          onClick={() => {
            setOnboarded(false);
            navigate({ to: "/onboarding" });
          }}
          className="w-full rounded-xl border border-border bg-card py-3 text-sm font-medium text-muted-foreground flex items-center justify-center gap-2"
        >
          Restart onboarding
        </button>
      </section>
    </MobileShell>
  );
}
