# GoChina — Itinerary Agent

> **New to Pydantic AI?** Start with [`LEARN.md`](LEARN.md) — it walks through
> every concept using this project's code as the example.

---

## File map

```
agent/
  LEARN.md       ← 📖 Start here — Pydantic AI tutorial
  models.py      ← Step 1: data shapes (Pydantic models)
  data.py        ← Step 2: load the travel database
  tools.py       ← Step 3: functions the AI can call
  agent.py       ← Step 4: ⭐ the Pydantic AI agent (core file)
  server.py      ← Step 5: FastAPI server that exposes the agent
  requirements.txt
  .env.example
  data/          ← auto-generated JSON (run export:data to create)
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

Edit `agent/.env` and add your Gemini API key.  
Get one free at **https://aistudio.google.com/apikey** (takes ~1 minute, no credit card).

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

Edit the two highlighted lines at the top of `agent.py`:

| Provider | Install extra | Model string | Env var |
|---|---|---|---|
| **Google Gemini** (default) | `pydantic-ai[google]` | `gemini-2.0-flash` | `GEMINI_API_KEY` |
| OpenAI | `pydantic-ai[openai]` | `gpt-4o-mini` | `OPENAI_API_KEY` |
| Anthropic | `pydantic-ai[anthropic]` | `claude-haiku-4-5-20251001` | `ANTHROPIC_API_KEY` |

---

## API reference

### `POST /generate-itinerary`

```json
{
  "cityId": "BJ",
  "days": 3,
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

Returns an `ItineraryResult` — days with stops, a summary, and practical tips.
