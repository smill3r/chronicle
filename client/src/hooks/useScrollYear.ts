import { useEffect, useRef, useState } from 'react';

/**
 * Tracks which event row is closest to the vertical centre of the viewport and
 * returns its formatted year string (read from the element's `data-event-year`
 * attribute).
 *
 * The returned value updates at most once per animation frame so it is safe to
 * use as a React state driver even during fast scrolling.
 *
 * @param containerRef - ref pointing to the element containing event rows
 * @param version - increment to force a re-run (e.g. when events first load)
 * @returns The `yearDisplay` string of the event nearest the viewport centre,
 *          or an empty string before any events are visible.
 */
export function useScrollYear(
  containerRef: React.RefObject<HTMLElement | null>,
  version = 0,
): string {
  const [year, setYear] = useState('');
  const rafId = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const rows = container.querySelectorAll<HTMLElement>('[data-event-year]');
      const center = window.innerHeight / 2;

      let closest = '';
      let closestDist = Infinity;

      rows.forEach((row) => {
        const rect = row.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(mid - center);
        if (dist < closestDist) {
          closestDist = dist;
          closest = row.dataset.eventYear ?? '';
        }
      });

      if (closest) setYear(closest);
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Run immediately so the indicator shows a year before the first scroll.
    // Also runs when `version` changes (i.e. when events finish loading).
    update();

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId.current);
    };
  // version is intentionally included so the effect re-runs when events load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, version]);

  return year;
}
