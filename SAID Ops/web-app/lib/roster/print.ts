import { datesForWeek } from './mock';
import { scheduledOnDate } from './rules';
import type { ScheduledWork } from './types';

export function selectPrintableWeek(weekStart: string, area: string, scheduled: readonly ScheduledWork[]) {
  return datesForWeek(weekStart).map(date => ({
    date,
    work: scheduledOnDate(scheduled, date)
      .filter(item => area === 'All Areas' || item.area === area)
      .sort((first, second) => first.startTime.localeCompare(second.startTime)
        || first.endTime.localeCompare(second.endTime)
        || first.title.localeCompare(second.title)
        || first.id.localeCompare(second.id)),
  }));
}
