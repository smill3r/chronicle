# Chronicle Scraper

Wikipedia "Timeline of…" → MongoDB ETL pipeline.

## Prerequisites

- Node.js 18+
- MongoDB running locally (default: `mongodb://localhost:27017/chronicle`)
- [Ollama](https://ollama.com) installed with a model pulled:
  ```bash
  ollama pull llama3.1       # recommended
  # or
  ollama pull llama3.2:3b    # faster, lower quality
  ```

## Setup

```bash
npm install
```

Update `config.js` — set your email in the `userAgent` field (required by Wikipedia's API policy).

## Running

```bash
# Recommended first run: validate the pipeline on 5 seed articles only
node index.js fetch --seed-only
node index.js parse
node index.js normalize

# Full pipeline from scratch
node index.js

# Resume from a specific stage (e.g. after a crash in Stage 3)
node index.js parse

# Run only discovery
node index.js discover
```

## Pipeline stages

| Stage | File | What it does |
|---|---|---|
| `discover` | `stages/discover.js` | Finds all "Timeline of…" titles via Wikipedia search + category walk |
| `fetch` | `stages/fetch.js` | Downloads & caches wikitext for each title |
| `parse` | `stages/parse.js` | Extracts raw event lines from wikitext (cheerio fallback for tables) |
| `normalize` | `stages/normalize.js` | Sends lines to Ollama, saves structured events to MongoDB |

All stages are **idempotent** — safe to re-run. The crawl queue tracks progress so the pipeline resumes where it left off.

## MongoDB collections

| Collection | Purpose |
|---|---|
| `crawlqueues` | Pipeline status per article title |
| `crawlcaches` | Raw wikitext/HTML cache |
| `parsedlines` | Raw extracted event lines (Ollama input) |
| `events` | Final normalized historical events (API output) |

## Troubleshooting

**HTTP 429 from Wikipedia** — Wikipedia is rate-limiting you. The scraper will back off automatically. If it keeps happening, increase `config.wikipedia.delayMs`.

**Ollama HTTP 503** — The Ollama queue is full. Reduce `config.ollama.concurrency` to `1`.

**Too few events extracted** — Check `parsedlines` where `status: "failed"` for problematic lines. Improving the few-shot examples in `prompts/extractEvents.js` usually helps.

**Hub pages not expanding** — Some hub page heuristics may need tuning. Check `crawlqueues` where `type: "hub"` and `status: "skipped"`.
