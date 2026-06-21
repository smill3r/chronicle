import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { DiscoverResult } from '../api/client';
import { CATEGORY_COLORS } from '../types';
import styles from './DiscoverPage.module.scss';

const WIKI_BASE = 'https://en.wikipedia.org/wiki/';

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DiscoverResult | null>(null);
  const [loading, setLoading] = useState(true);

  const next = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.timelines.discover());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { next(); }, [next]);

  // Keyboard: → / Space = next card, Esc = back to timelines.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, navigate]);

  const ev = data?.event;
  const titleColor = ev ? CATEGORY_COLORS[ev.category[0]]?.dot ?? '#888' : '#888';

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link to="/" className={styles.back}>
          <span className="ti ti-arrow-left" /> All timelines
        </Link>
        <span className={styles.brand}>
          <span className="ti ti-sparkles" /> Discover
        </span>
      </header>

      <div className={`${styles.stage} ${loading ? styles.stageLoading : ''}`}>
        {ev && (
          <article className={styles.card} key={ev._id}>
            {data?.thumbnail ? (
              <div className={styles.media}>
                <img src={data.thumbnail} alt="" className={styles.image} />
              </div>
            ) : (
              <div className={styles.mediaEmpty} style={{ background: `${titleColor}1f` }}>
                <span className="ti ti-photo-off" style={{ color: titleColor }} />
              </div>
            )}

            <div className={styles.body}>
              <Link to={`/timelines/${data!.slug}`} className={styles.timelineTag}>
                {ev.sourceArticle.replace(/^Timeline of (the )?/i, '')}
              </Link>
              <div className={styles.date}>{ev.yearDisplay}</div>
              <h1 className={styles.title}>{ev.title}</h1>

              <div className={styles.meta}>
                {ev.category.map((cat) => (
                  <span
                    key={cat}
                    className={styles.pill}
                    style={{
                      background: CATEGORY_COLORS[cat]?.bg ?? '#f0f0f0',
                      color: CATEGORY_COLORS[cat]?.text ?? '#444',
                    }}
                  >
                    {cat}
                  </span>
                ))}
                {ev.location.length > 0 && (
                  <span className={styles.location}>
                    <span className="ti ti-map-pin" /> {ev.location.slice(0, 2).join(', ')}
                  </span>
                )}
              </div>

              {data?.summary && <p className={styles.summary}>{data.summary}</p>}

              <div className={styles.actions}>
                {(data?.wikiLink || ev.wikiLink) && (
                  <a
                    className={styles.wikiLink}
                    href={`${WIKI_BASE}${encodeURIComponent((data?.wikiLink || ev.wikiLink).replace(/ /g, '_'))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="ti ti-brand-wikipedia" /> Read more
                  </a>
                )}
                <button className={styles.nextBtn} onClick={next}>
                  Next <span className="ti ti-arrow-right" />
                </button>
              </div>
            </div>
          </article>
        )}
      </div>

      <footer className={styles.hint}>
        Press <kbd>→</kbd> or <kbd>Space</kbd> for another · <kbd>Esc</kbd> to exit
      </footer>
    </div>
  );
}
