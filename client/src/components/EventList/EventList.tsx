import type { CSSProperties } from "react";
import type { HistoricalEvent } from "../../types";
import { CATEGORY_COLORS } from "../../types";
import { getEraKey } from "../../utils/getEraKey";
import styles from "./EventList.module.scss";

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
      // Undated events (year 0) sort to the very end, not to "year 0".
      const sortKey = ev.year === 0 ? Number.POSITIVE_INFINITY : ev.year;
      groups.set(key, { era: key, sortKey, events: [] });
    }
    groups.get(key)!.events.push(ev);
  }
  return Array.from(groups.values()).sort((a, b) => a.sortKey - b.sortKey);
}

interface Props {
  events: HistoricalEvent[];
  span: number;
  selectedEvent: HistoricalEvent | null;
  onSelect: (ev: HistoricalEvent) => void;
}

export default function EventList({
  events,
  span,
  selectedEvent,
  onSelect,
}: Props) {
  if (events.length === 0) {
    return <div className={styles.empty}>No events found.</div>;
  }

  const groups = groupEvents(events, span);

  return (
    <div className={styles.list}>
      {groups.map(({ era, events: groupEvs }) => (
        <section key={era} className={styles.group}>
          <div className={styles.eraRow}>
            <span className={styles.eraNode} />
            <h2 className={styles.eraHeading}>{era}</h2>
          </div>
          <div className={styles.events}>
            {groupEvs.map((ev) => {
              const isSelected = selectedEvent?._id === ev._id;
              const dotColor =
                CATEGORY_COLORS[ev.category[0]]?.dot ?? "#b8b2aa";
              return (
                <div
                  key={ev._id}
                  className={[
                    styles.row,
                    isSelected ? styles.rowSelected : "",
                  ].join(" ")}
                  style={{ "--dot": dotColor } as CSSProperties}
                  onClick={() => onSelect(ev)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && onSelect(ev)}
                  aria-pressed={isSelected}
                >
                  <div className={styles.date}>{ev.yearDisplay}</div>
                  <div className={styles.rail}>
                    <span className={styles.dot} />
                  </div>
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
                            background: CATEGORY_COLORS[cat]?.bg ?? "#f0f0f0",
                            color: CATEGORY_COLORS[cat]?.text ?? "#444",
                          }}
                        >
                          {cat}
                        </span>
                      ))}
                      {ev.location.length > 0 && (
                        <div className={styles.location}>
                          <span
                            className={`ti ti-map-pin ${styles.metaIcon}`}
                          />

                          <span className={styles.locationName}>
                            {ev.location[0]}
                          </span>
                        </div>
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
