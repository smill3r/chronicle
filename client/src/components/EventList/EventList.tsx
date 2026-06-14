import type { HistoricalEvent } from '../../types';
import { CATEGORY_COLORS } from '../../types';
import styles from './EventList.module.scss';

function getEraKey(year: number, span: number): string {
  if (span < 100) {
    return year < 0 ? `${Math.abs(year)} BC` : String(year);
  }
  if (span < 2000) {
    const decade = Math.floor(year / 10) * 10;
    return decade < 0 ? `${Math.abs(decade)}s BC` : `${decade}s`;
  }
  const century = Math.floor(year / 100) * 100;
  return century < 0 ? `${Math.abs(century)} BC` : String(century);
}

interface EventGroup {
  era: string;
  sortKey: number;
  events: HistoricalEvent[];
}

function groupEvents(events: HistoricalEvent[], span: number): EventGroup[] {
  const groups = new Map<string, EventGroup>();
  for (const ev of events) {
    const key = getEraKey(ev.year, span);
    if (!groups.has(key)) {
      groups.set(key, { era: key, sortKey: ev.year, events: [] });
    }
    groups.get(key)!.events.push(ev);
  }
  return Array.from(groups.values()).sort((a, b) => a.sortKey - b.sortKey);
}

interface Props {
  events: HistoricalEvent[];
  span: number;
  highlight: string | null;
  selectedEvent: HistoricalEvent | null;
  onSelect: (ev: HistoricalEvent) => void;
}

export default function EventList({ events, span, highlight, selectedEvent, onSelect }: Props) {
  if (events.length === 0) {
    return <div className={styles.empty}>No events found.</div>;
  }

  const groups = groupEvents(events, span);

  return (
    <div className={styles.list}>
      {groups.map(({ era, events: groupEvs }) => (
        <section key={era} className={styles.group}>
          <h2 className={styles.eraHeading}>{era}</h2>
          {groupEvs.map((ev) => {
            const isDimmed = highlight !== null && !ev.category.includes(highlight);
            const isSelected = selectedEvent?._id === ev._id;
            return (
              <div
                key={ev._id}
                className={[
                  styles.row,
                  isSelected ? styles.rowSelected : '',
                  isDimmed ? styles.rowDimmed : '',
                ].join(' ')}
                onClick={() => onSelect(ev)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(ev)}
                aria-pressed={isSelected}
              >
                <div className={styles.date}>{ev.yearDisplay}</div>
                <div className={styles.content}>
                  <h3 className={styles.title}>{ev.title}</h3>
                  {ev.description && (
                    <p className={styles.desc}>{ev.description}</p>
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
                      <span className={styles.location}>{ev.location[0]}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
