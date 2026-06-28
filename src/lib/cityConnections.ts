import { cityConnections } from "@/data/generated/cityConnections";

export function getConnectionsBetween(fromCityId: string, toCityId: string) {
  return cityConnections.filter((connection) => {
    return (
      (connection.fromCityId === fromCityId && connection.toCityId === toCityId) ||
      (connection.fromCityId === toCityId && connection.toCityId === fromCityId)
    );
  });
}
