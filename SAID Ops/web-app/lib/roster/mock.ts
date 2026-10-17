import type { DutyTemplate, ScheduledWork } from './types';

// The original twelve prototype assignments remain on the opening Friday so
// existing alert references (a0...a11) continue to target the same duties.
const openingStaffIds: string[][] = [
  ['SAID-VA-1024', 'EMP-0014'], ['EMP-0003'], [],
  ['SAID-VA-1024', 'EMP-0014'], ['EMP-0003'], [],
  ['SAID-VA-1024'], ['EMP-0003'], ['EMP-0014'],
  [], ['EMP-0003'], ['EMP-0014'],
];

export function endTime(start: string, duration: string): string {
  const [hours, minutes] = start.split(':').map(Number);
  const durationMinutes = Number.parseInt(duration, 10);
  const total = hours * 60 + minutes + durationMinutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function instance(duty: DutyTemplate, date: string, staffIds: string[], id: string): ScheduledWork {
  return {
    id, dutyId: duty.id, title: duty.name, description: duty.description,
    date, startTime: duty.time,
    endTime: endTime(duty.time, duty.duration), area: duty.area, locationId: duty.locationId,
    required: duty.required, staffIds: [...staffIds], isCritical: duty.isCritical ?? false,
  };
}

export function createMockRoster(duties: readonly DutyTemplate[]): ScheduledWork[] {
  const opening = duties.map((duty, index) =>
    instance(duty, '2026-10-23', openingStaffIds[index] ?? [], `a${index}`));
  const otherDays: { date: string; dutyIndexes: number[]; staffIds: string[][] }[] = [
    { date: '2026-10-19', dutyIndexes: [0, 1, 2], staffIds: [['SAID-VA-1024'], ['EMP-0003'], []] },
    { date: '2026-10-20', dutyIndexes: [0, 3, 9], staffIds: [['EMP-0014'], ['SAID-VA-1024'], []] },
    { date: '2026-10-21', dutyIndexes: [1, 4, 8], staffIds: [['EMP-0003'], [], ['EMP-0014']] },
    { date: '2026-10-22', dutyIndexes: [0, 2, 5], staffIds: [['SAID-VA-1024'], [], ['EMP-0014']] },
    { date: '2026-10-24', dutyIndexes: [7, 10], staffIds: [[], ['EMP-0003']] },
    { date: '2026-10-25', dutyIndexes: [4, 11], staffIds: [['SAID-VA-1024'], []] },
    { date: '2026-10-26', dutyIndexes: [0, 1, 2], staffIds: [['SAID-VA-1024'], ['EMP-0003'], []] },
    { date: '2026-10-27', dutyIndexes: [3, 5], staffIds: [['EMP-0014'], []] },
    { date: '2026-10-28', dutyIndexes: [4, 8], staffIds: [[], ['EMP-0003']] },
    { date: '2026-10-29', dutyIndexes: [0, 9], staffIds: [['SAID-VA-1024'], []] },
    { date: '2026-10-30', dutyIndexes: [2, 6, 7], staffIds: [[], ['SAID-VA-1024'], ['EMP-0003']] },
    { date: '2026-10-31', dutyIndexes: [7], staffIds: [[]] },
    { date: '2026-11-01', dutyIndexes: [10, 11], staffIds: [['EMP-0003'], []] },
  ];
  return opening.concat(otherDays.flatMap(({ date, dutyIndexes, staffIds }) =>
    dutyIndexes.map((index, position) => instance(
      duties[index], date, staffIds[position], `${date}-${duties[index].id}`,
    ))));
}

export const mockWeekStarts = ['2026-10-19', '2026-10-26'] as const;

export function datesForWeek(start: string): string[] {
  const base = new Date(`${start}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(base);
    day.setUTCDate(base.getUTCDate() + offset);
    return day.toISOString().slice(0, 10);
  });
}

export function addDays(date: string, offset: number): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}

export function weekStartFor(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -(weekday === 0 ? 6 : weekday - 1));
}

export function dateLabel(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}
