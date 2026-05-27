import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import {
  loadAllFromCloud,
  upsertProfile,
  upsertActiveTrip,
  upsertSavedPois,
  upsertDigitalTools,
} from "@/lib/cloudSync";

const PUBLIC_PATHS = new Set(["/login"]);

export function AuthGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const hydrate = async (userId: string) => {
      try {
        const snap = await loadAllFromCloud(userId);
        const profileRow = snap.profileRow as any;
        const tripRow = snap.tripRow as any;
        useAppStore.getState().applyCloudSnapshot({
          profile: profileRow
            ? {
                name: profileRow.name ?? "",
                nationality: profileRow.nationality ?? "",
                avatar: profileRow.avatar_url ?? null,
                groupType: profileRow.group_type ?? "couple",
                pace: profileRow.pace ?? "moderate",
                budget: profileRow.budget ?? "mid",
                cuisine: profileRow.cuisine ?? [],
                interests: profileRow.interests ?? [],
                dietaryRestrictions: profileRow.dietary_restrictions ?? [],
                hasInternationalCard: profileRow.has_international_card ?? true,
                mobility: profileRow.mobility ?? "normal",
                onboarded: profileRow.onboarded,
              }
            : undefined,
          trip: tripRow
            ? {
                cities: tripRow.cities ?? [],
                currentCityId: tripRow.current_city_id ?? "BJ",
                itinerary: tripRow.itinerary ?? {},
              }
            : undefined,
          savedPois: snap.saved,
          digitalTools: snap.tools,
          recentActivity: snap.activity,
        });

        // First-login: if no profile/trip rows exist yet, push local defaults up.
        if (!profileRow) await upsertProfile(userId, useAppStore.getState());
        if (!tripRow) await upsertActiveTrip(userId, useAppStore.getState());
        if (Object.keys(snap.tools).length === 0) {
          await upsertDigitalTools(userId, useAppStore.getState().digitalTools);
        }
        if (snap.saved.length === 0 && useAppStore.getState().savedPois.length > 0) {
          await upsertSavedPois(userId, useAppStore.getState().savedPois);
        }
      } catch (e) {
        console.error("[AuthGate] hydrate failed", e);
      }
    };

    const apply = async (session: { user: { id: string } } | null) => {
      if (!mounted) return;
      if (session?.user) {
        const uid = session.user.id;
        useAppStore.getState().setUserId(uid);
        if (lastUserId.current !== uid) {
          lastUserId.current = uid;
          await hydrate(uid);
        }
        setSignedIn(true);
      } else {
        if (lastUserId.current) {
          useAppStore.getState().resetLocalToDefaults();
          lastUserId.current = null;
        }
        useAppStore.getState().setUserId(null);
        setSignedIn(false);
      }
      setChecking(false);
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session as any));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => apply(session as any));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (checking) return;
    const isPublic = PUBLIC_PATHS.has(location.pathname);
    if (!signedIn && !isPublic) {
      navigate({ to: "/login" });
    } else if (signedIn && isPublic) {
      navigate({ to: "/" });
    }
  }, [checking, signedIn, location.pathname, navigate]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!signedIn && !PUBLIC_PATHS.has(location.pathname)) {
    return null;
  }

  return <>{children}</>;
}