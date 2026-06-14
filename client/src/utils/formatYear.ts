export function formatYear(year: number | null | undefined): string {
  if (year == null) return '—';
  if (year === 0) return '0';
  if (year < 0) return `${Math.abs(year)} BC`;
  return String(year);
}
