import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

type CsvRecord = Record<string, string> & { __rowNumber: string };

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");
const CONTENT_DB_DIR = resolve(ROOT, "content-db");
const GENERATED_TS_DIR = resolve(ROOT, "src/data/generated");
const AGENT_DATA_DIR = resolve(ROOT, "agent/data");

const EXPECTED_COUNTS = {
  cities: 4,
  pois: 158,
  cuisine: 41,
  transportHubs: 21,
  cityConnections: 9,
  poiConnections: 12,
  constraints: 27,
} as const;

const REQUIRED_COLUMNS = {
  "Cities.csv": [
    "city_id",
    "name_en",
    "name_zh",
    "intro",
    "best_months",
    "timezone",
    "airport_code",
    "latitude",
    "longitude",
    "tags",
  ],
  "POIs.csv": [
    "poi_id",
    "city_id",
    "name_en",
    "name_zh",
    "cover_image",
    "category",
    "description",
    "highlights",
    "visitor_tips",
    "caution_notes",
    "tags",
    "latitude",
    "longitude",
    "district",
    "opening_hours",
    "closing_hours",
    "avg_duration_min",
    "price_level",
    "indoor_outdoor",
    "best_time_of_day",
    "suitable_for",
    "seasonal_notes",
    "booking_required",
    "foreign_friendly",
    "signature_dishes",
  ],
  "Cuisine.csv": [
    "cuisine_id",
    "city_id",
    "poi_id",
    "dish_name_en",
    "dish_name_cn",
    "category",
    "tag",
    "discription",
    "image",
  ],
  "Transportation_Hub.csv": [
    "poi_id",
    "city_id",
    "name_en",
    "name_zh",
    "category",
    "description",
    "visitor_tips",
    "caution_notes",
    "tags",
    "latitude",
    "longitude",
    "district",
    "opening_hours",
    "foreign_friendly",
  ],
  "Travel_Constraints.csv": [
    "constraint_id",
    "city_id",
    "poi_id",
    "type",
    "title",
    "start_date",
    "end_date",
    "recurrence_pattern",
    "severity",
    "impact",
    "suggested_action",
  ],
  "POI_Connections.csv": [
    "from_poi_id",
    "to_poi_id",
    "travel_mode",
    "duration_min",
    "distance_km",
    "notes",
  ],
  "City_Connections.csv": [
    "from_city_id",
    "to_city_id",
    "travel_mode",
    "duration_min",
    "price_level",
    "frequency",
    "notes",
  ],
} as const;

async function main() {
  const citiesRows = await readCsv("Cities.csv");
  const poiRows = await readCsv("POIs.csv");
  const cuisineRows = await readCsv("Cuisine.csv");
  const transportHubRows = await readCsv("Transportation_Hub.csv");
  const constraintRows = await readCsv("Travel_Constraints.csv");
  const poiConnectionRows = await readCsv("POI_Connections.csv");
  const cityConnectionRows = await readCsv("City_Connections.csv");

  validateCount("City", citiesRows, EXPECTED_COUNTS.cities);
  validateCount("POI", poiRows, EXPECTED_COUNTS.pois);
  validateCount("Cuisine", cuisineRows, EXPECTED_COUNTS.cuisine);
  validateCount("Transport hub", transportHubRows, EXPECTED_COUNTS.transportHubs);
  validateCount("City connection", cityConnectionRows, EXPECTED_COUNTS.cityConnections);
  validateCount("POI connection", poiConnectionRows, EXPECTED_COUNTS.poiConnections);
  validateCount("Constraint", constraintRows, EXPECTED_COUNTS.constraints);

  const cityIds = new Set(citiesRows.map((row) => required(row, "city_id")));
  const poiIds = new Set(poiRows.map((row) => required(row, "poi_id")));
  const hubIds = new Set(transportHubRows.map((row) => required(row, "poi_id")));

  failOnDuplicates("POI ID", poiRows, "poi_id");
  failOnDuplicates("Hub ID", transportHubRows, "poi_id");

  const hubPoiCollisions = [...hubIds].filter((id) => poiIds.has(id));
  if (hubPoiCollisions.length > 0) {
    fail(`Hub ID collides with POI ID: ${hubPoiCollisions.join(", ")}`);
  }

  for (const row of cuisineRows) {
    for (const poiId of splitList(row.poi_id)) {
      if (!poiIds.has(poiId)) {
        fail(`Cuisine row ${row.__rowNumber} references missing POI ID "${poiId}"`);
      }
    }
  }

  for (const row of poiConnectionRows) {
    const from = required(row, "from_poi_id");
    const to = required(row, "to_poi_id");
    if (!poiIds.has(from)) {
      fail(`POI connection row ${row.__rowNumber} references missing from_poi_id "${from}"`);
    }
    if (!poiIds.has(to)) {
      fail(`POI connection row ${row.__rowNumber} references missing to_poi_id "${to}"`);
    }
  }

  for (const row of cityConnectionRows) {
    const from = required(row, "from_city_id");
    const to = required(row, "to_city_id");
    if (!cityIds.has(from)) {
      fail(`City connection row ${row.__rowNumber} references missing from_city_id "${from}"`);
    }
    if (!cityIds.has(to)) {
      fail(`City connection row ${row.__rowNumber} references missing to_city_id "${to}"`);
    }
  }

  const cities = Object.fromEntries(citiesRows.map((row) => [row.city_id, toCity(row)]));
  const pois = Object.fromEntries(poiRows.map((row) => [row.poi_id, toPoi(row)]));
  const cuisine = cuisineRows.map(toCuisineDish);
  const constraints = constraintRows.map(toTravelConstraint);
  const poiConnections = poiConnectionRows.map(toPoiConnection);
  const cityConnections = cityConnectionRows.map(toCityConnection);
  const transportHubs = transportHubRows.map(toTransportHub);

  const agentPois = Object.fromEntries(poiRows.map((row) => [row.poi_id, toAgentPoi(row)]));
  const agentConstraints = constraintRows.map(toAgentConstraint);
  const agentPoiConnections = poiConnectionRows.map(toAgentPoiConnection);

  await mkdir(GENERATED_TS_DIR, { recursive: true });
  await mkdir(AGENT_DATA_DIR, { recursive: true });

  const writes = [
    writeTs("cities.ts", cityTs(cities)),
    writeTs("pois.ts", dataTs("POI", "pois", pois, "Record<string, POI>")),
    writeTs("cuisine.ts", dataTs("CuisineDish", "cuisine", cuisine, "CuisineDish[]")),
    writeTs(
      "constraints.ts",
      dataTs("TravelConstraint", "constraints", constraints, "TravelConstraint[]"),
    ),
    writeTs("poiConnections.ts", poiConnectionTs(poiConnections)),
    writeTs(
      "cityConnections.ts",
      dataTs("CityConnection", "cityConnections", cityConnections, "CityConnection[]"),
    ),
    writeTs(
      "transportHubs.ts",
      dataTs("TransportHub", "transportHubs", transportHubs, "TransportHub[]"),
    ),
    writeJson("cities.json", cities),
    writeJson("pois.json", agentPois),
    writeJson("cuisine.json", cuisine),
    writeJson("constraints.json", agentConstraints),
    writeJson("poi_connections.json", agentPoiConnections),
    writeJson("city_connections.json", cityConnections),
    writeJson("transport_hubs.json", transportHubs),
  ];

  await Promise.all(writes);

  console.log("Imported content database successfully.");
  console.log(`  cities: ${citiesRows.length}`);
  console.log(`  pois: ${poiRows.length}`);
  console.log(`  cuisine: ${cuisineRows.length}`);
  console.log(`  constraints: ${constraintRows.length}`);
  console.log(`  poi connections: ${poiConnectionRows.length}`);
  console.log(`  city connections: ${cityConnectionRows.length}`);
  console.log(`  transport hubs: ${transportHubRows.length}`);
}

async function readCsv(fileName: keyof typeof REQUIRED_COLUMNS): Promise<CsvRecord[]> {
  const text = await readFile(resolve(CONTENT_DB_DIR, fileName), "utf8");
  const rows = parseCsv(text);
  if (rows.length < 2) {
    fail(`${fileName} must include a description row and a header row`);
  }

  const headers = rows[1].map((header) => header.trim());
  const missingColumns = REQUIRED_COLUMNS[fileName].filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) {
    fail(`${fileName} is missing required column(s): ${missingColumns.join(", ")}`);
  }

  return rows
    .slice(2)
    .map((row, index) => {
      const record: CsvRecord = { __rowNumber: String(index + 3) };
      headers.forEach((header, columnIndex) => {
        if (!header) return;
        record[header] = clean(row[columnIndex] ?? "");
      });
      return record;
    })
    .filter((record) =>
      Object.entries(record).some(([key, value]) => key !== "__rowNumber" && value.trim() !== ""),
    );
}

function parseCsv(text: string, delimiter = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0 || text.endsWith(delimiter)) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function toCity(row: CsvRecord) {
  return {
    id: required(row, "city_id"),
    name: required(row, "name_en"),
    nameZh: row.name_zh,
    intro: row.intro,
    bestMonths: parseIntegerList(row.best_months),
    timezone: row.timezone,
    airportCode: row.airport_code,
    lat: parseNumber(row.latitude, "latitude", row),
    lng: parseNumber(row.longitude, "longitude", row),
    tags: splitList(row.tags),
  };
}

function toPoi(row: CsvRecord) {
  const openingHoursRaw = row.opening_hours || undefined;
  const closingHoursRaw = row.closing_hours || undefined;

  return {
    id: required(row, "poi_id"),
    cityId: required(row, "city_id"),
    name: required(row, "name_en"),
    nameZh: row.name_zh,
    coverImage: optional(row.cover_image),
    category: required(row, "category").toLowerCase(),
    description: row.description,
    highlights: splitList(row.highlights),
    tips: toTextArray(row.visitor_tips),
    cautions: toTextArray(row.caution_notes),
    tags: splitList(row.tags),
    lat: parseNumber(row.latitude, "latitude", row),
    lng: parseNumber(row.longitude, "longitude", row),
    district: row.district,
    hours: normalizeHours(row.opening_hours, row.closing_hours),
    openingHoursRaw,
    closingHoursRaw,
    duration: parseInteger(row.avg_duration_min, "avg_duration_min", row),
    price: parseInteger(row.price_level, "price_level", row),
    indoor: row.indoor_outdoor.toLowerCase() === "indoor",
    bestTime: row.best_time_of_day.toLowerCase() || "any",
    suitableFor: splitList(row.suitable_for).map((value) => value.toLowerCase()),
    seasonalNotes: parseIntegerList(row.seasonal_notes),
    bookingRequired: parseYesNo(row.booking_required),
    foreignFriendly: parseNullableInteger(row.foreign_friendly, "foreign_friendly", row),
    signatureDishes: splitList(row.signature_dishes),
  };
}

function toAgentPoi(row: CsvRecord) {
  return {
    id: required(row, "poi_id"),
    cityId: required(row, "city_id"),
    name: required(row, "name_en"),
    nameZh: row.name_zh,
    category: required(row, "category").toLowerCase(),
    description: row.description,
    highlights: row.highlights,
    tips: row.visitor_tips,
    cautions: row.caution_notes,
    tags: splitList(row.tags),
    lat: parseNumber(row.latitude, "latitude", row),
    lng: parseNumber(row.longitude, "longitude", row),
    district: row.district,
    hours: normalizeHours(row.opening_hours, row.closing_hours),
    duration: parseInteger(row.avg_duration_min, "avg_duration_min", row),
    price: parseInteger(row.price_level, "price_level", row),
    indoor: row.indoor_outdoor.toLowerCase() === "indoor",
    bestTime: row.best_time_of_day.toLowerCase() || "any",
    suitableFor: splitList(row.suitable_for).map((value) => value.toLowerCase()),
    bookingRequired: parseYesNo(row.booking_required),
    foreignFriendly: parseNullableInteger(row.foreign_friendly, "foreign_friendly", row),
  };
}

function toCuisineDish(row: CsvRecord) {
  return {
    id: required(row, "cuisine_id"),
    cityId: required(row, "city_id"),
    poiIds: splitList(row.poi_id),
    name: required(row, "dish_name_en"),
    nameZh: row.dish_name_cn,
    category: row.category,
    dietaryTags: splitList(row.tag),
    description: row.discription,
    imageKey: optional(row.image),
  };
}

function toTravelConstraint(row: CsvRecord) {
  return {
    id: required(row, "constraint_id"),
    cityId: nullable(row.city_id),
    poiId: nullable(row.poi_id),
    type: row.type,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    recurrencePattern: row.recurrence_pattern,
    severity: row.severity,
    impact: row.impact,
    action: row.suggested_action,
  };
}

function toAgentConstraint(row: CsvRecord) {
  return {
    ...toTravelConstraint(row),
    cityId: nullable(row.city_id),
    poiId: nullable(row.poi_id),
  };
}

function toPoiConnection(row: CsvRecord) {
  return {
    from: required(row, "from_poi_id"),
    to: required(row, "to_poi_id"),
    mode: row.travel_mode,
    duration: parseInteger(row.duration_min, "duration_min", row),
    distanceKm: parseNullableNumber(row.distance_km, "distance_km", row),
    notes: row.notes,
  };
}

function toAgentPoiConnection(row: CsvRecord) {
  return {
    from: required(row, "from_poi_id"),
    to: required(row, "to_poi_id"),
    mode: row.travel_mode,
    duration: parseInteger(row.duration_min, "duration_min", row),
    distanceKm: parseNullableNumber(row.distance_km, "distance_km", row),
    notes: row.notes,
  };
}

function toCityConnection(row: CsvRecord) {
  return {
    fromCityId: required(row, "from_city_id"),
    toCityId: required(row, "to_city_id"),
    travelMode: row.travel_mode,
    durationMin: parseInteger(row.duration_min, "duration_min", row),
    priceLevel: parseInteger(row.price_level, "price_level", row),
    frequency: row.frequency,
    notes: row.notes,
  };
}

function toTransportHub(row: CsvRecord) {
  return {
    id: required(row, "poi_id"),
    cityId: required(row, "city_id"),
    name: required(row, "name_en"),
    nameZh: row.name_zh,
    type: inferHubType(row.name_en, row.tags),
    description: row.description,
    tips: toTextArray(row.visitor_tips),
    cautions: toTextArray(row.caution_notes),
    tags: splitList(row.tags),
    lat: parseNumber(row.latitude, "latitude", row),
    lng: parseNumber(row.longitude, "longitude", row),
    district: row.district,
    openingHours: row.opening_hours || "24h",
    foreignFriendly: parseNullableInteger(row.foreign_friendly, "foreign_friendly", row),
  };
}

function inferHubType(name: string, tags: string) {
  const text = `${name} ${tags}`.toLowerCase();
  if (text.includes("airport")) return "airport";
  if (text.includes("railway") || text.includes("station")) return "railway_station";
  return "transport_hub";
}

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toTextArray(value: string | undefined): string[] {
  const text = clean(value ?? "");
  return text ? [text] : [];
}

function parseIntegerList(value: string | undefined): number[] {
  if (!value) return [];
  return [...value.matchAll(/\d+/g)].map((match) => Number(match[0]));
}

function parseNumber(value: string, field: string, row: CsvRecord): number {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    fail(`Row ${row.__rowNumber} has invalid ${field}: "${value}"`);
  }
  return parsed;
}

function parseNullableNumber(value: string, field: string, row: CsvRecord): number | null {
  if (!value.trim()) return null;
  return parseNumber(value, field, row);
}

function parseInteger(value: string, field: string, row: CsvRecord): number {
  const parsed = parseNumber(value, field, row);
  if (!Number.isInteger(parsed)) {
    fail(`Row ${row.__rowNumber} has non-integer ${field}: "${value}"`);
  }
  return parsed;
}

function parseNullableInteger(value: string, field: string, row: CsvRecord): number | null {
  if (!value.trim()) return null;
  return parseInteger(value, field, row);
}

function parseYesNo(value: string): boolean {
  return value.trim().toUpperCase() === "YES";
}

function normalizeHours(opening: string, closing: string): string {
  const open = opening.trim();
  const close = closing.trim();
  if (!open) return "09:00-18:00";
  if (open.toLowerCase() === "24h") return "24h";

  const openTime = firstTime(open);
  const closeTime = firstTime(close);
  if (openTime && closeTime) return `${openTime}-${closeTime}`;
  if (openTime) return `${openTime}-18:00`;
  return "09:00-18:00";
}

function firstTime(value: string): string | null {
  const match = value.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function clean(value: string): string {
  return value.trim();
}

function optional(value: string | undefined): string | undefined {
  const text = clean(value ?? "");
  return text || undefined;
}

function nullable(value: string | undefined): string | null {
  const text = clean(value ?? "");
  return text || null;
}

function required(row: CsvRecord, field: string): string {
  const value = row[field]?.trim();
  if (!value) fail(`Row ${row.__rowNumber} is missing required field "${field}"`);
  return value;
}

function validateCount(label: string, rows: unknown[], expected: number) {
  if (rows.length !== expected) {
    fail(`${label} count is ${rows.length}, expected ${expected}`);
  }
}

function failOnDuplicates(label: string, rows: CsvRecord[], field: string) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const value = required(row, field);
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  if (duplicates.size > 0) {
    fail(`Duplicate ${label}(s): ${[...duplicates].join(", ")}`);
  }
}

function fail(message: string): never {
  throw new Error(`[content-db import] ${message}`);
}

function cityTs(cities: unknown): string {
  return `${fileHeader()}import type { CityId } from "../types";

export type City = {
  id: CityId;
  name: string;
  nameZh: string;
  intro: string;
  bestMonths: number[];
  timezone: string;
  airportCode: string;
  lat: number;
  lng: number;
  tags: string[];
};

export const cities = ${json(cities)} satisfies Record<CityId, City>;
`;
}

function dataTs(
  typeName: string,
  exportName: string,
  data: unknown,
  satisfiesType: string,
): string {
  return `${fileHeader()}import type { ${typeName} } from "../types";

export const ${exportName} = ${json(data)} satisfies ${satisfiesType};
`;
}

function poiConnectionTs(data: unknown): string {
  return `${fileHeader()}export type PoiConnection = {
  from: string;
  to: string;
  mode: string;
  duration: number;
  distanceKm: number | null;
  notes: string;
};

export const poiConnections = ${json(data)} satisfies PoiConnection[];
`;
}

function fileHeader(): string {
  return "// Auto-generated by scripts/import-content-db.ts. Do not edit by hand.\n";
}

function json(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

async function writeTs(fileName: string, contents: string) {
  const outputPath = resolve(GENERATED_TS_DIR, fileName);
  const prettierConfig = (await resolveConfig(outputPath)) ?? {};
  const formatted = await format(contents, {
    ...prettierConfig,
    filepath: outputPath,
    parser: "typescript",
  });
  await writeFile(outputPath, formatted, "utf8");
}

async function writeJson(fileName: string, data: unknown) {
  await writeFile(resolve(AGENT_DATA_DIR, fileName), `${json(data)}\n`, "utf8");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
