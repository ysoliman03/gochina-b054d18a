# GoChina

A mobile-first trip-planning app for travel in China. Travelers get an
AI-generated, day-by-day itinerary grounded in a real local dataset (POIs,
cuisine, transit times, travel constraints), can edit it by hand (swap,
move, add stops, pin exact times), and see live warnings when a plan
conflicts with real opening hours, closures, or crowd/holiday windows.

## Architecture

Two parts, developed and run independently:

| | Stack | Where |
|---|---|---|
| **Frontend** | React + TanStack Start, Vite, Tailwind/shadcn, Zustand, Supabase (auth + sync), Gaode/Amap (maps) | `src/` |
| **Agent** | Python, Pydantic AI, FastAPI, Claude Haiku 4.5, Langfuse (observability) | `agent/` |

The frontend calls the agent's `POST /generate-itinerary` endpoint to create
an itinerary, then owns all further editing itself — swapping/moving/pinning
stops, re-scoring against the dataset, and flagging issues are all done
client-side without another agent call (see `src/engine/`).

Both sides read from the **same source dataset** (`content-db/*.csv`),
exported once into two generated forms — see [Data pipeline](#data-pipeline)
below.

For a deep dive into the agent specifically — its tools, prompt design, the
deterministic repair layer, and the prompt-injection defense — see
[`agent/README.md`](agent/README.md) and, if you're new to Pydantic AI,
[`agent/LEARN.md`](agent/LEARN.md).

## Project structure

```
src/
  routes/          ← pages (itinerary, explore, guides, onboarding, profile, …)
  components/      ← UI components (map, itinerary builder, issue panel, …)
  engine/          ← itinerary scheduling, issue detection, constraints, hotel-base logic
  store/           ← Zustand app state (trip, profile, itinerary, saved POIs)
  lib/             ← Supabase sync, Gaode links/distance, misc utilities
  data/            ← static + generated data (types, countries, district profiles)

agent/             ← Python itinerary-generation service — see agent/README.md

content-db/        ← source-of-truth CSVs (POIs, cuisine, transit, constraints, …)
scripts/           ← content-db/*.csv → src/data/generated/*.ts + agent/data/*.json
supabase/          ← database migrations
k8s/                ← Kubernetes manifests for deploying the agent
```

## Getting started

### Prerequisites
- Node.js + npm (or bun — both `bun.lock` and `package-lock.json` are present)
- Python 3.12+ (for the agent)

### 1 — Install frontend dependencies
```bash
npm install
```

### 2 — Export the dataset
Generates `src/data/generated/*.ts` and `agent/data/*.json` from
`content-db/*.csv`. Required before running either the frontend or the
agent for the first time, and after any change to `content-db/`.
```bash
npm run export:data
```

### 3 — Configure environment variables
```bash
cp .env.example .env
```
The frontend expects (Supabase project + Gaode maps):
```
SUPABASE_PROJECT_ID=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
VITE_GAODE_API_KEY=
VITE_GAODE_SECURITY_KEY=
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
```
`.env` is gitignored — never commit real keys.

### 4 — Set up and run the agent (separate terminal)
```bash
cd agent
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           # then add your ANTHROPIC_API_KEY
uvicorn server:app --reload --port 8787
```
Full details, API reference, and how to switch LLM providers:
[`agent/README.md`](agent/README.md).

### 5 — Run the frontend
```bash
npm run dev
```
Open the printed local URL, go to **Itinerary → AI Plan**.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview a production build locally |
| `npm run lint` | ESLint over the whole project |
| `npm run format` | Prettier — write mode |
| `npm run export:data` | Re-generate `src/data/generated/` and `agent/data/` from `content-db/` |

## Data pipeline

`content-db/*.csv` is the single source of truth for all trip content —
Cities, POIs, Cuisine, Transportation hubs, City/POI connections, and Travel
constraints. `scripts/import-content-db.ts` (`npm run export:data`) parses
and validates it (expected row counts, required columns), then writes:
- `src/data/generated/*.ts` — typed, frontend-ready
- `agent/data/*.json` — for the Python agent's tools

Never hand-edit files in either generated folder — edit the CSVs and re-run
the export instead.

## Testing

```bash
# Agent unit tests
cd agent && python -m unittest test_itinerary_repair -v

# Agent prompt-injection / quality eval (20 prompts, needs a running server)
cd agent && uvicorn server:app --port 8787 &
python eval_20.py
```

## Deployment

- **Frontend** — Cloudflare Workers via Wrangler (`wrangler.jsonc`); secrets go
  through `.dev.vars` / Cloudflare's secret store, not `.env`.
- **Agent** — containerized (`agent/Dockerfile`, port 8787) and deployed via
  the manifests in `k8s/` (`gochina-agent` Deployment + Service + HPA). Env
  vars come from a `gochina-agent-secrets` Kubernetes Secret — see
  `k8s/secret.yaml` (gitignored; create your own from your `.env`).

## Further reading

- [`agent/README.md`](agent/README.md) — agent setup, API reference, switching LLM providers
- [`agent/LEARN.md`](agent/LEARN.md) — Pydantic AI concepts, taught using this project's own code
