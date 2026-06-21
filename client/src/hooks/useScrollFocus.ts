import { useEffect, useRef } from 'react';

/**
 * Drives the dock-style focus effect on an event list.
 *
 * **Desktop (pointer device):** focus is driven by vertical mouse position.
 * Each row's `--focus-val` is computed from its distance to the cursor, within
 * a fixed pixel radius. Before the first mousemove the hook falls back to the
 * scroll-based path.
 *
 * **Mobile (touch device):** focus is scroll-based with an asymmetric curve —
 * the focal point sits slightly below viewport center so content approaching
 * from below stays enlarged longer, matching natural reading flow.
 *
 * In both cases two values are written per row on every update frame:
 *  • `data-focus` (0–3)   — discrete level for show/hide of desc & pills
 *  • `--focus-val` (0–1)  — continuous float for smooth CSS `calc()` transitions
 *
 * @param containerRef - ref pointing to the element containing event rows
 * @param version - increment to force a re-run (e.g. after events first load)
 */
export function useScrollFocus(
  containerRef: React.RefObject<HTMLElement | null>,
  version = 0,
): void {
  const rafId  = useRef<number>(0);
  const mouseY = useRef<number>(-1); // -1 = no mouse yet → use scroll fallback

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // True pointer device (mouse/trackpad) — switch to mouse-distance mode.
    const isPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    // Mobile: zoom disabled entirely. CSS handles static appearance.
    if (!isPointer) return;

    const update = () => {
      const rows = container.querySelectorAll<HTMLElement>('[data-event-id]');
      const vh = window.innerHeight;

      rows.forEach((row) => {
        const rect = row.getBoundingClientRect();
        const mid  = rect.top + rect.height / 2;
        let norm: number;

        if (isPointer && mouseY.current >= 0) {
          // ── Desktop: distance from mouse cursor (vertical) ──────────────────
          // Items within RADIUS px of the cursor get focus; beyond = 0.
          const RADIUS = 280;
          norm = Math.min(Math.abs(mid - mouseY.current) / RADIUS, 1);
        } else {
          // ── Mobile (or desktop before first mousemove): scroll-based ────────
          // Focal point sits at 55 % of viewport height (slightly below centre).
          // Above it: standard symmetric falloff.
          // Below it: slower falloff — upcoming content stays enlarged longer.
          const focal    = vh * (isPointer ? 0.5 : 0.55);
          const halfUp   = focal;
          const halfDown = (vh - focal) * 1.7;
          const dist     = mid - focal;
          norm = dist <= 0
            ? Math.min(Math.abs(dist) / halfUp,  1)
            : Math.min(dist          / halfDown,  1);
        }

        // Mild power curve keeps the peak zone wide.
        const focusVal = parseFloat((1 - Math.pow(norm, 0.6)).toFixed(3));
        // Discrete level drives show/hide of description and pill badges.
        const level = norm < 0.18 ? 3 : norm < 0.42 ? 2 : norm < 0.72 ? 1 : 0;

        row.style.setProperty('--focus-val', String(focusVal));
        if (row.dataset.focus !== String(level)) row.dataset.focus = String(level);
      });
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(update);
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseY.current = e.clientY;
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(update);
    };

    const onMouseLeave = () => {
      mouseY.current = -1;
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    if (isPointer) {
      window.addEventListener('mousemove',  onMouseMove,  { passive: true });
      window.addEventListener('mouseleave', onMouseLeave);
    }
    update();

    return () => {
      window.removeEventListener('scroll',     onScroll);
      window.removeEventListener('mousemove',  onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(rafId.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, version]);
}
