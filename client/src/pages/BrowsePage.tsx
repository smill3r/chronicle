import { useEffect, CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTimelinesStore, useSortedTimelines } from '../store/useTimelinesStore';
import type { Timeline } from '../types';
import { CATEGORY_COLORS } from '../types';
import { formatYear } from '../utils/formatYear';
import styles from './BrowsePage.module.scss';

type SortKey = 'events' | 'era' | 'title';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'events', label: 'Most events' },
  { key: 'era',    label: 'Oldest era'  },
  { key: 'title',  label: 'A – Z'       },
];

// ── Sub-components ────────────────────────────────────────────────────────────

/** Thin color accent bar keyed to the timeline's primary category. */
function CatBar({ categories }: { categories: string[] }) {
  const color = CATEGORY_COLORS[categories[0]]?.dot ?? '#ccc';
  return <div className={styles.catBar} style={{ background: color }} />;
}

/** Category pill badges. */
function CatPills({ categories, max = 2 }: { categories: string[]; max?: number }) {
  return (
    <div className={styles.pills}>
      {categories.slice(0, max).map((cat) => (
        <span
          key={cat}
          className={styles.pill}
          style={{
            background: CATEGORY_COLORS[cat]?.bg ?? '#f0f0f0',
            color:      CATEGORY_COLORS[cat]?.text ?? '#444',
          }}
        >
          {cat}
        </span>
      ))}
    </div>
  );
}

/**
 * Year range + event count. The event count is a standalone `<span>` so tests
 * can target it with `getByText('120 events')`.
 */
function CardMeta({ timeline }: { timeline: Timeline }) {
  return (
    <div className={styles.meta}>
      <span className={styles.metaRange}>
        {formatYear(timeline.yearStart)} – {formatYear(timeline.yearEnd)}
      </span>
      <span className={styles.metaSep} aria-hidden="true">·</span>
      <span className={styles.metaCount}>
        {timeline.eventCount.toLocaleString()} events
      </span>
    </div>
  );
}

/** Hero image or category-tinted fallback. */
function TimelineImage({ timeline, className }: { timeline: Timeline; className: string }) {
  const bg = CATEGORY_COLORS[timeline.categories[0]]?.bg ?? '#e8e8e8';
  if (timeline.heroImage) {
    return <img src={timeline.heroImage} alt="" className={className} />;
  }
  return <div className={className} style={{ background: bg }} />;
}

// ── Card tiers ────────────────────────────────────────────────────────────────

/**
 * Featured lead: the most prominent slot. Two-column: large text left,
 * tall image right. Gets the biggest title on the page.
 */
function LeadCard({ timeline }: { timeline: Timeline }) {
  return (
    <Link
      to={`/timelines/${timeline.slug}`}
      className={styles.lead}
      style={{ '--delay': '0ms' } as CSSProperties}
    >
      <div className={styles.leadText}>
        <CatBar categories={timeline.categories} />
        <CardMeta timeline={timeline} />
        <h2 className={styles.leadTitle}>{timeline.title}</h2>
        {timeline.description && (
          <p className={styles.leadDesc}>{timeline.description}</p>
        )}
        <CatPills categories={timeline.categories} />
      </div>
      <div className={styles.leadImageWrap}>
        <TimelineImage timeline={timeline} className={styles.leadImg} />
      </div>
    </Link>
  );
}

/**
 * Standard card used in the main grid (2-column then 3-column rows).
 * Image on top, generous text below.
 */
function GridCard({ timeline, index }: { timeline: Timeline; index: number }) {
  return (
    <Link
      to={`/timelines/${timeline.slug}`}
      className={styles.gridCard}
      style={{ '--delay': `${(index + 1) * 70}ms` } as CSSProperties}
    >
      <div className={styles.gridImageWrap}>
        <TimelineImage timeline={timeline} className={styles.gridImg} />
      </div>
      <div className={styles.gridBody}>
        <CatBar categories={timeline.categories} />
        <CardMeta timeline={timeline} />
        <h3 className={styles.gridTitle}>{timeline.title}</h3>
        {timeline.tagline && (
          <p className={styles.gridDeck}>{timeline.tagline}</p>
        )}
        <CatPills categories={timeline.categories} />
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * Editorial browse page with generous negative space.
 *
 * Layout:
 *  1. **Masthead** — wordmark, tagline, stats, "Surprise me" CTA.
 *  2. **Lead** — first timeline, full-width with image, large serif title.
 *  3. **Grid** — all remaining timelines in a responsive 2→3 column grid,
 *     each with image + text, ample internal padding and generous column gap.
 *
 * All cards animate in with staggered `fadeInUp` via `--delay` CSS custom property.
 */
export default function BrowsePage() {
  const { status, error, fetch, sortBy, setSortBy } = useTimelinesStore();
  const sorted = useSortedTimelines();

  useEffect(() => { fetch(); }, [fetch]);

  if (status === 'loading' || status === 'idle') {
    return <div className={styles.state}>Loading timelines…</div>;
  }
  if (status === 'error') {
    return <div className={styles.state}>Error: {error}</div>;
  }

  const [lead, ...gridItems] = sorted;

  const totalEvents = sorted.reduce((s, t) => s + t.eventCount, 0);

  return (
    <main className={styles.page}>

      {/* ── Masthead ── */}
      <header className={styles.masthead}>
        <div className={styles.mastheadLeft}>
          <p className={styles.eyebrow}>An open history project</p>
          <h1 className={styles.wordmark}>Chronicle</h1>
          <p className={styles.tagline}>
            Explore structured historical timelines drawn from Wikidata —
            conflicts, political turns, scientific breakthroughs, and the
            moments that reshaped the world.
          </p>
          <div className={styles.mastheadStats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{sorted.length}</span>
              <span className={styles.statLabel}>timelines</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{totalEvents.toLocaleString()}</span>
              <span className={styles.statLabel}>events</span>
            </div>
          </div>
        </div>
        <div className={styles.mastheadRight}>
          <Link to="/discover" className={styles.discoverCta}>
            <span className="ti ti-sparkles" aria-hidden="true" /> Surprise me
          </Link>
        </div>
      </header>

      {/* ── Sort controls ── */}
      <div className={styles.controls}>
        <span className={styles.controlsLabel}>Browse timelines</span>
        <div className={styles.sortGroup} role="group" aria-label="Sort timelines">
          {SORT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              className={`${styles.sortBtn} ${sortBy === key ? styles.sortActive : ''}`}
              onClick={() => setSortBy(key)}
              aria-pressed={sortBy === key}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        {/* ── Lead ── */}
        {lead && <LeadCard timeline={lead} />}

        {/* ── Main grid ── */}
        {gridItems.length > 0 && (
          <div className={styles.grid}>
            {gridItems.map((t, i) => (
              <GridCard key={t._id} timeline={t} index={i} />
            ))}
          </div>
        )}


      </div>
    </main>
  );
}
