/**
 * Export TypeScript data files to JSON for the Python agent.
 * Run with: bun run scripts/export-data.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { pois } from "../src/data/pois";
import { cities } from "../src/data/cities";
import { constraints } from "../src/data/constraints";
import { poiConnections } from "../src/data/poiConnections";

const OUT = "./agent/data";
mkdirSync(OUT, { recursive: true });

writeFileSync(`${OUT}/pois.json`, JSON.stringify(pois, null, 2));
writeFileSync(`${OUT}/cities.json`, JSON.stringify(cities, null, 2));
writeFileSync(`${OUT}/constraints.json`, JSON.stringify(constraints, null, 2));
writeFileSync(`${OUT}/poi_connections.json`, JSON.stringify(poiConnections, null, 2));

console.log(`✅  Exported to ${OUT}/`);
console.log(`   pois.json          – ${Object.keys(pois).length} POIs`);
console.log(`   cities.json        – ${Object.keys(cities).length} cities`);
console.log(`   constraints.json   – ${(constraints as any[]).length} constraints`);
console.log(`   poi_connections.json – ${(poiConnections as any[]).length} connections`);
