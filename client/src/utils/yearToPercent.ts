export function yearToPercent(year: number, yearStart: number, yearEnd: number): number {
  const span = yearEnd - yearStart;
  if (span === 0) return 0;
  return ((year - yearStart) / span) * 100;
}
