# GoChina — Itinerary Agent

> **New to Pydantic AI?** Start with [`LEARN.md`](LEARN.md) — it walks through
> every concept using this project's code as the example.

---

## File map

```
agent/
  LEARN.md              ← 📖 Start here — Pydantic AI tutorial
  models.py             ← Step 1: data shapes (Pydantic models)
  data.py                ← Step 2: load the travel database
  tools.py               ← Step 3: functions the AI can call
  agent.py               ← Step 4: ⭐ the Pydantic AI agent (core file)
  prompting.py           ← builds the sanitized user prompt sent to the agent
  guardrails.py          ← prompt-injection defense (input sanitize + output guard)
  itinerary_repair.py    ← deterministic post-processing (real hours/transit/dates)
  server.py               ← Step 5: FastAPI server that exposes the agent
  test_itinerary_repair.py ← unit tests for itinerary_repair.py
  eval_20.py              ← 20-prompt eval harness (benign + injection attempts)
  requirements.txt
  .env.example
  data/                   ← auto-generated JSON (run export:data to create)
```

---

## Quick start

### 1 — Export data (run once from the project root)

```bash
npm run export:data
```

Re-run whenever you change files in `content-db/`.

### 2 — Create your `.env`

```bash
cp agent/.env.example agent/.env
```

Edit `agent/.env` and add your Anthropic API key.  
Get one at **https://console.anthropic.com** (~$0.001 per generated itinerary with Claude Haiku).

### 3 — Install Python dependencies

```bash
cd agent
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 4 — Start the agent server

```bash
uvicorn server:app --reload --port 8787
```

The API is live at **http://localhost:8787**

- Interactive docs: **http://localhost:8787/docs**
- Health check:    **http://localhost:8787/health**

### 5 — Start the frontend (separate terminal)

```bash
# from the project root
npm run dev        # or: bun dev
```

Open **http://localhost:5173**, go to **Itinerary → AI Plan**.

---

## Switching LLM providers

Edit the `model = ...` line at the top of `agent.py` (see the commented
alternatives right above it):

| Provider | Install extra | Model string | Env var |
|---|---|---|---|
| **Anthropic** (default) | `pydantic-ai[anthropic]` | `claude-haiku-4-5-20251001` | `ANTHROPIC_API_KEY` |
| Groq (free tier) | `pydantic-ai[groq]` | `llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| Ollama (fully local) | `pydantic-ai[openai]` | e.g. `gemma3:12b-highctx` | none |
| OpenAI | `pydantic-ai[openai]` | `gpt-4o-mini` | `OPENAI_API_KEY` |

---

## API reference

### `POST /generate-itinerary`

```json
{
  "cityId": "BJ",
  "startDate": "2026-07-01",
  "endDate": "2026-07-03",
  "profile": {
    "groupType": "couple",
    "pace": "moderate",
    "budget": "mid",
    "interests": ["historical", "food"],
    "dietaryRestrictions": []
  },
  "notes": "We love street food and want to avoid tourist traps."
}
```

`days` is derived automatically from `startDate`/`endDate` (inclusive, capped at
14) — it's a read-only computed field, not something you send.

Returns an `ItineraryResult` — days with stops, a summary, and practical tips.
