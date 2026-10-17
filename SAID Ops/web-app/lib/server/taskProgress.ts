import { PublicationError, type RecordData } from './publication';
import { safeActor } from './operationalEvents';
import { notificationKey, unableNotifications } from './notifications';
import { validWeek } from '../roster/week';

export const progressTransitions: Record<string, string> = {
  'Scheduled>In Progress': 'TaskStarted', 'In Progress>Completed': 'TaskCompleted',
  'In Progress>Unable to Complete': 'TaskUnableToComplete', 'Completed>In Progress': 'TaskReopened',
  'Unable to Complete>In Progress': 'TaskReopened',
};
export type ProgressAction = { scheduledWorkId: string; weekStart: string; status: string; expectedStatus: string; requestId: string; unableToCompleteReason?: string };
export type ProgressResult = { status: string; publicationVersion: string; unableToCompleteReason?: string };
export type ProgressStore = {
  verifyToken: (token: string) => Promise<{ uid: string }>;
  commit: (uid: string, action: ProgressAction) => Promise<ProgressResult>;
};
const segment = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/') && value !== '.' && value !== '..';

export async function progressTrusted(authorization: string | null, input: unknown, store: ProgressStore) {
  const match = /^Bearer (\S+)$/.exec(authorization ?? '');
  if (!match) throw new PublicationError(401, 'Sign in before updating task progress.');
  let uid: string;
  try { uid = (await store.verifyToken(match[1])).uid; } catch { throw new PublicationError(401, 'Your session is invalid or expired. Sign in again.'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PublicationError(400, 'Invalid progress payload.');
  const data = input as RecordData;
  if (Object.keys(data).some(k => !['scheduledWorkId', 'weekStart', 'status', 'expectedStatus', 'requestId', 'unableToCompleteReason'].includes(k)) ||
      !segment(data.scheduledWorkId) || !segment(data.requestId) || typeof data.weekStart !== 'string' || !validWeek(data.weekStart) ||
      typeof data.status !== 'string' || typeof data.expectedStatus !== 'string' || !progressTransitions[`${data.expectedStatus}>${data.status}`] ||
      (data.unableToCompleteReason !== undefined && typeof data.unableToCompleteReason !== 'string'))
    throw new PublicationError(400, 'Invalid task identity or canonical transition.');
  const reason = (data.unableToCompleteReason as string | undefined)?.trim();
  if (data.status === 'Unable to Complete' && !reason) throw new PublicationError(400, 'Enter a reason before submitting.');
  if (data.status !== 'Unable to Complete' && data.unableToCompleteReason !== undefined) throw new PublicationError(400, 'A reason is only supplied for Unable to Complete.');
  return store.commit(uid, { scheduledWorkId: data.scheduledWorkId, weekStart: data.weekStart, status: data.status,
    expectedStatus: data.expectedStatus, requestId: data.requestId, ...(reason ? { unableToCompleteReason: reason } : {}) });
}

/** Called inside the Admin transaction after reading all authoritative documents. */
export function progressMutation(uid: string, action: ProgressAction, profile: RecordData | undefined, role: RecordData | undefined,
  root: RecordData | undefined, item: RecordData | undefined, before: RecordData | undefined, receipt: RecordData | undefined,
  supervisors: string[], timestamp: unknown) {
  if (!profile || role?.name !== 'Staff Member' || (role.id !== undefined && role.id !== profile.roleId))
    throw new PublicationError(403, 'Only Staff Members may update their assigned work.');
  if (root?.archived === true) throw new PublicationError(409, 'Archived tasks are read-only.', 'ARCHIVED');
  if (!root || root.weekStart !== action.weekStart || !segment(root.currentVersion) || !item ||
      item.scheduledWorkId !== action.scheduledWorkId || item.weekStart !== action.weekStart ||
      !Array.isArray(item.assignedUids) || !item.assignedUids.includes(uid))
    throw new PublicationError(403, 'Your task or assignment changed. Refresh the roster.', 'STALE_ASSIGNMENT');
  const fingerprint = notificationKey(JSON.stringify(action));
  if (receipt) {
    if (receipt.requestFingerprint !== fingerprint || receipt.progressOwnerUid !== uid) throw new PublicationError(409, 'This request ID was already used for another action.');
    return { result: receipt.result as ProgressResult, replay: true as const };
  }
  const priorStatus = before?.status ?? 'Scheduled';
  if (before && (before.scheduledWorkId !== action.scheduledWorkId || before.weekStart !== action.weekStart || !segment(before.publicationVersion) ||
      typeof (before.updatedAt as { toDate?: unknown })?.toDate !== 'function' ||
      !['In Progress', 'Completed', 'Unable to Complete'].includes(String(before.status)) ||
      (before.unableToCompleteReason !== undefined && typeof before.unableToCompleteReason !== 'string') ||
      (before.status === 'Unable to Complete' && !String(before.unableToCompleteReason ?? '').trim())))
    throw new PublicationError(409, 'Saved progress needs repair. Refresh the roster.');
  const type = progressTransitions[`${priorStatus}>${action.status}`];
  if (priorStatus !== action.expectedStatus || !type) throw new PublicationError(409, 'Task progress changed. Refresh the roster.', 'STALE_PROGRESS');
  const reason = action.status === 'Unable to Complete' ? action.unableToCompleteReason : before?.unableToCompleteReason as string | undefined;
  const result: ProgressResult = { status: action.status, publicationVersion: root.currentVersion, ...(reason !== undefined ? { unableToCompleteReason: reason } : {}) };
  const progress = { scheduledWorkId: action.scheduledWorkId, weekStart: action.weekStart, ...result, updatedAt: timestamp };
  const eventId = progressEventId(uid, action.requestId);
  const event = { type, actor: safeActor(uid, profile), actorProvenance: 'authenticated-staff', entityType: 'scheduledWork',
    entityId: action.scheduledWorkId, scheduledWorkId: action.scheduledWorkId, progressOwnerUid: uid,
    weekStart: action.weekStart, publicationVersion: root.currentVersion, before: { status: priorStatus }, after: { status: action.status },
    ...(type === 'TaskUnableToComplete' ? { reason: action.unableToCompleteReason } : {}), occurredAt: timestamp, recordedAt: timestamp,
    requestFingerprint: fingerprint, result };
  return { replay: false as const, result, progress, eventId, event,
    notifications: type === 'TaskUnableToComplete' ? unableNotifications(eventId, event, item, supervisors) : [] };
}
export const progressEventId = (uid: string, requestId: string) => `progress-${notificationKey(JSON.stringify([uid, requestId]))}`;
