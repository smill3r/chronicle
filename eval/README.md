# Chronicle gold evaluation set

The ground truth the v2 pipeline is measured against. Schema:
[`docs/pipeline-v2/gold_event.schema.json`](../docs/pipeline-v2/gold_event.schema.json).

- `gold_draft.jsonl` — machine format, **draft, not yet verified**.
- `gold_review.csv` — open this in a spreadsheet to review.

Regenerate the draft any time with `cd scraper && node build-gold-set.js`
(deterministic — the sample is stable across runs).

## How to review (≈2–4 hours)

Rows are sorted **hardest-first**: multi-date bullets, then non-event ("junk")
rows, then the rest. The date labels are drafted by the tested deterministic
resolver, so most single-date rows are correct and just need a quick glance.

For each row, fill the blank columns:

| Column | What to do |
|---|---|
| `date_ok? (y/n)` | Does `proposed_year` match the date the event **occurred**? |
| `corrected_year` | If not, the right signed year (negative = BC) |
| `corrected_categories` | Fix `proposed_categories` (these are best-effort copies — verify all) |
| `notes` | Anything ambiguous |

### Where to focus

1. **`multi_date = TRUE` rows (the grounding slice).** Confirm the anchor is when
   the event *happened*, not just a date mentioned. This is the Ussher lesson:
   "1650 … creation as 4004 BC" must anchor to **1650**, not 4004 BC.
2. **`referenced_years` is the noisiest field** — the extractor can mistake a
   non-date number for a year (e.g. "300 Spartan soldiers" → `-300`). Strike those.
3. **`is_event = FALSE` rows** — confirm they're genuinely non-events (stray
   See-also / reference lines). These score the junk filter.
4. **BC/AD boundary** (ancient history especially) — bare numbers are ambiguous;
   verify the era.

When you're done, hand the CSV back and I'll fold the corrections into
`gold_draft.jsonl`, set `labeler` to your name, and promote it to the verified
gold set the eval harness runs against.

## Coverage

259 bullets, stratified across the 9 substantive timelines (the 4 near-empty
articles — Ottoman, Space Race, Roman history, WWI — have too few scraped bullets
to sample meaningfully and are excluded). 98 multi-date, 60 BC, 15 junk.
