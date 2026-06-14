import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Timeline, HistoricalEvent } from '../types';
import MiniMap from '../components/MiniMap/MiniMap';
import HighlightLegend from '../components/HighlightLegend/HighlightLegend';
import EventList from '../components/EventList/EventList';
import EventDetailPanel from '../components/EventDetailPanel/EventDetailPanel';
import SearchBar from '../components/SearchBar/SearchBar';
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
  const [highlight, setHighlight] = useState<string | null>(null);
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
    [slug, searchQuery],
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
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.main}>
          <MiniMap
            events={events}
            yearStart={timeline.yearStart}
            yearEnd={timeline.yearEnd}
          />

          <HighlightLegend
            categories={timeline.categories}
            highlight={highlight}
            onToggle={setHighlight}
          />

          {initialLoading ? (
            <div className={styles.stateInline}>Loading events…</div>
          ) : (
            <EventList
              events={events}
              span={span}
              highlight={highlight}
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
          onClose={() => setSelectedEvent(null)}
        />
      </div>
    </div>
  );
}
