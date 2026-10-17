'use strict';
const {createHash} = require('node:crypto');
const eventId = id => 'progress-' + createHash('sha256').update(id).digest('hex');
const transitions = {
  'Scheduled>In Progress': 'TaskStarted', 'In Progress>Completed': 'TaskCompleted',
  'In Progress>Unable to Complete': 'TaskUnableToComplete',
  'Completed>In Progress': 'TaskReopened', 'Unable to Complete>In Progress': 'TaskReopened',
};
/** Auth context is authoritative. Admin/service writes never impersonate staff. */
function progressEvent(event) {
  const after = event.data?.after.exists ? event.data.after.data() : undefined;
  const before = event.data?.before.exists ? event.data.before.data() : undefined;
  if (!after) return null;
  const type = transitions[`${before?.status ?? 'Scheduled'}>${after.status}`];
  if (!type) return null;
  const {uid, scheduledWorkId} = event.params;
  const staff = ['app_user', 'unknown'].includes(event.authType) && event.authId === uid;
  return { id: eventId(event.id), data: { type, occurredAt: after.updatedAt, actor: { uid: event.authId ?? '', employeeId: '', displayName: staff ? uid : 'System/service' },
    actorProvenance: staff ? 'authenticated-staff' : `system/service:${event.authType ?? 'unknown'}`,
    entityType: 'scheduledWork', entityId: scheduledWorkId, scheduledWorkId, progressOwnerUid: uid,
    weekStart: after.weekStart, publicationVersion: after.publicationVersion,
    before: {status: before?.status ?? 'Scheduled'}, after: {status: after.status},
    ...(after.status === 'Unable to Complete' ? {reason: String(after.unableToCompleteReason ?? '').slice(0, 2000)} : {}) } };
}
async function recordProgress(db, event, timestamp) {
  const result = progressEvent(event);
  if (!result) return;
  // Use the immutable publication identity, never the mutable latest profile/state.
  if (result.data.actorProvenance === 'authenticated-staff') {
    const item = await db.doc(`publishedRosters/${result.data.weekStart}/versions/${result.data.publicationVersion}/items/${event.params.scheduledWorkId}`).get();
    const data = item.data(), index = data?.assignedUids?.indexOf(event.params.uid);
    const person = index >= 0 ? data.team?.[index] : undefined;
    if (person) result.data.actor = {uid: event.params.uid, employeeId: String(person.employeeId).slice(0,200), displayName: String(person.displayName).slice(0,200)};
  }
  try { await db.doc(`operationalEvents/${result.id}`).create({...result.data, recordedAt: timestamp()}); }
  catch (error) { if (error.code !== 6 && error.code !== 'already-exists') throw error; }
}
module.exports = {eventId, progressEvent, recordProgress};
