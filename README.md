# Chronicle

An interactive history timeline browser. Explore curated historical timelines as a
vertical, zoomable timeline of events — filterable by category and year range, with
Wikipedia context and imagery on every event.

**Stack:** Node.js · MongoDB · NestJS · React (Vite + TypeScript + Sass)
**Data source:** [Wikidata](https://www.wikidata.org) (structured), enriched with the Wikipedia REST API.

---

## What it looks like

- **Browse** — an editorial grid of timelines, plus a "Surprise me" entry into Discover.
- **Discover** — a one-event-at-a-time, image-forward card you can shuffle with a button or the keyboard (`→` / `Space`).
- **Timeline** — a vertical timeline rail (continuous line, category-colored dots, era chapter nodes) with an editorial "about this topic" lead, a drag-to-filter mini-map, category filters, and a detail panel that pulls the event's Wikipedia summary + image on demand.

---

## Architecture

```
chronicle/
├── scraper/   # Data loader — queries Wikidata, writes MongoDB (events + timelines)
├── api/       # NestJS REST API — serves events & timelines to the client
└── client/    # Vite + React frontend
```

Data flows one way: **Wikidata → `scraper/wikidata-import.js` → MongoDB → API → client.**
The API never writes to the data collections (except a lazy Wikipedia-summary cache on events).

### Why Wikidata

Earlier versions scraped Wikipedia "Timeline of…" prose and normalized it with a local
LLM. That path was error-prone (notably temporal grounding — e.g. dating Ussher's *1650*
calculation to *4004 BC*). Wikidata provides the same events as **structured data**: typed
dates with precision, categories (via `instance of`), locations, and canonical Wikipedia
links — no LLM, no date heuristics, no junk filtering. See `CLAUDE.md` for the full rationale.

---

## Quick start

Prerequisites: **Node.js 18+** and **MongoDB** running locally
(`mongodb://localhost:27017/chronicle`).

```bash
# 1. Load the data (queries Wikidata, ~1.8k events across 6 topics)
cd scraper && npm install && npm run import

# 2. Start the API (http://localhost:3000)
cd ../api && npm install && npm run start:dev

# 3. Start the client (http://localhost:5173)
cd ../client && npm install && npm run dev
```

Set your contact email in `scraper/config.js` (`userAgent`) before importing — both the
Wikidata Query Service and the Wikipedia API ask for one.

---

## Adding a timeline

Each timeline is a "scoping recipe" in `scraper/wikidata-import.js`'s `TOPICS` map: a root
Wikidata entity (e.g. World War I = `Q361`) whose events are pulled via the `part of`
property. To add one:

1. Find the root entity's Q-id on wikidata.org.
2. Add an entry to `TOPICS` (`qid`, `sourceArticle`, `sourceUrl`, `defaultCategory`).
3. `node wikidata-import.js <slug>` to dry-run (preview coverage), then
   `node wikidata-import.js --commit <slug>` to load it and rebuild the timelines metadata.

---

## Tests

```bash
cd api && npm test        # Jest — service + controller
cd client && npm test     # Vitest — components + utils
```
