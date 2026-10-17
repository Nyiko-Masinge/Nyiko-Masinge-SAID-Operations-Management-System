import { weekStartFor } from './mock';

export function validWeek(start: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return false;
  const date = new Date(`${start}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === start && weekStartFor(start) === start;
}
