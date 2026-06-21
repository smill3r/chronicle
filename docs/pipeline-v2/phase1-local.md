# Phase 1 — local, zero-GPU scope

Phase 1 of the [v2 RFC](../pipeline-v2-rfc.md), scoped to run entirely on the
local Apple Silicon machine with **no cloud and no GPU**. Every component is
either rule-based (CPU), a small frozen model (CPU/MPS), or the already-working
local Ollama. No transformer fine-tuning in Phase 1.

## Stack (all local, $0)

| Concern | Tool | Notes |
|---|---|---|
| Date extraction | **`dateparser` + spaCy** rules (HeidelTime optional, needs JVM) | CPU, rule-based — the hardest correctness problem needs zero ML |
| Event-time grounding | structural prior (leading-date / heading-date) | CPU heuristic; reuses the logic proven in `scraper/utils/resolveDate.js` |
| Wikilink extraction | wikitext `[[link]]` parse | CPU, deterministic |
| Category classification | **`sentence-transformers` (all-MiniLM-L6-v2) + scikit-learn LogisticRegression** | embed once on CPU (~1–2 min for the corpus), train LR in seconds. **No fine-tuning.** |
| Description polish / low-conf judge | **local Ollama** (already installed) | only the small low-confidence tail |
| Orchestration | **Dagster** (`dagster dev`) | local UI, asset checks as gates, lineage |
| Staging / QA | **DuckDB + Parquet** | embedded, no server |
| Serving | **local MongoDB** | already running |
| Contracts / validation | **Pydantic** (+ Pandera for frame checks) | see `contracts.py` |

## Asset graph (Phase 1)

See [`assets_sketch.py`](assets_sketch.py). No `categorize`-via-LLM, no trained
grounding model — those are Phase 3. Phase 1 is: discover → fetch → segment →
temporal-tag → ground (structural prior) → categorize (embeddings+LR) →
link-extract → validate/quarantine → load → eval-report.

## Run plan

1. `pip install -r requirements.txt` (CPU wheels; no CUDA).
2. Materialize through `events` in Dagster; quarantine table fills with the
   low-confidence tail (multi-date / ambiguous).
3. `eval_report` joins against the verified gold set (`eval/gold_draft.jsonl`
   once reviewed) and prints per-field metrics.

## Resource notes

- The corpus is tiny (~4.5k bullets) — a full run is **minutes**.
- **RAM, not GPU, is the only constraint.** We hit Ollama KV-cache pressure in
  v1, so on an 8 GB machine don't run the embedding pass, Ollama, and MongoDB
  simultaneously — sequence them (Dagster does this naturally, one asset at a
  time). On 16 GB+ it's a non-issue.
- The category route is **embeddings + LR specifically to avoid fine-tuning**.
  Upgrading to a fine-tuned DeBERTa (Phase 3) is optional and MPS-feasible
  (tens of minutes), not required for the Phase-1 quality win.
