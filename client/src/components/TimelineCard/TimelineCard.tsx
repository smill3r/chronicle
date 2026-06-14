import { Link } from 'react-router-dom';
import type { Timeline } from '../../types';
import { CATEGORY_COLORS } from '../../types';
import { formatYear } from '../../utils/formatYear';
import styles from './TimelineCard.module.scss';

interface Props {
  timeline: Timeline;
  featured?: boolean;
}

export default function TimelineCard({ timeline, featured = false }: Props) {
  const span =
    timeline.yearEnd != null && timeline.yearStart != null
      ? timeline.yearEnd - timeline.yearStart
      : null;

  return (
    <Link
      to={`/timelines/${timeline.slug}`}
      className={`${styles.card} ${featured ? styles.featured : ''}`}
    >
      <div className={styles.meta}>
        <span className={styles.range}>
          {formatYear(timeline.yearStart)} – {formatYear(timeline.yearEnd)}
        </span>
        <span className={styles.count}>
          {timeline.eventCount.toLocaleString()} events
        </span>
      </div>

      <h2 className={styles.title}>{timeline.title}</h2>

      <div className={styles.bar} aria-hidden="true">
        {timeline.categories.slice(0, 8).map((cat, i) => (
          <div
            key={cat}
            className={styles.barSegment}
            style={{
              flex: 1,
              background: CATEGORY_COLORS[cat]?.dot ?? '#ccc',
              opacity: 1 - i * 0.06,
            }}
          />
        ))}
      </div>

      <div className={styles.tags}>
        {timeline.categories.slice(0, 5).map((cat) => (
          <span
            key={cat}
            className={styles.tag}
            style={{
              background: CATEGORY_COLORS[cat]?.bg ?? '#f0f0f0',
              color: CATEGORY_COLORS[cat]?.text ?? '#444',
            }}
          >
            {cat}
          </span>
        ))}
        {timeline.categories.length > 5 && (
          <span className={styles.tag}>+{timeline.categories.length - 5}</span>
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.spanLabel}>
          {span != null
            ? `${span.toLocaleString()} year${span !== 1 ? 's' : ''} covered`
            : ''}
        </span>
        <span className={styles.arrow}>
          <span className="ti ti-arrow-right" />
        </span>
      </div>
    </Link>
  );
}
