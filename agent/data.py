"""
data.py — Load the travel data exported from TypeScript.
─────────────────────────────────────────────────────────
This file has nothing to do with Pydantic AI specifically.
It just reads the JSON files that were created by running:

    npx tsx scripts/export-data.ts   (from the project root)

Those JSON files are the exact same data your React app uses —
we just made Python-readable copies of them.

  data/pois.json          — 158 points of interest (attractions, restaurants, …)
  data/cities.json        — 4 cities (Beijing, Shanghai, Xi'an, Chongqing)
  data/constraints.json   — 25 travel warnings (public holidays, weather, …)
  data/poi_connections.json — transit times between POIs
"""
from __future__ import annotations
import json
from pathlib import Path

# __file__ is agent/data.py, so .parent is the agent/ folder.
_DATA_DIR = Path(__file__).parent / "data"


def _load(filename: str) -> dict | list:
    path = _DATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(
            f"\n\n  ❌  Missing: {path}\n\n"
            "  Fix: run this from the project root:\n"
            "       npx tsx scripts/export-data.ts\n"
        )
    return json.loads(path.read_text())


# These four variables are loaded once when Python first imports this file.
# Any other file that does `from data import POIS` gets the same cached object.
POIS: dict[str, dict] = _load("pois.json")            # type: ignore[assignment]
CITIES: dict[str, dict] = _load("cities.json")        # type: ignore[assignment]
CONSTRAINTS: list[dict] = _load("constraints.json")   # type: ignore[assignment]
POI_CONNECTIONS: list[dict] = _load("poi_connections.json")  # type: ignore[assignment]
