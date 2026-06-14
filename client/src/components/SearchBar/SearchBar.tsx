import styles from './SearchBar.module.scss';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: Props) {
  return (
    <div className={styles.wrapper}>
      <input
        type="search"
        className={styles.input}
        placeholder="Search events…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search events"
      />
    </div>
  );
}
