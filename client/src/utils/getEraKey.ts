export function getEraKey(year: number, span: number): string {
  if (year === 0) return 'Undated'; // year couldn't be resolved from the source
  if (span < 100) {
    return year < 0 ? `${Math.abs(year)} BC` : String(year);
  }
  if (span < 2000) {
    const decade = Math.floor(year / 10) * 10;
    return decade < 0 ? `${Math.abs(decade)}s BC` : `${decade}s`;
  }
  const century = Math.floor(year / 100) * 100;
  return century < 0 ? `${Math.abs(century)} BC` : String(century);
}
