import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import styles from './SplashPage.module.scss';

const LOADING_MESSAGES = [
  'Waking up the server…',
  'Dusting off the archives…',
  'Consulting the Wikidata oracle…',
  'Summoning centuries of history…',
  'Free-tier servers: historically slow…',
  'Loading timelines…',
  'Bribing the hamsters back onto the wheel…',
  'Almost there…',
];

interface Props {
  onReady: () => void;
}

export default function SplashPage({ onReady }: Props) {
  const [phase, setPhase] = useState<'intro' | 'loading' | 'error'>('intro');
  const [msgIndex, setMsgIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase !== 'loading') return;
    intervalRef.current = setInterval(() => {
      setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase]);

  const handleEnter = async () => {
    setPhase('loading');
    try {
      await api.timelines.list();
      onReady();
    } catch (e: unknown) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPhase('error');
      setError(e instanceof Error ? e.message : 'Could not connect to the server');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.wordmark}>Chronicle</h1>

        {phase === 'intro' && (
          <div className={styles.intro}>
            <p className={styles.tagline}>An interactive history timeline browser</p>
            <p className={styles.description}>
              Explore curated historical timelines — battles, discoveries, revolutions,
              and turning points sourced from Wikidata and enriched with Wikipedia.
            </p>
            <button className={styles.cta} onClick={handleEnter}>
              Explore Timelines <span aria-hidden="true">→</span>
            </button>
            <p className={styles.hint}>
              Hosted on a free tier — first load may take a moment to wake up.
            </p>
          </div>
        )}

        {phase === 'loading' && (
          <div className={styles.loader}>
            <div className={styles.dots} aria-hidden="true">
              <span /><span /><span />
            </div>
            <p key={msgIndex} className={styles.loadingMsg}>
              {LOADING_MESSAGES[msgIndex]}
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div className={styles.errorState}>
            <p className={styles.errorMsg}>{error}</p>
            <button
              className={styles.cta}
              onClick={() => { setPhase('intro'); setError(null); setMsgIndex(0); }}
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <footer className={styles.footer}>
        Built with Wikidata · Wikipedia · NestJS · React
      </footer>
    </div>
  );
}
