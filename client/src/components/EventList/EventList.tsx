import type { CSSProperties } from 'react';
import type { HistoricalEvent } from '../../types';
import { CATEGORY_COLORS } from '../../types';
import { getEraKey } from '../../utils/getEraKey';
import { formatYear } from '../../utils/formatYear';
import styles from './EventList.module.scss';

/** Ensure the first character of a string is uppercase. */
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventGroup {
  era: string;
  sortKey: number;
  events: HistoricalEvent[];
}

interface Props {
  events: HistoricalEvent[];
  /** Timeline span in years — controls era grouping granularity. */
  span: number;
  selectedEvent: HistoricalEvent | null;
  onSelect: (event: HistoricalEvent) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupEvents(events: HistoricalEvent[], span: number): EventGroup[] {
  const groups = new Map<string, EventGroup>();

  for (const ev of events) {
    const key = getEraKey(ev.year, span);
    if (!groups.has(key)) {
      // Undated events (year 0) sort to the very end.
      const sortKey = ev.year === 0 ? Number.POSITIVE_INFINITY : ev.year;
      groups.set(key, { era: key, sortKey, events: [] });
    }
    groups.get(key)!.events.push(ev);
  }

  return Array.from(groups.values()).sort((a, b) => a.sortKey - b.sortKey);
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Chronological event list with a dock-style focus effect.
 *
 * Each event row carries `data-event-id` and `data-event-year` attributes so
 * that `useScrollFocus` and `useScrollYear` can update them directly via DOM
 * mutation without triggering React re-renders.
 *
 * Era headings carry `data-era` so `YearNav` can scroll to them.
 */
export default function EventList({ events, span, selectedEvent, onSelect }: Props) {
  if (events.length === 0) {
    return <div className={styles.empty}>No events found.</div>;
  }

  const groups = groupEvents(events, span);

  return (
    <div className={styles.list}>
      {groups.map(({ era, events: groupEvs }) => (
        <section key={era} className={styles.group}>

          {/* Era heading — targeted by YearNav via data-era */}
          <div className={styles.eraRow} data-era={era}>
            <span className={styles.eraNode} aria-hidden="true" />
            <h2 className={styles.eraHeading}>{era}</h2>
          </div>

          <div className={styles.events}>
            {groupEvs.map((ev) => {
              if (ev.isSynthetic) {
                return (
                  <div key={ev._id} className={styles.bookend}>
                    <div className={styles.rail}>
                      <span className={styles.bookendDiamond} aria-hidden="true" />
                    </div>
                    <div className={styles.bookendLabel}>{ev.title}</div>
                  </div>
                );
              }

              const isSelected = selectedEvent?._id === ev._id;
              const dotColor = CATEGORY_COLORS[ev.category[0]]?.dot ?? '#b8b2aa';

              return (
                <div
                  key={ev._id}
                  // Hooks read these to drive focus level and year indicator.
                  // data-event-year uses formatYear(ev.year) — always a compact
                  // string like "1940" or "44 BC", never a full date.
                  data-event-id={ev._id}
                  data-event-year={formatYear(ev.year)}
                  // Default focus level; overwritten by useScrollFocus via DOM.
                  data-focus="1"
                  className={[styles.row, isSelected ? styles.rowSelected : ''].join(' ')}
                  style={{ '--dot': dotColor } as CSSProperties}
                  onClick={() => onSelect(ev)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect(ev)}
                  aria-pressed={isSelected}
                  aria-label={`${ev.yearDisplay} — ${ev.title}`}
                >
                  <div className={styles.rail}>
                    <span className={styles.dot} aria-hidden="true" />
                  </div>

                  <div className={styles.content}>
                    <div className={styles.yearDisplay}>{ev.yearDisplay}</div>
                    <h3 className={styles.title}>
                      {cap(ev.title)}
                      {ev.wikiLink && (
                        <span
                          className={`ti ti-brand-wikipedia ${styles.wikiIcon}`}
                          aria-label="Has Wikipedia article"
                        />
                      )}
                    </h3>
                    {ev.description && (
                      <p className={styles.desc}>{cap(ev.description)}</p>
                    )}
                    <div className={styles.pills}>
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
                          <span className="ti ti-map-pin" aria-hidden="true" />
                          {ev.location[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
