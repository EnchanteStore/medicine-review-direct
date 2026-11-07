/** Combines separate day/month/year inputs into YYYY-MM-DD for validation. Empty if all blank. */
export function composeIsoDate(day: string, month: string, year: string): string {
  const d = day.trim();
  const m = month.trim();
  const y = year.trim();
  if (!d && !m && !y) return '';
  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function splitIsoDate(value: string | null): { day: string; month: string; year: string } {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return { day: '', month: '', year: '' };
  return { year: match[1]!, month: String(Number(match[2])), day: String(Number(match[3])) };
}
