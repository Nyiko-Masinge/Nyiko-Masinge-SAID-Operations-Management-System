// Shared, Firebase/React-independent scheduling facts. Intervals are half open.
import { validAvailability, type Availability } from '../planning/model';

export type WorkInterval = { date: string; startTime: string; endTime: string };
export function timeOverlaps(first: WorkInterval, second: WorkInterval): boolean {
  return first.date === second.date && first.startTime < second.endTime && second.startTime < first.endTime;
}
export function validRequiredStaff(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100;
}
export function staffingCoverage(required: number, identities: readonly string[]) {
  const assigned = new Set(identities).size;
  return { required, assigned, remaining: Math.max(0, required - assigned), uncovered: assigned === 0,
    understaffed: assigned > 0 && assigned < required, fullyStaffed: assigned >= required };
}
export function availableForWork(plan: Availability, work: WorkInterval): boolean {
  if (!validAvailability(plan)) return false;
  if (plan.state === 'Available' || plan.state === 'On Duty') return true;
  // Roster times are Johannesburg UTC+02, independent of server/browser timezone.
  const start = Date.parse(`${work.date}T${work.startTime}:00+02:00`);
  const end = Date.parse(`${work.date}T${work.endTime}:00+02:00`);
  return Number.isFinite(start) && Number.isFinite(end) && start < end &&
    !(start < (plan.effectiveTo === null ? Infinity : Date.parse(plan.effectiveTo)) && Date.parse(plan.effectiveFrom) < end);
}
export function missingSkills(required: readonly string[], staffSkills: readonly (readonly string[])[]): string[] {
  const available = new Set(staffSkills.flatMap(skills => skills.map(skill => skill.trim().toLowerCase())));
  return required.filter(skill => !available.has(skill.trim().toLowerCase()));
}
export type CoverageIssue = { workId: string; title: string; isCritical: boolean; assigned: number; required: number; missingSkills: string[] };
export function coverageIssue(work: { id: string; title: string; isCritical: boolean; required: number; staffIds: readonly string[] },
  requiredSkills: readonly string[], staffSkills: readonly (readonly string[])[]): CoverageIssue | undefined {
  const coverage = staffingCoverage(work.required, work.staffIds), missing = missingSkills(requiredSkills, staffSkills);
  return !coverage.fullyStaffed || missing.length ? { workId: work.id, title: work.title, isCritical: work.isCritical,
    assigned: coverage.assigned, required: work.required, missingSkills: missing } : undefined;
}
