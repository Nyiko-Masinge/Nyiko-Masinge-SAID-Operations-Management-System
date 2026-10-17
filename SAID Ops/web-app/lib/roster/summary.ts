import { datesForWeek } from './mock';
import { getCoverage, isUncoveredCritical, hasSchedulingConflict } from './rules';
import type { ScheduledWork } from './types';

export function weekSummary(weekStart: string, scheduled: readonly ScheduledWork[]) {
  const dates = datesForWeek(weekStart);
  const days = dates.map(date => {
    const items = scheduled.filter(item => item.date === date);
    return {
      date, itemCount: items.length,
      fullyStaffedCount: items.filter(item => getCoverage(item).fullyStaffed).length,
      uncoveredCount: items.filter(item => getCoverage(item).uncovered).length,
      understaffedCount: items.filter(item => getCoverage(item).understaffed).length,
      uncoveredCriticalCount: items.filter(isUncoveredCritical).length,
      conflictCount: items.filter(item => hasSchedulingConflict(item, items)).length,
      requiredPositions: items.reduce((total, item) => total + item.required, 0),
      filledPositions: items.reduce((total, item) => total + new Set(item.staffIds).size, 0),
    };
  });
  return {
    days,
    itemCount: days.reduce((total, day) => total + day.itemCount, 0),
    fullyStaffedCount: days.reduce((total, day) => total + day.fullyStaffedCount, 0),
    uncoveredCount: days.reduce((total, day) => total + day.uncoveredCount, 0),
    understaffedCount: days.reduce((total, day) => total + day.understaffedCount, 0),
    uncoveredCriticalCount: days.reduce((total, day) => total + day.uncoveredCriticalCount, 0),
    conflictCount: days.reduce((total, day) => total + day.conflictCount, 0),
    requiredPositions: days.reduce((total, day) => total + day.requiredPositions, 0),
    filledPositions: days.reduce((total, day) => total + day.filledPositions, 0),
  };
}
