import { validWeek } from './week';
import { weekStartFor } from './mock';

export type WeekPreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
const key = (uid: string) => `said-ops-roster-week:${uid}`;
export function currentWeek(date = new Date()): string {
  const local = [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
  return weekStartFor(local);
}
// Code Attribution — Aaryan Makan (ST10259834), roster-week preference.
// These read/save methods follow localStorage's getItem/setItem persistence API;
// caller-supplied storage and per-UID keys support isolated roster selections.
// MDN contributors (n.d.) 'Window: localStorage property'.
// https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
// Accessed: 5 October 2026.
export function readWeekPreference(uid: string, storage: WeekPreferenceStorage, fallback = currentWeek()): string {
  try { const value = storage.getItem(key(uid)); return value && validWeek(value) ? value : fallback; }
  catch { return fallback; }
}
export function saveWeekPreference(uid: string, week: string, storage: WeekPreferenceStorage): void {
  if (!uid || !validWeek(week)) return;
  try { storage.setItem(key(uid), week); } catch { /* Storage may be unavailable; scheduling still works. */ }
}
