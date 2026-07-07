import { cityConnections } from "@/data/generated/cityConnections";
import { transportHubs } from "@/data/generated/transportHubs";
import type { CityConnection, TransportHub } from "@/data/types";

export function getConnectionsBetween(fromCityId: string, toCityId: string) {
  return cityConnections.filter((connection) => {
    return (
      (connection.fromCityId === fromCityId && connection.toCityId === toCityId) ||
      (connection.fromCityId === toCityId && connection.toCityId === fromCityId)
    );
  });
}

function budgetCeiling(budget?: string) {
  if (budget === "budget") return 1;
  if (budget === "luxury") return 5;
  return 2;
}

function hubTypeForMode(mode: CityConnection["travelMode"]): TransportHub["type"] {
  if (mode === "flight") return "airport";
  return "railway_station";
}

function hubMatchScore(hub: TransportHub, connection: CityConnection) {
  const note = connection.notes.toLowerCase();
  const name = hub.name.toLowerCase();
  const code = /\(([A-Z]{3})\)/.exec(hub.name)?.[1]?.toLowerCase();
  let score = hub.foreignFriendly ?? 0;

  if (code && note.includes(code)) score += 20;
  for (const token of ["south", "west", "north", "hongqiao", "capital", "daxing", "pudong"]) {
    if (name.includes(token) && note.includes(token)) score += 10;
  }
  if (note.includes(name.replace(/\(.*?\)/g, "").trim())) score += 15;
  return score;
}

export function getRecommendedConnection(
  fromCityId: string,
  toCityId: string,
  budget?: string,
) {
  const ceiling = budgetCeiling(budget);
  return [...getConnectionsBetween(fromCityId, toCityId)].sort((a, b) => {
    const aOverBudget = a.priceLevel > ceiling ? 1 : 0;
    const bOverBudget = b.priceLevel > ceiling ? 1 : 0;
    const aScore = aOverBudget * 600 + a.durationMin + a.priceLevel * 35;
    const bScore = bOverBudget * 600 + b.durationMin + b.priceLevel * 35;
    return aScore - bScore;
  })[0];
}

export function getRecommendedTransferHubs(
  fromCityId: string,
  toCityId: string,
  connection: CityConnection | undefined,
) {
  if (!connection) return { departureHub: null, arrivalHub: null };
  const hubType = hubTypeForMode(connection.travelMode);
  const pickHub = (cityId: string) =>
    transportHubs
      .filter((hub) => hub.cityId === cityId && hub.type === hubType)
      .sort((a, b) => hubMatchScore(b, connection) - hubMatchScore(a, connection))[0] ?? null;

  return {
    departureHub: pickHub(fromCityId),
    arrivalHub: pickHub(toCityId),
  };
}
