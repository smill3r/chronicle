import type { HistoricalEvent } from '../../types';
import styles from './TimelineViewer.module.scss';

interface Props {
  event: HistoricalEvent;
  leftPercent: number;
  onClose: () => void;
}

export default function EventCard({ event, leftPercent, onClose }: Props) {
  const flipLeft = leftPercent > 85;
  return (
    <div
      className={styles.card}
      style={{
        left: flipLeft ? undefined : `${leftPercent}%`,
        right: flipLeft ? `${100 - leftPercent}%` : undefined,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button className={styles.cardClose} onClick={onClose} aria-label="Close">×</button>
      <p className={styles.cardYear}>{event.yearDisplay}</p>
      <h3 className={styles.cardTitle}>{event.title}</h3>
      {event.description && <p className={styles.cardDesc}>{event.description}</p>}
      {event.category.length > 0 && (
        <div className={styles.cardTags}>
          {event.category.map((c) => <span key={c} className={styles.cardTag}>{c}</span>)}
        </div>
      )}
      {event.location.length > 0 && (
        <p className={styles.cardLocation}>{event.location.join(', ')}</p>
      )}
      {event.wikiLink && (
        <a
          href={`https://en.wikipedia.org/wiki/${encodeURIComponent(event.wikiLink)}`}
          target="_blank"
          rel="noreferrer"
          className={styles.cardLink}
        >
          Wikipedia →
        </a>
      )}
    </div>
  );
}
