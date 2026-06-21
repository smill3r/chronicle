import styles from './YearIndicator.module.scss';

interface Props {
  /** Compact year string to display (e.g. "1916", "44 BC"). */
  year: string;
}

/**
 * Sticky left-column year display.
 *
 * Structure:
 *   .wrap        — layout & alignment
 *     .label     — static "year" eyebrow text (also vertical)
 *     .rotated   — holds writing-mode + rotate(180deg); acts as stable clip
 *       .value   — key={year} so React remounts it on each change,
 *                  restarting yearEnter without conflicting with rotation
 */
export default function YearIndicator({ year }: Props) {
  return (
    <div className={styles.wrap} aria-live="polite" aria-label={`Current year: ${year}`}>
      <span className={styles.label}>year</span>
      <div className={styles.rotated}>
        <span key={year} className={styles.value}>
          {year}
        </span>
      </div>
    </div>
  );
}
