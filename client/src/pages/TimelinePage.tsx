import { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Timeline, HistoricalEvent } from '../types';
import { CATEGORY_COLORS } from '../types';
import { getEraKey } from '../utils/getEraKey';
import MiniMap from '../components/MiniMap/MiniMap';
import HighlightLegend from '../components/HighlightLegend/HighlightLegend';
import EventList from '../components/EventList/EventList';
import EventDetailSheet from '../components/EventDetailSheet/EventDetailSheet';
import SearchBar from '../components/SearchBar/SearchBar';
import YearIndicator from '../components/YearIndicator/YearIndicator';
// TODO: YearNav requires a backend endpoint that returns all era labels for a
// timeline (not just the ones in the currently-loaded page) so scrollIntoView
// can target sections that haven't been loaded yet by the paginator.
// import YearNav from '../components/YearNav/YearNav';
import { useTimelinePageStore, useHasActiveFilters } from '../store/useTimelinePageStore';
import { useScrollFocus } from '../hooks/useScrollFocus';
import { useScrollYear } from '../hooks/useScrollYear';
import { formatYear } from '../utils/formatYear';
import styles from './TimelinePage.module.scss';

const PAGE_SIZE = 50;

/**
 * Three-column timeline detail page.
 *
 * Layout:
 *  - **Left** (sticky, visible on all sizes): year indicator + era navigator
 *  - **Center**: editorial intro, mini-map, legend, search, event list (dock effect)
 *  - **Right** (desktop: sticky column; mobile: full-screen sheet): EventDetailSheet
 *
 * Filter and selection state lives in `useTimelinePageStore`.
 * Event list is local async state driven by paginated API calls.
 */
export default function TimelinePage() {
  const { slug } = useParams<{ slug: string }>();

  // ── Local async state ─────────────────────────────────────────────────────
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [events, setEvents] = useState<HistoricalEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  // Incremented after first load so scroll hooks re-run their initial update.
  const [hookVersion, setHookVersion] = useState(0);

  // ── Filter + selection state (Zustand) ────────────────────────────────────
  const {
    selectedEvent,
    toggleEvent,
    setSelectedEvent,
    filters,
    setSearchInput,
    commitSearch,
    setCategory,
    setYearRange,
    clearFilters,
    reset,
  } = useTimelinePageStore();
  const { searchInput, searchQuery, category, yearRange } = filters;
  const hasActiveFilters = useHasActiveFilters();

  // ── Search debounce ───────────────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitSearch(value), 300);
  };

  // ── Scroll-driven dock effect and year indicator ──────────────────────────
  // hookVersion increments when events first land in the DOM so the hooks
  // re-run their initial update() call and find the newly rendered rows.
  const listRef = useRef<HTMLDivElement>(null);
  useScrollFocus(listRef, hookVersion);
  const scrollYear = useScrollYear(listRef, hookVersion);

  // ── Timeline span ─────────────────────────────────────────────────────────
  const span = timeline ? Math.max(timeline.yearEnd - timeline.yearStart, 1) : 1;

  // Map yearDisplay → era so YearNav can highlight the right item.
  const yearToEra = useMemo(() => {
    const map = new Map<string, string>();
    for (const ev of events) {
      if (!ev.isSynthetic && !map.has(ev.yearDisplay)) {
        map.set(ev.yearDisplay, getEraKey(ev.year, span));
      }
    }
    return map;
  }, [events, span]);

  const activeEra = yearToEra.get(scrollYear) ?? '';

  // ── Data fetching ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    reset();
    api.timelines.get(slug).then(setTimeline).catch(console.error);
  }, [slug, reset]);

  const fetchEvents = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!slug) return;
      if (append) setLoadingMore(true);
      try {
        const result = await api.timelines.events(slug, {
          q: searchQuery || undefined,
          category: category || undefined,
          yearStart: yearRange?.[0],
          yearEnd: yearRange?.[1],
          page: pageNum,
          limit: PAGE_SIZE,
        });
        setEvents((prev) => (append ? [...prev, ...result.data] : result.data));
        setTotal(result.total);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingMore(false);
        setInitialLoading(false);
      }
    },
    [slug, searchQuery, category, yearRange],
  );

  useEffect(() => {
    setInitialLoading(true);
    setPage(1);
    setSelectedEvent(null);
    fetchEvents(1, false);
  }, [fetchEvents, setSelectedEvent]);

  // Once the first page of events renders, bump hookVersion so the scroll hooks
  // re-run their initial update() and find the freshly-mounted event rows.
  useEffect(() => {
    if (!initialLoading && events.length > 0) {
      setHookVersion((v) => v + 1);
    }
  }, [initialLoading, events.length]);

  // Infinite scroll via IntersectionObserver on a sentinel at the list bottom.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && events.length < total) {
          const next = page + 1;
          setPage(next);
          fetchEvents(next, true);
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [fetchEvents, loadingMore, events.length, total, page]);

  if (!timeline) return <div className={styles.state}>Loading…</div>;

  const displayYear = scrollYear || formatYear(timeline.yearStart);

  return (
    <div className={styles.page}>

      {/* ── Compact sticky top bar ── */}
      <header className={styles.topBar}>
        <Link to="/" className={styles.back}>
          <span className="ti ti-arrow-left" aria-hidden="true" />
          All timelines
        </Link>
        <h1 className={styles.pageTitle}>{timeline.title}</h1>
        <span className={styles.eventCount}>{total.toLocaleString()} events</span>
      </header>

      <div className={styles.body}>

        {/* ── Left column: year indicator + era navigator ── */}
        {/* Shown as a sticky side column on desktop; hidden here on mobile
            (a separate mobileNav bar appears at the bottom instead). */}
        <aside className={styles.leftCol} aria-label="Current year">
          <div className={styles.yearIndicatorWrap}>
            <YearIndicator year={displayYear} />
          </div>
          {/* YearNav commented out — needs backend era-index endpoint first.
              See TODO on the import above. */}
        </aside>

        {/* ── Center column: content + event list ── */}
        <main className={styles.centerCol}>

          {(timeline.description || timeline.heroImage) && (
            <section className={styles.intro}>
              {timeline.heroImage && (
                <figure className={styles.introFigure}>
                  <img className={styles.introHero} src={timeline.heroImage} alt="" />
                </figure>
              )}
              <div className={styles.introText}>
                {timeline.tagline && (
                  <p className={styles.kicker}>{timeline.tagline}</p>
                )}
                {timeline.description && (
                  <p className={styles.introDesc}>{timeline.description}</p>
                )}
                <div className={styles.introMeta}>
                  <span>{formatYear(timeline.yearStart)} – {formatYear(timeline.yearEnd)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{timeline.eventCount.toLocaleString()} events</span>
                  {timeline.wikiLink && (
                    <a
                      className={styles.introLink}
                      href={`https://en.wikipedia.org/wiki/${encodeURIComponent(timeline.wikiLink.replace(/ /g, '_'))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="ti ti-brand-wikipedia" /> Full article
                    </a>
                  )}
                </div>
              </div>
            </section>
          )}

          <MiniMap
            events={events}
            yearStart={timeline.yearStart}
            yearEnd={timeline.yearEnd}
            activeRange={yearRange}
            onRangeChange={setYearRange}
          />

          <HighlightLegend
            categories={timeline.categories}
            highlight={category}
            onToggle={setCategory}
          />

          <div className={styles.searchRow}>
            <SearchBar value={searchInput} onChange={handleSearchChange} />
            {hasActiveFilters && (
              <div className={styles.activeFilters}>
                {category && (
                  <span
                    className={styles.filterChip}
                    style={{
                      background: CATEGORY_COLORS[category]?.bg ?? '#f0f0f0',
                      color: CATEGORY_COLORS[category]?.text ?? '#444',
                    }}
                  >
                    {category}
                    <button
                      className={styles.chipClear}
                      onClick={() => setCategory(null)}
                      aria-label={`Remove ${category} filter`}
                    >
                      <span className="ti ti-x" />
                    </button>
                  </span>
                )}
                {yearRange && (
                  <span className={styles.filterChip} style={{ background: '#e8f0fa', color: '#0c447c' }}>
                    {formatYear(yearRange[0])} – {formatYear(yearRange[1])}
                    <button
                      className={styles.chipClear}
                      onClick={() => setYearRange(null)}
                      aria-label="Remove year range filter"
                    >
                      <span className="ti ti-x" />
                    </button>
                  </span>
                )}
                <button className={styles.clearAll} onClick={clearFilters}>
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* listRef wraps EventList so scroll hooks can query [data-event-id] */}
          <div ref={listRef}>
            {initialLoading ? (
              <div className={styles.stateInline}>Loading events…</div>
            ) : (
              <EventList
                events={events}
                span={span}
                selectedEvent={selectedEvent}
                onSelect={toggleEvent}
              />
            )}
          </div>

          <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
          {loadingMore && <div className={styles.stateInline}>Loading more…</div>}
        </main>

        {/* ── Right column: event detail ── */}
        {/* Desktop: sticky column. Mobile: EventDetailSheet renders as position:fixed.
            This wrapper must stay in the DOM on all screen sizes. */}
        <div className={styles.rightCol}>
          <EventDetailSheet
            event={selectedEvent}
            slug={slug!}
            span={span}
            allEvents={events}
            onClose={() => setSelectedEvent(null)}
            onSelectRelated={toggleEvent}
          />
        </div>
      </div>

      {/* ── Mobile navigation bar ── */}
      {/* Replaces the hidden left column on small screens.
          Shows the current year and a horizontal scrollable era nav. */}
      <div className={styles.mobileNav} aria-label="Current year">
        <div className={styles.mobileYear}>
          <YearIndicator year={activeEra || formatYear(timeline.yearStart)} />
        </div>
        {/* YearNav strip commented out — needs backend era-index endpoint first. */}
      </div>
    </div>
  );
}
