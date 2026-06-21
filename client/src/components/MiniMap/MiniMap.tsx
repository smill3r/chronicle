import { useRef, useState, useEffect, useCallback } from 'react';
import { CATEGORY_COLORS } from '../../types';
import type { HistoricalEvent } from '../../types';
import { formatYear } from '../../utils/formatYear';
import { yearToPercent } from '../../utils/yearToPercent';
import styles from './MiniMap.module.scss';

interface Props {
  events: HistoricalEvent[];
  yearStart: number;
  yearEnd: number;
  activeRange: [number, number] | null;
  onRangeChange: (range: [number, number] | null) => void;
}

export default function MiniMap({ events, yearStart, yearEnd, activeRange, onRangeChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragAnchor = useRef<number>(yearStart);
  const dragCurrent = useRef<number>(yearStart);
  const [preview, setPreview] = useState<[number, number] | null>(null);

  const pxToYear = useCallback((clientX: number): number => {
    const el = trackRef.current;
    if (!el) return yearStart;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(yearStart + pct * (yearEnd - yearStart));
  }, [yearStart, yearEnd]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      dragCurrent.current = pxToYear(e.clientX);
      const lo = Math.min(dragAnchor.current, dragCurrent.current);
      const hi = Math.max(dragAnchor.current, dragCurrent.current);
      if (hi - lo > 0) setPreview([lo, hi]);
    };

    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const lo = Math.min(dragAnchor.current, dragCurrent.current);
      const hi = Math.max(dragAnchor.current, dragCurrent.current);
      setPreview(null);
      // threshold: drag of at least 1% of the span to count as a range selection
      const minSpan = Math.max(1, Math.round((yearEnd - yearStart) * 0.005));
      if (hi - lo > minSpan) {
        onRangeChange([lo, hi]);
      } else {
        // single click — clear range
        onRangeChange(null);
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [pxToYear, yearEnd, yearStart, onRangeChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const yr = pxToYear(e.clientX);
    dragAnchor.current = yr;
    dragCurrent.current = yr;
    setPreview(null);
  };

  const displayRange = preview ?? activeRange;
  const rangeLeft = displayRange
    ? Math.max(0, Math.min(100, yearToPercent(displayRange[0], yearStart, yearEnd)))
    : 0;
  const rangeRight = displayRange
    ? Math.max(0, Math.min(100, yearToPercent(displayRange[1], yearStart, yearEnd)))
    : 0;

  return (
    <div className={styles.minimap}>
      <div className={styles.header}>
        <span className={styles.label}>Overview</span>
        {activeRange && !preview ? (
          <span className={styles.rangeLabel}>
            {formatYear(activeRange[0])} – {formatYear(activeRange[1])}
            <button
              className={styles.clearRange}
              onClick={() => onRangeChange(null)}
              aria-label="Clear year range"
            >
              <span className="ti ti-x" />
            </button>
          </span>
        ) : (
          <span className={styles.rangeHint}>drag to filter by year</span>
        )}
      </div>

      <div
        ref={trackRef}
        className={styles.track}
        onMouseDown={handleMouseDown}
        role="img"
        aria-label="Timeline density overview — drag to filter by year range"
      >
        {events.map((ev) =>
          ev.year === 0 ? null : ( // undated events have no position on the axis
            <span
              key={ev._id}
              className={styles.dot}
              style={{
                left: `${yearToPercent(ev.year, yearStart, yearEnd)}%`,
                background: CATEGORY_COLORS[ev.category[0]]?.dot ?? '#aaa',
              }}
            />
          ),
        )}

        {displayRange && (
          <div
            className={`${styles.rangeOverlay} ${preview ? styles.rangePreviewing : ''}`}
            style={{ left: `${rangeLeft}%`, width: `${rangeRight - rangeLeft}%` }}
          />
        )}
      </div>

      <div className={styles.labels}>
        <span>{formatYear(yearStart)}</span>
        <span>{formatYear(yearEnd)}</span>
      </div>
    </div>
  );
}
