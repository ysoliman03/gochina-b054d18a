import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildDayPlan, recalculateTimes, getTransitTime } from "@/engine/itineraryEngine";
import { pois } from "@/data/pois";
import {
  upsertProfile,
  upsertActiveTrip,
  upsertSavedPois,
  upsertDigitalTools,
  insertActivity,
} from "@/lib/cloudSync";

function syncWith(fn: (uid: string) => Promise<unknown>) {
  const uid = useAppStore.getState().userId;
  if (!uid) return;
  fn(uid).catch((e) => console.error("[cloudSync]", e));
}

function learnFromTags(currentInterests: string[], poiId: string) {
  const poi: any = (pois as any)[poiId];
  if (!poi) return currentInterests;
  const updated = [...currentInterests];
  (poi.tags || []).forEach((tag: string) => {
    if (!updated.includes(tag)) updated.push(tag);
  });
  return updated;
}

function deriveInsights(profile: any) {
  const insights: any[] = [];
  if (profile.cuisine?.includes("Street Food") || profile.cuisine?.includes("Spicy")) {
    insights.push({ icon: "🍜", label: "Local Dining Enthusiast", desc: "You favor authentic local spots over international chains." });
  }
  if (profile.pace === "slow") {
    insights.push({ icon: "🚶", label: "Immersive Explorer", desc: "You prefer 1-2 deep dives per day over packed schedules." });
  } else if (profile.pace === "moderate") {
    insights.push({ icon: "🚶", label: "Moderate Pace", desc: "Preferring 2-3 key activities per day." });
  } else if (profile.pace === "fast") {
    insights.push({ icon: "⚡", label: "High Energy Traveler", desc: "You like to maximize your time with 4+ stops per day." });
  }
  if (profile.budget === "budget") {
    insights.push({ icon: "💰", label: "Savvy Traveler", desc: "You know how to find great experiences without overspending." });
  } else if (profile.budget === "luxury") {
    insights.push({ icon: "💎", label: "Premium Explorer", desc: "You value comfort and curated high-end experiences." });
  }
  if (profile.dietaryRestrictions?.includes("Vegetarian")) {
    insights.push({ icon: "🥗", label: "Vegetarian Traveler", desc: "We'll prioritize plant-based options in your recommendations." });
  }
  if (profile.dietaryRestrictions?.includes("Halal")) {
    insights.push({ icon: "🌙", label: "Halal Dining", desc: "Halal-certified restaurant options will be highlighted for you." });
  }
  return insights.length
    ? insights
    : [{ icon: "🧭", label: "Explorer", desc: "Your travel style is taking shape. Keep using the app to unlock personalized insights." }];
}

type ProfileState = {
  name: string;
  nationality: string;
  avatar: string | null;
  groupType: string;
  pace: string;
  budget: string;
  cuisine: string[];
  interests: string[];
  dietaryRestrictions: string[];
  hasInternationalCard: boolean;
  mobility: string;
};

type TripCity = { cityId: string; startDate: string; endDate: string; days: number };

type TripState = {
  cities: TripCity[];
  currentCityId: string;
  itinerary: Record<string, any[]>;
};

const createDefaultProfile = (): ProfileState => ({
  name: "",
  nationality: "",
  avatar: null,
  groupType: "couple",
  pace: "moderate",
  budget: "mid",
  cuisine: [],
  interests: [],
  dietaryRestrictions: [],
  hasInternationalCard: true,
  mobility: "normal",
});

const createDefaultTrip = (): TripState => ({
  cities: [],
  currentCityId: "BJ",
  itinerary: {},
});

const createDefaultTools = () => ({ wechat: "not_started", alipay: "not_started", didi: "not_started" });

interface AppState {
  onboarded: boolean;
  profile: ProfileState;
  trip: TripState;
  savedPois: string[];
  recentActivity: any[];
  digitalTools: Record<string, string>;
  mockWeather: { condition: string; temp: number; aqi: number; description: string };
  userId: string | null;
  cloudHydrated: boolean;
  setUserId: (id: string | null) => void;
  applyCloudSnapshot: (snap: {
    profile?: Partial<ProfileState> & { onboarded?: boolean | null };
    trip?: Partial<TripState>;
    savedPois?: string[];
    digitalTools?: Record<string, string>;
    recentActivity?: any[];
  }) => void;
  resetLocalToDefaults: () => void;
  setOnboarded: (v: boolean) => void;
  completeOnboarding: (profile: ProfileState) => void;
  updateProfile: (u: Partial<ProfileState>) => void;
  updateTrip: (u: Partial<TripState>) => void;
  setItinerary: (cityId: string, days: any[]) => void;
  removePOIFromDay: (cityId: string, dayIndex: number, poiId: string) => void;
  addPOIToDay: (cityId: string, dayIndex: number, poi: any) => void;
  replacePOIInDay: (cityId: string, dayIndex: number, oldPoiId: string, newPoi: any) => void;
  replanDay: (cityId: string, dayIndex: number) => void;
  toggleSavePoi: (poiId: string, name: string) => void;
  addActivity: (item: any) => void;
  updateDigitalTool: (tool: string, status: string) => void;
  getInsights: () => any[];
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      profile: createDefaultProfile(),
      trip: createDefaultTrip(),
      savedPois: [],
      recentActivity: [],
      digitalTools: createDefaultTools(),
      mockWeather: { condition: "rain", temp: 18, aqi: 42, description: "Rain expected tomorrow" },
      userId: null,
      cloudHydrated: false,

      setUserId: (id) => set({ userId: id }),

      applyCloudSnapshot: (snap) =>
        set((s) => ({
          profile: snap.profile ? { ...s.profile, ...snap.profile } : s.profile,
          onboarded: snap.profile?.onboarded === true,
          trip: snap.trip ? { ...s.trip, ...snap.trip } : s.trip,
          savedPois: snap.savedPois ?? s.savedPois,
          digitalTools: snap.digitalTools && Object.keys(snap.digitalTools).length
            ? { ...s.digitalTools, ...snap.digitalTools }
            : s.digitalTools,
          recentActivity: snap.recentActivity ?? s.recentActivity,
          cloudHydrated: true,
        })),

      resetLocalToDefaults: () =>
        set({
          onboarded: false,
          profile: createDefaultProfile(),
          trip: createDefaultTrip(),
          savedPois: [],
          recentActivity: [],
          digitalTools: createDefaultTools(),
          userId: null,
          cloudHydrated: false,
        }),

      completeOnboarding: (profile) => {
        set({ onboarded: true, profile });
        syncWith((uid) => upsertProfile(uid, useAppStore.getState()));
      },
      setOnboarded: (val) => {
        set({ onboarded: val });
        syncWith((uid) => upsertProfile(uid, useAppStore.getState()));
      },
      updateProfile: (updates) => {
        set((s) => ({ profile: { ...s.profile, ...updates } }));
        syncWith((uid) => upsertProfile(uid, useAppStore.getState()));
      },
      updateTrip: (updates) => {
        set((s) => ({ trip: { ...s.trip, ...updates } }));
        syncWith((uid) => upsertActiveTrip(uid, useAppStore.getState()));
      },
      setItinerary: (cityId, days) => {
        set((s) => ({ trip: { ...s.trip, itinerary: { ...s.trip.itinerary, [cityId]: days } } }));
        syncWith((uid) => upsertActiveTrip(uid, useAppStore.getState()));
      },

      removePOIFromDay: (cityId, dayIndex, poiId) =>
        set((s) => {
          const days = (s.trip.itinerary[cityId] || []).map((day: any, i: number) => {
            if (i !== dayIndex) return day;
            const stops = recalculateTimes(day.stops.filter((stop: any) => stop.id !== poiId));
            return { ...day, stops };
          });
          return { trip: { ...s.trip, itinerary: { ...s.trip.itinerary, [cityId]: days } } };
        }),

      addPOIToDay: (cityId, dayIndex, poi) =>
        set((s) => {
          const days = (s.trip.itinerary[cityId] || []).map((day: any, i: number) => {
            if (i !== dayIndex) return day;
            const lastStop = day.stops[day.stops.length - 1];
            const transit = lastStop ? getTransitTime(lastStop.id, poi.id) : 0;
            const startTime = lastStop ? lastStop.scheduledEnd + transit : 9 * 60;
            const newStop = {
              ...poi,
              scheduledStart: startTime,
              scheduledEnd: startTime + poi.duration,
              transitFromPrev: transit,
            };
            return { ...day, stops: [...day.stops, newStop] };
          });
          const activity = [
            { type: "itinerary", text: `Added ${poi.name} to Day ${dayIndex + 1}`, time: "Just now" },
            ...s.recentActivity.slice(0, 9),
          ];
          const updatedInterests = learnFromTags(s.profile.interests, poi.id);
          return {
            trip: { ...s.trip, itinerary: { ...s.trip.itinerary, [cityId]: days } },
            recentActivity: activity,
            profile: { ...s.profile, interests: updatedInterests },
          };
        }),

      replacePOIInDay: (cityId, dayIndex, oldPoiId, newPoi) =>
        set((s) => {
          const days = (s.trip.itinerary[cityId] || []).map((day: any, i: number) => {
            if (i !== dayIndex) return day;
            const stops = day.stops.map((stop: any) => {
              if (stop.id !== oldPoiId) return stop;
              return {
                ...newPoi,
                scheduledStart: stop.scheduledStart,
                scheduledEnd: stop.scheduledStart + newPoi.duration,
                transitFromPrev: stop.transitFromPrev,
              };
            });
            return { ...day, stops: recalculateTimes(stops) };
          });
          return { trip: { ...s.trip, itinerary: { ...s.trip.itinerary, [cityId]: days } } };
        }),

      replanDay: (cityId, dayIndex) =>
        set((s) => {
          const profile = s.profile;
          const allDays = s.trip.itinerary[cityId] || [];
          const usedIds = allDays
            .filter((_: any, i: number) => i !== dayIndex)
            .flatMap((d: any) => (d.stops || []).map((p: any) => p.id));
          const newStops = buildDayPlan(cityId, null, profile, usedIds, true);
          const days = allDays.map((day: any, i: number) =>
            i === dayIndex ? { ...day, stops: newStops } : day,
          );
          return { trip: { ...s.trip, itinerary: { ...s.trip.itinerary, [cityId]: days } } };
        }),

      toggleSavePoi: (poiId, name) => {
        set((s) => {
          const saved = s.savedPois.includes(poiId);
          const activity = saved
            ? s.recentActivity
            : [{ type: "save", text: `Saved: ${name}`, time: "Just now" }, ...s.recentActivity.slice(0, 9)];
          const updatedInterests = saved ? s.profile.interests : learnFromTags(s.profile.interests, poiId);
          return {
            savedPois: saved ? s.savedPois.filter((id) => id !== poiId) : [...s.savedPois, poiId],
            recentActivity: activity,
            profile: { ...s.profile, interests: updatedInterests },
          };
        });
        const st = useAppStore.getState();
        syncWith((uid) => upsertSavedPois(uid, st.savedPois));
        if (st.savedPois.includes(poiId)) {
          syncWith((uid) => insertActivity(uid, { type: "save", text: `Saved: ${name}` }));
        }
      },

      addActivity: (item) => {
        set((s) => ({ recentActivity: [item, ...s.recentActivity.slice(0, 9)] }));
        syncWith((uid) => insertActivity(uid, item));
      },
      updateDigitalTool: (tool, status) => {
        set((s) => ({ digitalTools: { ...s.digitalTools, [tool]: status } }));
        syncWith((uid) => upsertDigitalTools(uid, useAppStore.getState().digitalTools));
      },
      getInsights: () => deriveInsights(get().profile),
    }),
    {
      name: "gochina-store",
      partialize: (state) => ({
        // never persist auth across users
        onboarded: state.onboarded,
        profile: state.profile,
        trip: state.trip,
        savedPois: state.savedPois,
        recentActivity: state.recentActivity,
        digitalTools: state.digitalTools,
      }),
    },
  ),
);