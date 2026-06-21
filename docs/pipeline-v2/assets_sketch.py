"""
Chronicle Pipeline v2 — Phase 1 Dagster asset graph (illustrative sketch).

This is a design sketch, not runnable code. It shows how the v1 stages map onto
Dagster assets with:
  - typed IO via the contracts in contracts.py
  - asset checks acting as the validation gates
  - confidence-based quarantine (low-confidence records never reach serving)
  - lineage to the source revision

Phase 1 deliberately uses NO custom-trained models: a rule-based temporal tagger,
the structural grounding prior, deterministic wikilink extraction, and the
existing 12-label classifier. That alone fixes Ussher, year:0, and empty
wikiLinks — measurably, against the gold set.

Run model (once built):  dagster dev  →  materialize the `events` asset.
"""

from __future__ import annotations

from dagster import (
    AssetCheckResult,
    AssetExecutionContext,
    Output,
    asset,
    asset_check,
)

# from .contracts import Bullet, TaggedBullet, CandidateEvent, passes_gate
# from .grounding import ground_anchor          # structural prior + (Phase 3) model
# from .temporal import tag_timex               # HeidelTime / SUTime / Duckling wrapper
# from .classify import categorize              # encoder classifier or embeddings+LR


@asset
def timeline_titles(context: AssetExecutionContext) -> list[str]:
    """Discover 'Timeline of…' article titles (search + category walk)."""
    ...


@asset
def raw_articles(timeline_titles: list[str]) -> dict[str, dict]:
    """
    Fetch wikitext, keyed by title. Cache by revision id so re-runs are
    incremental and reproducible. Each value carries {wikitext, revision_id}.
    """
    ...


@asset
def bullets(raw_articles: dict[str, dict]) -> list["Bullet"]:
    """
    Structure-aware segmentation: walk the wikitext AST, emit one Bullet per
    list item with its full section_path, the is_event_section flag (False for
    References / See also / …), and deterministically extracted [[wikilinks]].
    """
    ...


@asset_check(asset=bullets)
def no_reference_section_bullets(bullets: list["Bullet"]) -> AssetCheckResult:
    """Gate: bullets from non-event sections must be dropped upstream."""
    bad = [b for b in bullets if not b.is_event_section]
    return AssetCheckResult(passed=len(bad) == 0, metadata={"leaked": len(bad)})


@asset
def tagged_bullets(bullets: list["Bullet"]) -> list["TaggedBullet"]:
    """
    Temporal tagging: rule-based tagger emits ALL TIMEX spans per bullet, with
    is_leading / from_heading flags. No grounding yet — just extraction.
    """
    ...


@asset
def candidate_events(
    context: AssetExecutionContext,
    tagged_bullets: list["TaggedBullet"],
) -> Output[list["CandidateEvent"]]:
    """
    For each bullet:
      - ground the event anchor (structural prior: leading date / heading date),
        recording the other dates as referenced_years and a date confidence;
      - categorize (classifier) and attach wikilink (deterministic);
      - emit a CandidateEvent with per-field confidence.

    The Ussher bullet yields year=1650 (leading token), referenced_years=[-4004],
    method="leading", with a lowered confidence because >1 TIMEX was present.
    """
    events: list = []  # [ground + categorize + link each bullet]
    multi_date = sum(1 for tb in tagged_bullets if len(tb.timex) > 1)
    return Output(events, metadata={"multi_date_bullets": multi_date})


@asset
def events(
    context: AssetExecutionContext,
    candidate_events: list["CandidateEvent"],
) -> Output[list["CandidateEvent"]]:
    """
    Validation gate. Records passing `passes_gate` load to the serving store;
    the rest are written to a quarantine table for review. Returns the passing
    set; surfaces the quarantine count as run metadata.
    """
    passed = [e for e in candidate_events]      # [e for e in ... if passes_gate(e)]
    quarantined = len(candidate_events) - len(passed)
    # load(passed) -> mongo ; write_quarantine(rest)
    return Output(passed, metadata={"loaded": len(passed), "quarantined": quarantined})


@asset
def timelines(events: list["CandidateEvent"]) -> None:
    """Rebuild the per-article aggregates the browse screen reads."""
    ...


@asset
def eval_report(context: AssetExecutionContext, events: list["CandidateEvent"]) -> dict:
    """
    Join the loaded events against the gold set (gold_event.schema.json) and
    report per-field metrics: date exact-match, date within-tolerance, category
    micro-F1, wikiLink precision, and anchor accuracy on the multi-date slice.
    This asset is what makes "better" a number instead of a vibe.
    """
    ...
