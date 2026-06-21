import { useEffect, useMemo, useRef, useState } from 'react';
import type { HistoricalEvent } from '../../types';
import { CATEGORY_COLORS } from '../../types';
import { api } from '../../api/client';
import type { WikiSummary } from '../../api/client';
import { getEraKey } from '../../utils/getEraKey';
import styles from './EventDetailSheet.module.scss';

const WIKI_BASE = 'https://en.wikipedia.org/wiki/';

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

type SummaryState = 'idle' | 'loading' | 'done' | 'none';

interface Props {
  /** The event to display, or null when nothing is selected. */
  event: HistoricalEvent | null;
  /** Timeline slug, used to fetch the Wikipedia summary. */
  slug: string;
  /** Full timeline span in years, used for era grouping of related events. */
  span: number;
  /** All currently-loaded events, used to find "Also in this era" items. */
  allEvents: HistoricalEvent[];
  onClose: () => void;
  onSelectRelated: (event: HistoricalEvent) => void;
}

/**
 * Event detail panel with two responsive personalities:
 *
 * - **Desktop** (`≥ 768 px`): editorial flowing content in the right column.
 *   Fades in when an event is selected, fades out when cleared.
 * - **Mobile** (`< 768 px`): full-screen sheet that slides in from the right.
 *   Responds to a right-swipe gesture (≥ 60 px) to dismiss.
 *
 * Wikipedia summary and thumbnail are fetched lazily on first selection and
 * cached on the event document by the API.
 */
export default function EventDetailSheet({
  event,
  slug,
  span,
  allEvents,
  onClose,
  onSelectRelated,
}: Props) {
  const [summaryState, setSummaryState] = useState<SummaryState>('idle');
  const [wikiData, setWikiData] = useState<WikiSummary | null>(null);
  const touchStartX = useRef<number>(0);

  // Fetch Wikipedia summary whenever the selected event changes.
  useEffect(() => {
    if (!event) {
      setSummaryState('idle');
      setWikiData(null);
      return;
    }
    setSummaryState('loading');
    setWikiData(null);
    api.timelines
      .eventSummary(slug, event._id)
      .then((data) => {
        setWikiData(data);
        setSummaryState(data.summary ? 'done' : 'none');
      })
      .catch(() => setSummaryState('none'));
  }, [event?._id, slug]);

  // Related events in the same era, capped at three.
  const relatedEvents = useMemo(() => {
    if (!event || allEvents.length === 0) return [];
    const era = getEraKey(event.year, span);
    return allEvents
      .filter((e) => e._id !== event._id && getEraKey(e.year, span) === era)
      .slice(0, 3);
  }, [event, allEvents, span]);

  // Swipe-to-close: track horizontal touch distance.
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 60) onClose();
  };

  const isOpen = event !== null;
  const dotColor = event ? (CATEGORY_COLORS[event.category[0]]?.dot ?? '#b8b2aa') : '';
  const catColors = event ? CATEGORY_COLORS[event.category[0]] : null;

  return (
    <aside
      className={`${styles.sheet} ${isOpen ? styles.open : ''}`}
      aria-hidden={!isOpen}
      aria-label="Event detail"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {event && (
        <>
          {/* ── Sheet header (mobile hint + close button) ── */}
          <div className={styles.sheetHeader}>
            <span className={styles.swipeHint} aria-hidden="true">
              <span className="ti ti-arrow-left" /> swipe to close
            </span>
            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close event detail"
            >
              <span className="ti ti-x" />
            </button>
          </div>

          {/* ── Content ── */}
          <div className={styles.body}>
            <div className={styles.date}>{event.yearDisplay}</div>

            {catColors && (
              <span
                className={styles.catPill}
                style={{ background: catColors.bg, color: catColors.text }}
              >
                {event.category[0]}
              </span>
            )}

            <h2 className={styles.title} style={{ borderLeftColor: dotColor }}>
              {cap(event.title)}
            </h2>

            {event.location.length > 0 && (
              <div className={styles.location}>
                <span className="ti ti-map-pin" aria-hidden="true" />
                {event.location.join(', ')}
              </div>
            )}

            {event.description && (
              <p className={styles.desc}>{cap(event.description)}</p>
            )}

            {/* ── Wikipedia section ── */}
            <div className={styles.wikiSection}>
              <span className={styles.sectionLabel}>From Wikipedia</span>

              {summaryState === 'loading' && (
                <div className={styles.skeleton}>
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLine} />
                  <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
                </div>
              )}

              {summaryState === 'done' && wikiData?.summary && (
                <>
                  {wikiData.thumbnail && (
                    <img
                      src={wikiData.thumbnail}
                      alt=""
                      className={styles.thumbnail}
                    />
                  )}
                  <p className={styles.extract}>{wikiData.summary}</p>
                </>
              )}
            </div>

            {(wikiData?.wikiLink || event.wikiLink) && (
              <a
                className={styles.wikiLink}
                href={`${WIKI_BASE}${encodeURIComponent(
                  (wikiData?.wikiLink || event.wikiLink).replace(/ /g, '_'),
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="ti ti-brand-wikipedia" aria-hidden="true" />
                Read on Wikipedia
                <span className="ti ti-arrow-up-right" aria-hidden="true" />
              </a>
            )}

            {/* ── Also in this era ── */}
            {relatedEvents.length > 0 && (
              <div className={styles.relatedSection}>
                <span className={styles.sectionLabel}>Also in this era</span>
                {relatedEvents.map((rel) => (
                  <button
                    key={rel._id}
                    className={styles.relatedRow}
                    onClick={() => onSelectRelated(rel)}
                  >
                    <span
                      className={styles.relatedDot}
                      style={{
                        background: CATEGORY_COLORS[rel.category[0]]?.dot ?? '#ccc',
                      }}
                    />
                    <span className={styles.relatedContent}>
                      <span className={styles.relatedYear}>{rel.yearDisplay}</span>
                      <span className={styles.relatedTitle}>{rel.title}</span>
                    </span>
                    <span className="ti ti-arrow-right" aria-hidden="true" style={{ fontSize: 12, color: 'var(--color-text-muted)' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
