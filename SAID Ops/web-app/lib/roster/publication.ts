import { datesForWeek } from './mock';
import { validWeek } from './week';
import { validateSchedule } from './operations';
import { getCoverage, isUncoveredCritical, hasSchedulingConflict, schedulingConflicts } from './rules';
import { coverageIssue } from './scheduling';
import { cloneWork } from './snapshot';
import { validateAssignment } from './rules';
import type {
  DutyTemplate, PublicationCounts, PublicationResult, PublishedRoster,
  PublishedRosters, PublishedScheduledWork, RosterLifecycle, ScheduledWork, StaffForAssignment,
} from './types';

function weekWork(weekStart: string, scheduled: readonly ScheduledWork[]): ScheduledWork[] {
  const dates = new Set(datesForWeek(weekStart));
  return scheduled.filter(item => dates.has(item.date));
}

// Returning copies prevents a consumer from changing the provider's published snapshot.
export function getPublishedRoster(weekStart: string, published: PublishedRosters): PublishedRoster | undefined {
  const snapshot = published[weekStart];
  return snapshot && { weekStart: snapshot.weekStart, scheduledWork: snapshot.scheduledWork.map(cloneWork) };
}

export function workSignature(item: ScheduledWork | PublishedScheduledWork): string {
  return JSON.stringify([
    item.id, item.dutyId ?? null, item.title, item.description, item.date,
    item.startTime, item.endTime, item.area, item.locationId, item.required, item.isCritical, item.priority, [...item.staffIds].sort(), item.requiredSkills, item.requirements,
  ]);
}

export function getRosterLifecycle(
  weekStart: string, scheduled: readonly ScheduledWork[], published: PublishedRosters,
): RosterLifecycle {
  const snapshot = published[weekStart];
  if (!snapshot) return { status: 'Draft', hasUnpublishedChanges: false };
  const draft = weekWork(weekStart, scheduled).map(workSignature).sort();
  const previous = snapshot.scheduledWork.map(workSignature).sort();
  return {
    status: 'Published',
    hasUnpublishedChanges: draft.length !== previous.length || draft.some((item, index) => item !== previous[index]),
  };
}

function counts(items: readonly ScheduledWork[]): PublicationCounts {
  return {
    itemCount: items.length,
    uncoveredCount: items.filter(item => getCoverage(item).uncovered).length,
    understaffedCount: items.filter(item => getCoverage(item).understaffed).length,
    uncoveredCriticalCount: items.filter(isUncoveredCritical).length,
    conflictCount: items.filter(item => hasSchedulingConflict(item, items)).length,
  };
}

export function publishRoster(
  weekStart: string, scheduled: readonly ScheduledWork[], templates: readonly DutyTemplate[],
  published: PublishedRosters, confirmCoverage: boolean, staff?: readonly StaffForAssignment[],
): PublicationResult {
  if (!validWeek(weekStart)) {
    return { status: 'validation_failed', code: 'INVALID_WEEK',
      itemCount: 0, uncoveredCount: 0, understaffedCount: 0, uncoveredCriticalCount: 0, conflictCount: 0 };
  }
  const items = weekWork(weekStart, scheduled);
  const summary = counts(items);
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      return { status: 'validation_failed', code: 'DUPLICATE_WORK_ID', workId: item.id, ...summary };
    }
    ids.add(item.id);
    const invalid = validateSchedule(item, items, templates, false);
    if (invalid) {
      return { status: 'validation_failed', code: 'INVALID_WORK', workId: item.id,
        validationCode: invalid.code, ...summary };
    }
    if (new Set(item.staffIds).size !== item.staffIds.length) return { status:'validation_failed',code:'INVALID_WORK',workId:item.id,validationCode:'DUPLICATE',...summary };
    if (staff) for (const staffId of item.staffIds) {
      const validation = validateAssignment(item.id, staffId, items.map(work => work.id === item.id ? {...work,staffIds:[]} : work), staff);
      if (!validation.ok && validation.code !== 'OVERLAP') return { status:'validation_failed',code:'INVALID_WORK',workId:item.id,validationCode:validation.code,...summary };
    }
  }
  if (summary.conflictCount > 0) {
    return { status: 'validation_failed', code: 'SCHEDULING_CONFLICT', conflict: schedulingConflicts(items)[0], ...summary };
  }
  if (staff) {
    summary.coverageIssues = items.flatMap(item => {
      const template = templates.find(duty => duty.id === item.dutyId);
      const issue = coverageIssue({...item,isCritical:item.isCritical || template?.isCritical === true}, template?.requiredSkills ?? item.requiredSkills ?? [],
        item.staffIds.map(id => staff.find(person => person.id === id)?.skills ?? []));
      return issue ? [issue] : [];
    });
    summary.warnings = summary.coverageIssues.map(issue => `${issue.title}: ${issue.assigned}/${issue.required} staff${issue.missingSkills.length ? `; missing skills: ${issue.missingSkills.join(', ')}` : ''}${issue.isCritical ? ' (Critical)' : ''}.`);
  }
  if (!confirmCoverage && (summary.uncoveredCount > 0 || summary.understaffedCount > 0 || summary.coverageIssues?.length)) {
    return { status: 'confirmation_required', ...summary };
  }
  return {
    status: 'published', republished: published[weekStart] !== undefined,
    snapshot: { weekStart, scheduledWork: items.map(cloneWork) }, ...summary,
  };
}
