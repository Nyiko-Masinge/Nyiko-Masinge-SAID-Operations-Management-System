import { createHash } from 'node:crypto';
import type { RecordData } from './publication';

export const notificationKey = (value: string) => createHash('sha256').update(value).digest('hex');
type Work = RecordData & { assignedUids: string[] };
type Job = RecordData & { recipients: string[]; before: Work | null; after: Work | null };
const compact = (work?: RecordData): Work | null => work ? {
  scheduledWorkId: work.scheduledWorkId, title: String(work.title).slice(0, 200), date: work.date,
  startTime: work.startTime, endTime: work.endTime, locationId: work.locationId,
  requiredStaff: work.requiredStaff, isCritical: work.isCritical, assignedUids: work.assignedUids as string[],
} : null;
const signature = (work?: RecordData) => JSON.stringify(work ? { ...work, assignedUids: [...work.assignedUids as string[]].sort() } : null);

/** Same Stage 7D recipients and content, now committed by the authoritative Next operation. */
export function publicationNotifications(eventId: string, event: RecordData, before: RecordData[], after: RecordData[], supervisors: string[]) {
  const previous = new Map(before.map(w => [String(w.scheduledWorkId), w]));
  const next = new Map(after.map(w => [String(w.scheduledWorkId), w]));
  const jobs: { id: string; data: Job }[] = [];
  for (const workId of new Set([...previous.keys(), ...next.keys()])) {
    const a = previous.get(workId), b = next.get(workId);
    if (signature(a) === signature(b)) continue;
    const base = { eventId, issuedBy: event.actor, createdAt: event.occurredAt, weekStart: event.weekStart,
      publicationVersion: event.publicationVersion, scheduledWorkId: workId };
    const recipients = [...new Set([...(a?.assignedUids ?? []) as string[], ...(b?.assignedUids ?? []) as string[]])];
    if (recipients.length) jobs.push({ id: notificationKey(`${eventId}:work:${workId}`), data: {
      ...base, category: 'Roster', before: compact(a), after: compact(b), recipients,
    } });
    if (b?.isCritical && new Set(b.assignedUids as string[]).size < Number(b.requiredStaff) && supervisors.length)
      jobs.push({ id: notificationKey(`${eventId}:critical:${workId}`), data: {
        ...base, category: 'CriticalDuty', before: null, after: compact(b), recipients: supervisors, criticalGap: true,
      } });
  }
  return inboxRecords(jobs);
}

export function unableNotifications(eventId: string, event: RecordData, item: RecordData, supervisors: string[]) {
  return inboxRecords([{ id: notificationKey(`${eventId}:unable`), data: {
    eventId, category: 'TaskUpdate', issuedBy: event.actor, createdAt: event.occurredAt,
    weekStart: event.weekStart, publicationVersion: event.publicationVersion, scheduledWorkId: event.scheduledWorkId,
    after: compact(item), before: null, reason: String(event.reason ?? '').slice(0, 2000), recipients: supervisors, unable: true,
  } }]);
}

function inboxRecords(jobs: { id: string; data: Job }[]) {
  return jobs.flatMap(({ id, data: job }) => job.recipients.map(uid => {
    const work = (job.after ?? job.before)!;
    const removed = job.before?.assignedUids.includes(uid) && !job.after?.assignedUids.includes(uid);
    const title = job.criticalGap ? 'Critical coverage gap' : job.unable ? 'Unable to Complete' : removed ? 'Assignment removed' : job.before ? 'Roster assignment changed' : 'Roster published';
    const change = removed ? 'Your assignment was removed' : job.before ? 'Your assigned duty changed' : 'You have a published assignment';
    const issuer = job.issuedBy as { displayName: string };
    return { path: `employees/${uid}/notifications/${id}`, data: {
      eventId: job.eventId, category: job.category, title,
      message: (job.criticalGap ? `${work.title}: ${work.assignedUids.length}/${work.requiredStaff} staff assigned.` : job.unable ? `${work.title}: ${job.reason}` : `${change}: ${work.title}, ${work.date} ${work.startTime}-${work.endTime}, area ${work.locationId}. Issued by ${issuer.displayName}.`).slice(0, 2400),
      createdAt: job.createdAt, effectiveAt: `${work.date}T${work.startTime}:00+02:00`, weekStart: job.weekStart,
      publicationVersion: job.publicationVersion, scheduledWorkId: job.scheduledWorkId, issuedBy: job.issuedBy, isRead: false,
    } };
  }));
}

export function supervisorRecipients(employees: { id: string; data: RecordData }[], roles: { id: string; data: RecordData }[]) {
  const ids = new Set(roles.filter(r => r.data.name === 'Supervisor/Administrator' && (r.data.id === undefined || r.data.id === r.id)).map(r => r.id));
  return employees.filter(e => e.data.active === true && ids.has(String(e.data.roleId))).map(e => e.id);
}
