import { CATEGORY_COLORS } from '../../types';
import styles from './HighlightLegend.module.scss';

interface Props {
  categories: string[];
  highlight: string | null;
  onToggle: (cat: string | null) => void;
}

export default function HighlightLegend({ categories, highlight, onToggle }: Props) {
  return (
    <div className={styles.legend}>
      <span className={styles.label}>Highlight</span>
      <div className={styles.items}>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`${styles.item} ${highlight === cat ? styles.active : ''}`}
            onClick={() => onToggle(highlight === cat ? null : cat)}
          >
            <span
              className={styles.dot}
              style={{ background: CATEGORY_COLORS[cat]?.dot ?? '#999' }}
            />
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
