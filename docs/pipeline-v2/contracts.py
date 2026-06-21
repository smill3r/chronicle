"""
Chronicle Pipeline v2 — data contracts (illustrative sketch).

Every stage boundary validates against one of these models. A stage rejects
malformed input instead of silently propagating it, and emits per-field
confidence so the validation gate can quarantine low-confidence records rather
than shipping them to users.

These are deliberately small and explicit — the point is that the *shape* of the
data is enforced and versioned, not inferred. Not wired into anything yet; this
is the target contract surface for Phase 1.
"""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

CATEGORIES = (
    "War", "Politics", "Science", "Religion", "Art & Culture", "Exploration",
    "Economics", "Law", "Philosophy", "Technology", "Natural Event", "Society",
)

# A generous bound on "real" historical years: deep prehistory to near-future.
MIN_YEAR = -4_000_000
MAX_YEAR = date.today().year + 1


class DatePrecision(str, Enum):
    year = "year"
    month = "month"
    day = "day"
    circa = "circa"
    range = "range"
    unknown = "unknown"


class Provenance(BaseModel):
    """Lineage — every record traces back to an exact source revision."""

    article_title: str
    revision_id: int          # frozen Wikipedia revision; makes runs reproducible
    section_path: list[str]   # ancestor headings, e.g. ["17th century"]
    bullet_index: int         # position within the section


# ── Stage 1: segment ────────────────────────────────────────────────────────

class Bullet(BaseModel):
    """One raw event line plus the structural context the grounder needs."""

    text: str = Field(min_length=1)
    section_path: list[str]
    is_event_section: bool    # False for See also / References / Bibliography / …
    wikilinks: list[str]      # extracted [[targets]] in document order
    provenance: Provenance


# ── Stage 2: temporal-tag ───────────────────────────────────────────────────

class TimexSpan(BaseModel):
    """A single temporal expression found in the bullet (TIMEX3-style)."""

    surface: str                       # the literal text, e.g. "October 23, 4004 BC"
    start: int                         # char offset in the bullet
    end: int
    year: int                          # signed; negative = BC
    precision: DatePrecision
    is_leading: bool                   # appears at the start of the bullet
    from_heading: bool                 # came from the ancestor heading, not the line

    @field_validator("year")
    @classmethod
    def _plausible(cls, v: int) -> int:
        if not (MIN_YEAR <= v <= MAX_YEAR):
            raise ValueError(f"year {v} outside plausible range")
        return v


class TaggedBullet(BaseModel):
    bullet: Bullet
    timex: list[TimexSpan]


# ── Stage 3: ground-event-time ──────────────────────────────────────────────

class GroundedDate(BaseModel):
    """The chosen event anchor, plus the alternatives we did NOT pick."""

    year: int
    display: str
    precision: DatePrecision
    referenced_years: list[int] = []   # other dates in the text (e.g. -4004 for Ussher)
    method: Literal["leading", "heading", "model", "judge"]
    confidence: float = Field(ge=0.0, le=1.0)


# ── Stage 4: categorize / link / describe ───────────────────────────────────

class FieldConf(BaseModel):
    category_conf: float = Field(ge=0.0, le=1.0)
    link_conf: float = Field(ge=0.0, le=1.0)
    date_conf: float = Field(ge=0.0, le=1.0)


# ── Final: the candidate event handed to the validation gate ─────────────────

class CandidateEvent(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""
    year: int
    year_display: str = Field(min_length=1)
    date_precision: DatePrecision
    referenced_years: list[int] = []
    categories: list[str] = []
    wiki_link: str = ""
    confidence: FieldConf
    provenance: Provenance

    @field_validator("categories")
    @classmethod
    def _known_categories(cls, v: list[str]) -> list[str]:
        bad = [c for c in v if c not in CATEGORIES]
        if bad:
            raise ValueError(f"unknown categories: {bad}")
        return v

    @model_validator(mode="after")
    def _bc_consistency(self) -> "CandidateEvent":
        # display and signed year must agree on era
        says_bc = "BC" in self.year_display.upper()
        if says_bc and self.year > 0:
            raise ValueError("year_display says BC but year is positive")
        return self


def passes_gate(ev: CandidateEvent, *, min_conf: float = 0.6) -> bool:
    """
    The quarantine rule. Anything that fails goes to a review table, NOT to the
    serving collection. The Ussher record fails here (low date_conf from a
    multi-date sentence) and is quarantined instead of shipped.
    """
    if not ev.provenance.section_path or not ev.provenance.revision_id:
        return False
    if ev.confidence.date_conf < min_conf:
        return False
    return True
