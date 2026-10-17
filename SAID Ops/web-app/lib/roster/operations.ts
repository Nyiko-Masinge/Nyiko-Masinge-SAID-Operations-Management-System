import { conflictingWork, validateAssignment } from './rules';
import { validRequiredStaff } from './scheduling';
import type {
  DutyTemplate, RosterFailure, RosterMutationResult, ScheduleInput,
  ScheduledWork, StaffForAssignment,
} from './types';

function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}

function validTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function validateSchedule(
  work: ScheduledWork,
  scheduled: readonly ScheduledWork[],
  templates: readonly DutyTemplate[],
  newItem: boolean,
): RosterFailure | undefined {
  if (!work.id.trim()) return { ok: false, code: 'INVALID_ID' };
  if (newItem && scheduled.some(item => item.id === work.id)) {
    return { ok: false, code: 'DUPLICATE_WORK_ID' };
  }
  if (work.dutyId !== undefined) {
    const template = templates.find(item => item.id === work.dutyId);
    if (!template) return { ok: false, code: 'TEMPLATE_NOT_FOUND' };
    if (newItem && template.status !== 'Active') return { ok: false, code: 'TEMPLATE_INACTIVE' };
  }
  if (!work.title.trim()) return { ok: false, code: 'TITLE_REQUIRED' };
  if (!validDate(work.date)) return { ok: false, code: 'INVALID_DATE' };
  if (!validTime(work.startTime) || !validTime(work.endTime) || work.endTime <= work.startTime) {
    return { ok: false, code: 'INVALID_INTERVAL' };
  }
  if (!work.area.trim()) return { ok: false, code: 'AREA_REQUIRED' };
  if (!validRequiredStaff(work.required)) {
    return { ok: false, code: 'INVALID_REQUIRED' };
  }
  return undefined;
}

export function createScheduledWork(
  id: string,
  input: ScheduleInput,
  scheduled: readonly ScheduledWork[],
  templates: readonly DutyTemplate[],
): RosterMutationResult {
  const template = input.dutyId ? templates.find(item => item.id === input.dutyId) : undefined;
  const work: ScheduledWork = {
    // The editor supplies template defaults; submitted values belong to this occurrence.
    ...input,
    id,
    staffIds: [],
    isCritical: template?.isCritical ?? false,
    ...(template ? { priority: template.priority, requiredSkills: [...(template.requiredSkills ?? [])], requirements: [...template.requirements] } : {}),
  };
  const failure = validateSchedule(work, scheduled, templates, true);
  if (failure) return failure;
  return { ok: true, scheduled: [...scheduled, work] };
}

export function editScheduledWork(
  id: string,
  input: ScheduleInput,
  scheduled: readonly ScheduledWork[],
  templates: readonly DutyTemplate[],
): RosterMutationResult {
  const existing = scheduled.find(item => item.id === id);
  if (!existing) return { ok: false, code: 'WORK_NOT_FOUND' };
  if (input.dutyId !== existing.dutyId) {
    return { ok: false, code: 'TEMPLATE_CHANGE_NOT_ALLOWED' };
  }
  const candidate: ScheduledWork = {
    ...existing,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    area: input.area,
    locationId: input.locationId,
    required: input.required,
    title: existing.dutyId ? existing.title : input.title,
    description: existing.dutyId ? existing.description : input.description,
  };
  const failure = validateSchedule(candidate, scheduled, templates, false);
  if (failure) return failure;
  for (const employeeId of candidate.staffIds) {
    const conflict = conflictingWork(candidate, employeeId, scheduled);
    if (conflict) return { ok: false, code: 'OVERLAP', conflictingWorkId: conflict.id };
  }
  return { ok: true, scheduled: scheduled.map(item => item.id === id ? candidate : item) };
}

export function assignToWork(
  id: string,
  employeeId: string,
  scheduled: readonly ScheduledWork[],
  staff: readonly StaffForAssignment[],
): RosterMutationResult {
  const validation = validateAssignment(id, employeeId, scheduled, staff);
  if (!validation.ok) return validation;
  return {
    ok: true,
    scheduled: scheduled.map(item => item.id === id
      ? { ...item, staffIds: [...item.staffIds, employeeId] }
      : item),
  };
}

export function unassignFromWork(
  id: string,
  employeeId: string,
  scheduled: readonly ScheduledWork[],
): RosterMutationResult {
  const work = scheduled.find(item => item.id === id);
  if (!work) return { ok: false, code: 'WORK_NOT_FOUND' };
  if (!work.staffIds.includes(employeeId)) return { ok: false, code: 'ASSIGNMENT_NOT_FOUND' };
  return {
    ok: true,
    scheduled: scheduled.map(item => item.id === id
      ? { ...item, staffIds: item.staffIds.filter(assignedId => assignedId !== employeeId) }
      : item),
  };
}

export function reassignOnWork(
  id: string,
  currentEmployeeId: string,
  replacementEmployeeId: string,
  scheduled: readonly ScheduledWork[],
  staff: readonly StaffForAssignment[],
): RosterMutationResult {
  const work = scheduled.find(item => item.id === id);
  if (!work) return { ok: false, code: 'WORK_NOT_FOUND' };
  if (!work.staffIds.includes(currentEmployeeId)) {
    return { ok: false, code: 'ASSIGNMENT_NOT_FOUND' };
  }
  const validation = validateAssignment(id, replacementEmployeeId, scheduled, staff);
  if (!validation.ok) return validation;
  return {
    ok: true,
    scheduled: scheduled.map(item => item.id === id
      ? { ...item, staffIds: item.staffIds.map(assignedId =>
        assignedId === currentEmployeeId ? replacementEmployeeId : assignedId) }
      : item),
  };
}

export function removeScheduledWork(id: string, scheduled: readonly ScheduledWork[]): RosterMutationResult {
  if (!scheduled.some(item => item.id === id)) return { ok: false, code: 'WORK_NOT_FOUND' };
  return { ok: true, scheduled: scheduled.filter(item => item.id !== id) };
}
