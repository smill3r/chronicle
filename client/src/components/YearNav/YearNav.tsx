import styles from './YearNav.module.scss';

interface NavItem {
  /** Display label shown in the navigator (e.g. "1914", "1780s", "3000 BC"). */
  label: string;
  /** The `data-era` value used to find the section in the DOM. */
  era: string;
}

interface Props {
  /** Ordered list of era labels present in the current event list. */
  items: NavItem[];
  /** The era label closest to the viewport centre (from `useScrollYear`). */
  activeEra: string;
}

/**
 * Contacts-app-style vertical navigator for jumping between era sections.
 *
 * Clicking an item scrolls the matching `[data-era]` element into view.
 * The active item is highlighted based on the `activeEra` prop, which is
 * driven by the scroll position via `useScrollYear`.
 */
export default function YearNav({ items, activeEra }: Props) {
  const handleClick = (era: string) => {
    const target = document.querySelector<HTMLElement>(`[data-era="${CSS.escape(era)}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (items.length === 0) return null;

  return (
    <nav className={styles.nav} aria-label="Jump to era">
      {items.map(({ label, era }) => (
        <button
          key={era}
          className={`${styles.item} ${activeEra === era ? styles.active : ''}`}
          onClick={() => handleClick(era)}
          aria-label={`Jump to ${label}`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
