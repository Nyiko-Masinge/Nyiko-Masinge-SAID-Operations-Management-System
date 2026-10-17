import type { RecordData } from './publication';

export type SafeActor = { uid: string; employeeId: string; displayName: string };
const bounded = (value: unknown, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
export function safeActor(uid: string, profile?: RecordData): SafeActor {
  const employeeId = bounded(profile?.employeeId, 200);
  return { uid, employeeId, displayName: bounded(`${bounded(profile?.firstName, 100)} ${bounded(profile?.surname, 100)}`, 200) || employeeId || uid };
}
function summary(item?: RecordData): RecordData | null {
  if (!item) return null;
  return { assignedUids: item.assignedUids, title: bounded(item.title, 200), date: item.date,
    startTime: item.startTime, endTime: item.endTime, locationId: item.locationId,
    requiredStaff: item.requiredStaff, isCritical: item.isCritical };
}
/** One bounded event per changed assignment; unpublished planner edits are excluded. */
export function publicationEvents(weekStart: string, version: string, previousVersion: string | undefined,
  before: RecordData[], after: RecordData[], actor: SafeActor) {
  const base = { actor, actorProvenance: 'verified-supervisor', weekStart, publicationVersion: version,
    ...(previousVersion ? { previousPublicationVersion: previousVersion } : {}) };
  const events: { id: string; data: RecordData }[] = [{ id: `publication-${version}`, data: { ...base,
    type: previousVersion ? 'RosterRepublished' : 'RosterPublished', entityType: 'roster', entityId: weekStart,
    before: { itemCount: before.length }, after: { itemCount: after.length } } }];
  const old = new Map(before.map(item => [String(item.scheduledWorkId), item]));
  const next = new Map(after.map(item => [String(item.scheduledWorkId), item]));
  for (const workId of new Set([...old.keys(), ...next.keys()])) {
    const a = old.get(workId), b = next.get(workId);
    const previous = [...(a?.assignedUids ?? []) as string[]].sort(), current = [...(b?.assignedUids ?? []) as string[]].sort();
    if (JSON.stringify(previous) === JSON.stringify(current)) continue;
    const type = !previous.length ? 'AssignmentAdded' : !current.length ? 'AssignmentRemoved' : 'AssignmentReassigned';
    events.push({ id: `assignment-${version}-${workId}`, data: { ...base, type, entityType: 'scheduledWork', entityId: workId,
      scheduledWorkId: workId, before: summary(a), after: summary(b) } });
  }
  return events;
}
