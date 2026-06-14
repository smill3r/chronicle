import { CATEGORY_COLORS } from '../../types';
import type { HistoricalEvent } from '../../types';
import { formatYear } from '../../utils/formatYear';
import { yearToPercent } from '../../utils/yearToPercent';
import styles from './MiniMap.module.scss';

interface Props {
  events: HistoricalEvent[];
  yearStart: number;
  yearEnd: number;
}

export default function MiniMap({ events, yearStart, yearEnd }: Props) {
  const firstYear = events[0]?.year ?? yearStart;
  const lastYear = events[events.length - 1]?.year ?? yearEnd;
  const winLeft = Math.max(0, Math.min(100, yearToPercent(firstYear, yearStart, yearEnd)));
  const winRight = Math.max(0, Math.min(100, yearToPercent(lastYear, yearStart, yearEnd)));
  const winWidth = Math.max(winRight - winLeft, 1);

  return (
    <div className={styles.minimap}>
      <div className={styles.header}>
        <span className={styles.label}>Overview</span>
        <span className={styles.range}>
          {formatYear(yearStart)} – {formatYear(yearEnd)}
        </span>
      </div>
      <div className={styles.track} role="img" aria-label="Timeline density overview">
        {events.map((ev) => (
          <span
            key={ev._id}
            className={styles.dot}
            style={{
              left: `${yearToPercent(ev.year, yearStart, yearEnd)}%`,
              background: CATEGORY_COLORS[ev.category[0]]?.dot ?? '#aaa',
            }}
          />
        ))}
        <div
          className={styles.viewport}
          style={{ left: `${winLeft}%`, width: `${winWidth}%` }}
        />
      </div>
      <div className={styles.labels}>
        <span>{formatYear(yearStart)}</span>
        <span>{formatYear(yearEnd)}</span>
      </div>
    </div>
  );
}
