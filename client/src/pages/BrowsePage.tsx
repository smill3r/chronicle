import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Timeline } from '../types';
import TimelineCard from '../components/TimelineCard/TimelineCard';
import styles from './BrowsePage.module.scss';

export default function BrowsePage() {
  const [timelines, setTimelines] = useState<Timeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.timelines.list()
      .then(setTimelines)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.state}>Loading timelines…</div>;
  if (error) return <div className={styles.state}>Error: {error}</div>;

  const [featured, ...rest] = timelines;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.wordmark}>Chronicle</h1>
          <p className={styles.tagline}>
            Explore {timelines.length} curated historical timelines from Wikipedia.
          </p>
        </div>
      </header>

      <div className={styles.grid}>
        {featured && <TimelineCard timeline={featured} featured />}
        {rest.map((t) => (
          <TimelineCard key={t._id} timeline={t} />
        ))}
      </div>
    </main>
  );
}
