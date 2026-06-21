import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Timeline } from '../types';
import TimelineCard from '../components/TimelineCard/TimelineCard';
import styles from './BrowsePage.module.scss';

type SortKey = 'events' | 'era' | 'title';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'events', label: 'Most events' },
  { key: 'era',    label: 'Oldest era' },
  { key: 'title',  label: 'Alphabetical' },
];

function sortTimelines(timelines: Timeline[], by: SortKey): Timeline[] {
  return [...timelines].sort((a, b) => {
    switch (by) {
      case 'events': return b.eventCount - a.eventCount;
      case 'era':    return (a.yearStart ?? 0) - (b.yearStart ?? 0);
      case 'title':  return a.title.localeCompare(b.title);
    }
  });
}

export default function BrowsePage() {
  const [timelines, setTimelines] = useState<Timeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('events');

  useEffect(() => {
    api.timelines.list()
      .then(setTimelines)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.state}>Loading timelines…</div>;
  if (error) return <div className={styles.state}>Error: {error}</div>;

  const sorted = sortTimelines(timelines, sortBy);
  const [featured, ...rest] = sorted;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.wordmark}>Chronicle</h1>
          <p className={styles.tagline}>
            Explore {timelines.length} curated historical timelines —{' '}
            {timelines.reduce((s, t) => s + t.eventCount, 0).toLocaleString()} events from Wikidata.
          </p>
          <Link to="/discover" className={styles.discoverCta}>
            <span className="ti ti-sparkles" /> Surprise me
          </Link>
        </div>
      </header>

      <div className={styles.gridHeader}>
        <span className={styles.gridLabel}>Timelines</span>
        <div className={styles.sortControls} role="group" aria-label="Sort timelines">
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

      <div className={styles.grid}>
        {featured && <TimelineCard timeline={featured} featured />}
        {rest.map((t) => (
          <TimelineCard key={t._id} timeline={t} />
        ))}
      </div>
    </main>
  );
}
