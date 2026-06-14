import type { HistoricalEvent } from '../../types';
import styles from './TimelineViewer.module.scss';

const CATEGORY_COLORS: Record<string, string> = {
  War: '#c0392b',
  Politics: '#2980b9',
  Science: '#27ae60',
  Religion: '#8e44ad',
  'Art & Culture': '#e67e22',
  Exploration: '#16a085',
  Economics: '#f39c12',
  Law: '#2c3e50',
  Philosophy: '#7f8c8d',
  Technology: '#1abc9c',
  'Natural Event': '#d35400',
  Society: '#95a5a6',
};

interface Props {
  event: HistoricalEvent;
  leftPercent: number;
  isSelected: boolean;
  onSelect: (e: HistoricalEvent) => void;
}

export default function EventDot({ event, leftPercent, isSelected, onSelect }: Props) {
  const color = CATEGORY_COLORS[event.category[0]] ?? '#aaa';
  return (
    <button
      className={`${styles.dot} ${isSelected ? styles.dotSelected : ''}`}
      style={{ left: `${leftPercent}%`, backgroundColor: color }}
      title={event.title}
      onClick={(e) => { e.stopPropagation(); onSelect(event); }}
      aria-label={event.title}
    />
  );
}
