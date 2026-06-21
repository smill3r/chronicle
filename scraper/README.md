# Chronicle data loader

Wikidata → MongoDB. One script (`wikidata-import.js`) loads structured historical events
and rebuilds the timelines metadata. (The directory is named `scraper/` for historical
reasons — the old Wikipedia-scraping pipeline lived here; it has been removed.)

## Prerequisites

- Node.js 18+
- MongoDB running locally (default: `mongodb://localhost:27017/chronicle`)

## Setup

```bash
npm install
```

Set your contact email in `config.js` (`userAgent`) — both the Wikidata Query Service and
the Wikipedia API ask for one.

## Running

```bash
# Load every configured topic into `events` and rebuild `timelines`
npm run import                              # = node wikidata-import.js --commit --all

# Dry-run a single topic (query + report, no write)
node wikidata-import.js world-war-i

# Load a single topic
node wikidata-import.js --commit cold-war

# Rebuild only the timelines collection (counts + topic descriptions) from existing events
node wikidata-import.js --rebuild
```

The loader is idempotent — it upserts events by `wikidataId` and recreates the indexes the
API relies on. A dry run is the default; `--commit` is required to write.

## Adding a timeline

Add an entry to the `TOPICS` map in `wikidata-import.js`:

```js
'mexican-war-of-independence': {
  qid: 'Q68750',                 // root Wikidata entity (events are pulled via `part of`)
  sourceArticle: 'Timeline of the Mexican War of Independence',
  sourceUrl: 'https://en.wikipedia.org/wiki/Mexican_War_of_Independence',
  defaultCategory: 'War',        // fallback when an event's `instance of` doesn't map
}
```

Then dry-run it to preview coverage, and `--commit` it once it looks right. Wikidata covers
conflict/political topics well via `part of`; period and social-history topics are sparse
and may return little.

## MongoDB collections

| Collection | Purpose |
|---|---|
| `events` | Historical events (API output) |
| `timelines` | One per topic — browse list, slug→title resolution, "about this topic" enrichment |

## Tests

```bash
npm test    # node --test — covers utils/resolveDate.js (a retained date utility)
```

## Troubleshooting

**WDQS timeout / 429** — the Wikidata Query Service is busy or rate-limiting. Re-run; the
query is read-only and idempotent.

**A topic returns 0 events** — the root Q-id is likely wrong, or the topic isn't modeled
with `part of` in Wikidata. Verify the Q-id on wikidata.org and dry-run again.

**An event shows a `Q…` id as its title** — that item has no English label; the loader
already filters these out, so re-run the import (or `--rebuild`) to clean up.
