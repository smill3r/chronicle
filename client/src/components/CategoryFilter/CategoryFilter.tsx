import styles from './CategoryFilter.module.scss';

interface Props {
  available: string[];
  active: Set<string>;
  onChange: (next: Set<string>) => void;
}

export default function CategoryFilter({ available, active, onChange }: Props) {
  const allOn = available.every((c) => active.has(c));

  const toggleAll = () => onChange(allOn ? new Set() : new Set(available));

  const toggle = (cat: string) => {
    const next = new Set(active);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    onChange(next);
  };

  return (
    <div className={styles.filter}>
      <button className={styles.allBtn} onClick={toggleAll}>
        {allOn ? 'None' : 'All'}
      </button>
      {available.map((cat) => (
        <button
          key={cat}
          className={`${styles.chip} ${active.has(cat) ? styles.active : ''}`}
          onClick={() => toggle(cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
