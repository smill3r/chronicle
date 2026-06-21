import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Timeline, HistoricalEvent } from '../types';
import { CATEGORY_COLORS } from '../types';
import MiniMap from '../components/MiniMap/MiniMap';
import HighlightLegend from '../components/HighlightLegend/HighlightLegend';
import EventList from '../components/EventList/EventList';
import EventDetailPanel from '../components/EventDetailPanel/EventDetailPanel';
import SearchBar from '../components/SearchBar/SearchBar';
import { formatYear } from '../utils/formatYear';
import styles from './TimelinePage.module.scss';

const PAGE_SIZE = 50;

export default function TimelinePage() {
  const { slug } = useParams<{ slug: string }>();
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [events, setEvents] = useState<HistoricalEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [yearRange, setYearRange] = useState<[number, number] | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    api.timelines.get(slug).then(setTimeline).catch(console.error);
  }, [slug]);

  const fetchEvents = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!slug) return;
      if (append) setLoadingMore(true);
      try {
        const result = await api.timelines.events(slug, {
          q: searchQuery || undefined,
          category: categoryFilter || undefined,
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
    [slug, searchQuery, categoryFilter, yearRange],
  );

  useEffect(() => {
    setInitialLoading(true);
    setPage(1);
    setSelectedEvent(null);
    fetchEvents(1, false);
  }, [fetchEvents]);

  // Infinite scroll via IntersectionObserver
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

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value), 300);
  };

  const handleSelectEvent = (ev: HistoricalEvent) => {
    setSelectedEvent((prev) => (prev?._id === ev._id ? null : ev));
  };

  const handleCategoryToggle = (cat: string | null) => {
    setCategoryFilter(cat);
  };

  const handleRangeChange = (range: [number, number] | null) => {
    setYearRange(range);
  };

  const clearAllFilters = () => {
    setCategoryFilter(null);
    setYearRange(null);
    setSearchInput('');
    setSearchQuery('');
  };

  const hasActiveFilters = categoryFilter !== null || yearRange !== null || searchQuery !== '';

  if (!timeline) return <div className={styles.state}>Loading…</div>;

  const span = timeline.yearEnd - timeline.yearStart;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link to="/" className={styles.back}>
            <span className="ti ti-arrow-left" /> All timelines
          </Link>
          <span className={styles.eventCount}>
            {total.toLocaleString()} events
          </span>
        </div>
        <h1 className={styles.title}>{timeline.title}</h1>
        <div className={styles.controls}>
          <SearchBar value={searchInput} onChange={handleSearchChange} />
          {hasActiveFilters && (
            <div className={styles.activeFilters}>
              {categoryFilter && (
                <span
                  className={styles.filterChip}
                  style={{
                    background: CATEGORY_COLORS[categoryFilter]?.bg ?? '#f0f0f0',
                    color: CATEGORY_COLORS[categoryFilter]?.text ?? '#444',
                  }}
                >
                  {categoryFilter}
                  <button className={styles.chipClear} onClick={() => setCategoryFilter(null)} aria-label={`Remove ${categoryFilter} filter`}>
                    <span className="ti ti-x" />
                  </button>
                </span>
              )}
              {yearRange && (
                <span className={styles.filterChip} style={{ background: '#e8f0fa', color: '#0c447c' }}>
                  {timeline.yearStart !== yearRange[0] || timeline.yearEnd !== yearRange[1]
                    ? `${yearRange[0] < 0 ? `${Math.abs(yearRange[0])} BC` : yearRange[0]} – ${yearRange[1] < 0 ? `${Math.abs(yearRange[1])} BC` : yearRange[1]}`
                    : 'Year range'}
                  <button className={styles.chipClear} onClick={() => setYearRange(null)} aria-label="Remove year range filter">
                    <span className="ti ti-x" />
                  </button>
                </span>
              )}
              <button className={styles.clearAll} onClick={clearAllFilters}>
                Clear all
              </button>
            </div>
          )}
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.main}>
          {(timeline.description || timeline.heroImage) && (
            <section className={styles.intro}>
              <div className={styles.introText}>
                {timeline.tagline && <p className={styles.kicker}>{timeline.tagline}</p>}
                {timeline.description && <p className={styles.lead}>{timeline.description}</p>}
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
              {timeline.heroImage && (
                <figure className={styles.introFigure}>
                  <img className={styles.introHero} src={timeline.heroImage} alt="" />
                </figure>
              )}
            </section>
          )}

          <MiniMap
            events={events}
            yearStart={timeline.yearStart}
            yearEnd={timeline.yearEnd}
            activeRange={yearRange}
            onRangeChange={handleRangeChange}
          />

          <HighlightLegend
            categories={timeline.categories}
            highlight={categoryFilter}
            onToggle={handleCategoryToggle}
          />

          {initialLoading ? (
            <div className={styles.stateInline}>Loading events…</div>
          ) : (
            <EventList
              events={events}
              span={span}
              selectedEvent={selectedEvent}
              onSelect={handleSelectEvent}
            />
          )}

          <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />

          {loadingMore && (
            <div className={styles.stateInline}>Loading more…</div>
          )}
        </div>

        <EventDetailPanel
          event={selectedEvent}
          slug={slug!}
          span={span}
          allEvents={events}
          onClose={() => setSelectedEvent(null)}
          onSelectRelated={handleSelectEvent}
        />
      </div>
    </div>
  );
}
