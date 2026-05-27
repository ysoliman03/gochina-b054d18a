import { supabase } from "@/integrations/supabase/client";
import type { useAppStore } from "@/store/useAppStore";

type StoreState = ReturnType<typeof useAppStore.getState>;

export async function loadAllFromCloud(userId: string) {
  const [profileRes, tripsRes, savedRes, toolsRes, actRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("trips").select("*").eq("user_id", userId).eq("is_active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("saved_pois").select("poi_id").eq("user_id", userId),
    supabase.from("digital_tools").select("tool,status").eq("user_id", userId),
    supabase.from("activity_log").select("type,text,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
  ]);

  return {
    profileRow: profileRes.data,
    tripRow: tripsRes.data,
    saved: (savedRes.data || []).map((r: any) => r.poi_id as string),
    tools: Object.fromEntries((toolsRes.data || []).map((r: any) => [r.tool, r.status])) as Record<string, string>,
    activity: (actRes.data || []).map((r: any) => ({ type: r.type, text: r.text, time: relTime(r.created_at) })),
  };
}

function relTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const m = Math.round(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export async function upsertProfile(userId: string, state: StoreState) {
  const p = state.profile;
  await supabase.from("profiles").upsert({
    id: userId,
    name: p.name,
    nationality: p.nationality,
    avatar_url: p.avatar,
    group_type: p.groupType,
    pace: p.pace,
    budget: p.budget,
    cuisine: p.cuisine,
    interests: p.interests,
    dietary_restrictions: p.dietaryRestrictions,
    has_international_card: p.hasInternationalCard,
    mobility: p.mobility,
    onboarded: state.onboarded,
  });
}

export async function upsertActiveTrip(userId: string, state: StoreState) {
  const t = state.trip;
  // find existing active
  const { data: existing } = await supabase
    .from("trips")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("trips")
      .update({ cities: t.cities, current_city_id: t.currentCityId, itinerary: t.itinerary })
      .eq("id", existing.id);
  } else {
    await supabase.from("trips").insert({
      user_id: userId,
      name: "My trip",
      cities: t.cities,
      current_city_id: t.currentCityId,
      itinerary: t.itinerary,
      is_active: true,
    });
  }
}

export async function upsertSavedPois(userId: string, savedPois: string[]) {
  const { data: existing } = await supabase.from("saved_pois").select("poi_id").eq("user_id", userId);
  const have = new Set((existing || []).map((r: any) => r.poi_id as string));
  const want = new Set(savedPois);
  const toAdd = [...want].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !want.has(id));
  if (toAdd.length) {
    await supabase.from("saved_pois").insert(toAdd.map((poi_id) => ({ user_id: userId, poi_id })));
  }
  if (toRemove.length) {
    await supabase.from("saved_pois").delete().eq("user_id", userId).in("poi_id", toRemove);
  }
}

export async function upsertDigitalTools(userId: string, tools: Record<string, string>) {
  const rows = Object.entries(tools).map(([tool, status]) => ({ user_id: userId, tool, status }));
  if (!rows.length) return;
  await supabase.from("digital_tools").upsert(rows, { onConflict: "user_id,tool" });
}

export async function insertActivity(userId: string, item: { type: string; text: string }) {
  await supabase.from("activity_log").insert({ user_id: userId, type: item.type, text: item.text });
}