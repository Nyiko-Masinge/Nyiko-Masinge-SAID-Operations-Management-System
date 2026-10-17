import { collection, doc, getDocFromServer } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from './firebase';
import type { DemoShift } from '../types/tasks';

const enabled = process.env.EXPO_PUBLIC_ROSTER_BACKEND === 'firestore';
export type Progress = { status: DemoShift['status']; unableToCompleteReason?: string; publicationVersion?: string };
export class ProgressRefreshError extends Error {}
// Retain the request ID after an ambiguous network failure, through refreshes and retries.
const pendingActions = new Map<string, string>();
const refreshMessage = 'Your task or access has changed. Refresh the roster before trying again.';
export function progressErrorMessage(error: unknown): string {
  const code = (error as {code?: string})?.code;
  return error instanceof ProgressRefreshError || ['permission-denied', 'unauthenticated', 'not-found'].includes(code ?? '')
    ? refreshMessage : 'Could not save task progress. Check your connection and try again, or refresh the roster.';
}
const segment = (value: unknown): value is string => typeof value === 'string' && !!value && !value.includes('/');
export function decodeProgress(data: Record<string, unknown> | undefined, id: string, week: string): Progress {
  if (!data) return {status: 'Scheduled'};
  if (data.scheduledWorkId !== id || data.weekStart !== week || !segment(data.publicationVersion) ||
      typeof data.status !== 'string' || !['In Progress','Completed','Unable to Complete'].includes(data.status) ||
      typeof (data.updatedAt as {toDate?: unknown} | undefined)?.toDate !== 'function' ||
      (data.unableToCompleteReason !== undefined && typeof data.unableToCompleteReason !== 'string') ||
      (data.status === 'Unable to Complete' && !(typeof data.unableToCompleteReason === 'string' && data.unableToCompleteReason.trim()))) {
    throw new ProgressRefreshError(refreshMessage);
  }
  return {status: data.status as DemoShift['status'], publicationVersion: data.publicationVersion,
    ...(typeof data.unableToCompleteReason === 'string' ? {unableToCompleteReason: data.unableToCompleteReason} : {})};
}
function identity(task: DemoShift) {
  if (!segment(task.scheduledWorkId) || task.id !== task.scheduledWorkId || !segment(task.publicationVersion) ||
      !task.weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(task.weekStart)) throw new ProgressRefreshError(refreshMessage);
  return {id: task.scheduledWorkId, week: task.weekStart};
}
export async function mergeTaskProgress(tasks: DemoShift[], uid: string): Promise<DemoShift[]> {
  if (!enabled) return tasks;
  if (!uid || getFirebaseAuth().currentUser?.uid !== uid) throw new ProgressRefreshError(refreshMessage);
  const db = getFirebaseDb();
  const result = await Promise.all(tasks.map(async task => {
    const {id, week} = identity(task);
    // Code Attribution — WS3 task-progress integration (Maseo Junior Mandiwana, ST10367488).
    // This refresh follows Firebase's document-snapshot/exists/data read pattern,
    // using getDocFromServer to require server data in the integrated implementation.
    // Firebase (n.d.) 'Get data with Cloud Firestore'.
    // https://firebase.google.com/docs/firestore/query-data/get-data
    // Accessed: 5 October 2026.
    const snapshot = await getDocFromServer(doc(db, 'employees', uid, 'taskProgress', id));
    const progress = decodeProgress(snapshot.exists() ? snapshot.data() : undefined, id, week);
    return {...task, status: progress.status, unableToCompleteReason: progress.unableToCompleteReason};
  }));
  if (getFirebaseAuth().currentUser?.uid !== uid) throw new ProgressRefreshError(refreshMessage);
  return result;
}
export async function saveTaskProgress(task: DemoShift, status: DemoShift['status'], reason?: string): Promise<Progress> {
  if (!enabled) return {status, ...(reason?.trim() ? {unableToCompleteReason: reason.trim()} : task.unableToCompleteReason !== undefined ? {unableToCompleteReason: task.unableToCompleteReason} : {})};
  const auth = getFirebaseAuth(), user = auth.currentUser;
  if (!user) throw new ProgressRefreshError(refreshMessage);
  if (task.archived) throw new ProgressRefreshError('Archived tasks are read-only.');
  const {id, week} = identity(task);
  const normalizedReason = reason?.trim();
  if (status === 'Unable to Complete' && !normalizedReason) throw new ProgressRefreshError('Enter a reason before submitting.');
  const origin = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!origin) throw new Error('Trusted progress API is not configured.');
  const url = new URL(origin);
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '') ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && process.env.EXPO_PUBLIC_FIREBASE_EMULATORS_ENABLED === 'true')))
    throw new Error('Invalid trusted progress API origin.');
  const key = JSON.stringify([user.uid, week, id, task.status, status, normalizedReason ?? '']);
  const requestId = pendingActions.get(key) ?? doc(collection(getFirebaseDb(), 'operationalEvents')).id;
  pendingActions.set(key, requestId);
  const token = await user.getIdToken();
  if (auth.currentUser !== user) throw new ProgressRefreshError(refreshMessage);
  const response = await fetch(new URL('/api/mobile/task-progress', url).toString(), {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduledWorkId: id, weekStart: week, expectedStatus: task.status, status, requestId,
      ...(status === 'Unable to Complete' ? { unableToCompleteReason: normalizedReason } : {}) }),
  });
  if (auth.currentUser !== user) throw new ProgressRefreshError(refreshMessage);
  if (!response.ok) {
    if ([400, 401, 403, 409].includes(response.status)) { pendingActions.delete(key); throw new ProgressRefreshError(refreshMessage); }
    throw new Error('Trusted progress save failed.');
  }
  const result = await response.json() as Progress;
  if (result.status !== status || !segment(result.publicationVersion) ||
      (result.unableToCompleteReason !== undefined && typeof result.unableToCompleteReason !== 'string') ||
      (status === 'Unable to Complete' && result.unableToCompleteReason !== normalizedReason)) throw new Error('Invalid progress response.');
  if (auth.currentUser !== user) throw new ProgressRefreshError(refreshMessage);
  // Retain IDs only for ambiguous failures. Once confirmed, a later action with the
  // same shape (including after another device reopens work) needs a fresh receipt.
  for (const old of pendingActions.keys()) { const parts = JSON.parse(old); if (parts[0] === user.uid && parts[1] === week && parts[2] === id) pendingActions.delete(old); }
  return result;
}
