import type { AssignmentResult, ScheduledWork, StaffForAssignment } from './types';
import { availableForWork, staffingCoverage, timeOverlaps } from './scheduling';
export { timeOverlaps } from './scheduling';

export type Coverage = {
  required: number;
  assigned: number;
  remaining: number;
  uncovered: boolean;
  understaffed: boolean;
  fullyStaffed: boolean;
};

export function getCoverage(work: ScheduledWork): Coverage {
  return staffingCoverage(work.required, work.staffIds);
}

// Critical coverage includes both unassigned and partially staffed work.
export function isUncoveredCritical(work: ScheduledWork): boolean {
  return work.isCritical === true && !getCoverage(work).fullyStaffed;
}

export function conflictingWork(
  work: ScheduledWork,
  employeeId: string,
  scheduled: readonly ScheduledWork[],
): ScheduledWork | undefined {
  return scheduled.find(other =>
    other.id !== work.id && other.staffIds.includes(employeeId) && timeOverlaps(work, other));
}

export function hasSchedulingConflict(work: ScheduledWork, scheduled: readonly ScheduledWork[]): boolean {
  return work.staffIds.some(employeeId => conflictingWork(work, employeeId, scheduled) !== undefined);
}

export type ConflictPair = { first: ScheduledWork; second: ScheduledWork; staffIds: string[] };
export function schedulingConflicts(scheduled: readonly ScheduledWork[]): ConflictPair[] {
  const conflicts: ConflictPair[] = [];
  for (let firstIndex = 0; firstIndex < scheduled.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < scheduled.length; secondIndex++) {
      const first = scheduled[firstIndex];
      const second = scheduled[secondIndex];
      if (!timeOverlaps(first, second)) continue;
      const staffIds = Array.from(new Set(first.staffIds)).filter(id => second.staffIds.includes(id));
      if (staffIds.length) conflicts.push({ first, second, staffIds });
    }
  }
  return conflicts;
}

export function validateAssignment(
  workId: string,
  employeeId: string,
  scheduled: readonly ScheduledWork[],
  staff: readonly StaffForAssignment[],
): AssignmentResult {
  const work = scheduled.find(item => item.id === workId);
  if (!work) return { ok: false, code: 'WORK_NOT_FOUND' };
  if (work.staffIds.includes(employeeId)) return { ok: false, code: 'DUPLICATE' };
  const person = staff.find(item => item.id === employeeId);
  if (!person) return { ok: false, code: 'STAFF_NOT_FOUND' };
  if (person.status === 'Inactive') return { ok:false,code:'INACTIVE' };
  if (person.status === 'Unknown' || person.operationalMissing || person.publicationFallback ||
      (person.availabilityPlan ? !availableForWork(person.availabilityPlan, work) :
        ['Unavailable','On Leave','Training','Unknown'].includes(person.availability))) {
    return { ok: false, code: 'UNAVAILABLE' };
  }
  const conflict = conflictingWork(work, employeeId, scheduled);
  if (conflict) return { ok: false, code: 'OVERLAP', conflictingWorkId: conflict.id };
  return { ok: true };
}

export function scheduledOnDate(scheduled: readonly ScheduledWork[], date: string): ScheduledWork[] {
  return scheduled.filter(work => work.date === date);
}
