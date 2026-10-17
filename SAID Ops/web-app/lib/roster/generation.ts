import { addDays, datesForWeek } from './mock';
import { validWeek } from './week';
import { validateSchedule } from './operations';
import { cloneWork } from './snapshot';
import type { DutyTemplate, RosterGenerationResult, ScheduledWork } from './types';

type IdFactory = () => string;

// Local generation identity; it is not a persistence uniqueness rule.
function equivalent(first: ScheduledWork, second: ScheduledWork): boolean {
  if (first.dutyId || second.dutyId) {
    return first.dutyId !== undefined && first.dutyId === second.dutyId &&
      first.date === second.date && first.startTime === second.startTime;
  }
  return first.date === second.date && first.startTime === second.startTime &&
    first.title === second.title && first.area === second.area;
}

function emptyResult(scheduled: readonly ScheduledWork[], sourceCount: number): Extract<RosterGenerationResult, { ok: true }> {
  return { ok: true, scheduled: [...scheduled], created: 0, skippedDuplicates: 0,
    unsupported: [], invalid: [], sourceCount };
}

function appendCandidate(
  result: Extract<RosterGenerationResult, { ok: true }>, candidate: ScheduledWork,
  templates: readonly DutyTemplate[], sourceId: string,
): void {
  if (result.scheduled.some(item => equivalent(item, candidate))) {
    result.skippedDuplicates++;
    return;
  }
  const failure = validateSchedule(candidate, result.scheduled, templates, true);
  if (failure) {
    result.invalid.push({ sourceId, code: failure.code });
    return;
  }
  result.scheduled.push(candidate);
  result.created++;
}

export function copyPreviousRoster(
  weekStart: string, scheduled: readonly ScheduledWork[], templates: readonly DutyTemplate[], nextId: IdFactory,
): RosterGenerationResult {
  if (!validWeek(weekStart)) return { ok: false, code: 'INVALID_DATE' };
  const previousStart = addDays(weekStart, -7);
  const previousDays = new Set(datesForWeek(previousStart));
  const source = scheduled.filter(item => previousDays.has(item.date));
  const result = emptyResult(scheduled, source.length);
  for (const item of source) {
    const candidate: ScheduledWork = { ...item, id: nextId(), date: addDays(item.date, 7), staffIds: [] };
    appendCandidate(result, candidate, templates, item.id);
  }
  return result;
}

// Durable source is a current immutable publication. Append preserves all target edits.
export function copyPublishedRoster(weekStart: string, scheduled: readonly ScheduledWork[], source: readonly ScheduledWork[],
  templates: readonly DutyTemplate[], nextId: IdFactory): RosterGenerationResult {
  if (!validWeek(weekStart)) return { ok: false, code: 'INVALID_DATE' };
  const previousDays = new Set(datesForWeek(addDays(weekStart, -7)));
  const result = emptyResult(scheduled, source.length);
  for (const item of source) {
    if (!previousDays.has(item.date)) { result.invalid.push({ sourceId: item.id, code: 'INVALID_DATE' }); continue; }
    const candidate = { ...cloneWork(item), id: nextId(), date: addDays(item.date, 7) };
    if (result.scheduled.some(work => equivalent(work, candidate))) { result.skippedDuplicates++; continue; }
    // Inactive historical template references can be copied; trusted publication rechecks current validity.
    const failure = validateSchedule(candidate, result.scheduled, templates, false);
    if (failure) { result.invalid.push({ sourceId: item.id, code: failure.code }); continue; }
    if (result.scheduled.some(work => work.id === candidate.id)) { result.invalid.push({ sourceId: item.id, code: 'DUPLICATE_WORK_ID' }); continue; }
    result.scheduled.push(candidate); result.created++;
  }
  return result;
}

const recurrenceDays: Readonly<Record<string, readonly number[]>> = {
  Daily: [0, 1, 2, 3, 4, 5, 6],
  'Mon, Wed, Fri': [0, 2, 4],
  'Tue, Thu': [1, 3],
};
export const recurrenceOptions: readonly string[] = Object.freeze(Object.keys(recurrenceDays));
export function daysForRecurrence(recurrence: string): readonly number[] | undefined {
  return Object.prototype.hasOwnProperty.call(recurrenceDays, recurrence)
    ? recurrenceDays[recurrence] : undefined;
}

export function endFromDuration(start: string, duration: string): string | undefined {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) return undefined;
  const match = /^(\d+) min$/.exec(duration);
  if (!match) return undefined;
  const minutes = Number(match[1]);
  if (!Number.isSafeInteger(minutes) || minutes < 1) return undefined;
  const [hour, minute] = start.split(':').map(Number);
  const total = hour * 60 + minute + minutes;
  if (total >= 24 * 60) return undefined;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function generateRecurringDuties(
  weekStart: string, scheduled: readonly ScheduledWork[], templates: readonly DutyTemplate[], nextId: IdFactory,
): RosterGenerationResult {
  if (!validWeek(weekStart)) return { ok: false, code: 'INVALID_DATE' };
  const active = templates.filter(item => item.status === 'Active');
  const result = emptyResult(scheduled, active.length);
  const dates = datesForWeek(weekStart);
  for (const template of active) {
    const weekdays = daysForRecurrence(template.recurrence);
    if (!weekdays) {
      result.unsupported.push({ templateId: template.id, recurrence: template.recurrence });
      continue;
    }
    const endTime = endFromDuration(template.time, template.duration);
    if (!endTime) {
      result.invalid.push({ sourceId: template.id, code: 'INVALID_INTERVAL' });
      continue;
    }
    for (const weekday of weekdays) {
      const candidate: ScheduledWork = {
        id: nextId(), dutyId: template.id, title: template.name, description: template.description,
        date: dates[weekday], startTime: template.time, endTime, area: template.area, locationId: template.locationId,
        required: template.required, staffIds: [], isCritical: template.isCritical ?? false,
        priority: template.priority, requiredSkills: [...(template.requiredSkills ?? [])], requirements: [...template.requirements],
      };
      appendCandidate(result, candidate, templates, template.id);
    }
  }
  return result;
}
