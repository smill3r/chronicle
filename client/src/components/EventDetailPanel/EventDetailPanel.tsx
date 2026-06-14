import { useEffect, useState } from 'react';
import type { HistoricalEvent } from '../../types';
import { CATEGORY_COLORS } from '../../types';
import { api } from '../../api/client';
import type { WikiSummary } from '../../api/client';
import styles from './EventDetailPanel.module.scss';

const WIKI_BASE = 'https://en.wikipedia.org/wiki/';

type SummaryState = 'idle' | 'loading' | 'done' | 'none';

interface Props {
  event: HistoricalEvent | null;
  slug: string;
  onClose: () => void;
}

export default function EventDetailPanel({ event, slug, onClose }: Props) {
  const [summaryState, setSummaryState] = useState<SummaryState>('idle');
  const [wikiData, setWikiData] = useState<WikiSummary | null>(null);

  useEffect(() => {
    if (!event) {
      setSummaryState('idle');
      setWikiData(null);
      return;
    }

    setSummaryState('loading');
    setWikiData(null);

    api.timelines.eventSummary(slug, event._id)
      .then((data) => {
        setWikiData(data);
        setSummaryState(data.summary ? 'done' : 'none');
      })
      .catch(() => setSummaryState('none'));
  }, [event?._id, slug]);

  const isOpen = event !== null;

  return (
    <aside
      className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
      aria-hidden={!isOpen}
    >
      {event && (
        <>
          <div className={styles.header}>
            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close event detail"
            >
              <span className="ti ti-x" />
            </button>
          </div>

          <div className={styles.body}>
            <div className={styles.date}>{event.yearDisplay}</div>

            <h2 className={styles.title}>{event.title}</h2>

            <div className={styles.pills}>
              {event.category.map((cat) => (
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
            </div>

            {event.location.length > 0 && (
              <div className={styles.meta}>
                <span className={`ti ti-map-pin ${styles.metaIcon}`} />
                <span>{event.location.join(', ')}</span>
              </div>
            )}

            {/* Wikipedia summary section */}
            {summaryState === 'loading' && (
              <div className={styles.wikiSection}>
                <div className={styles.wikiLabel}>From Wikipedia</div>
                <div className={styles.skeleton}>
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLine} />
                  <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
                </div>
              </div>
            )}

            {summaryState === 'done' && wikiData?.summary && (
              <div className={styles.wikiSection}>
                <div className={styles.wikiLabel}>From Wikipedia</div>
                {wikiData.thumbnail && (
                  <img
                    src={wikiData.thumbnail}
                    alt=""
                    className={styles.thumbnail}
                    loading="lazy"
                  />
                )}
                <p className={styles.extract}>{wikiData.summary}</p>
              </div>
            )}

            {(wikiData?.wikiLink || event.wikiLink) && (
              <a
                className={styles.wikiLink}
                href={`${WIKI_BASE}${encodeURIComponent((wikiData?.wikiLink || event.wikiLink).replace(/ /g, '_'))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="ti ti-brand-wikipedia" />
                Read on Wikipedia
                <span className="ti ti-arrow-up-right" />
              </a>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
