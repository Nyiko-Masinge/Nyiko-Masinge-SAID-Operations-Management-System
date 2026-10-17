import { authorizePublisher, PublicationError, type PublicationStore } from './publication';
import { safeActor, type SafeActor } from './operationalEvents';
import { validWeek } from '../roster/week';

export type ArchiveStore = PublicationStore & {
  archive: (week: string, version: string, actor: SafeActor, reason?: string) => Promise<void>;
};
export async function archiveTrusted(authorization: string | null, input: unknown, store: ArchiveStore) {
  const uid = await authorizePublisher(authorization, store);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PublicationError(400, 'Invalid archive request.');
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(k => !['weekStart', 'version', 'reason'].includes(k)) || !validWeek(String(data.weekStart)) ||
      typeof data.version !== 'string' || !data.version || data.version.length > 128 || data.version.includes('/') ||
      (data.reason !== undefined && (typeof data.reason !== 'string' || data.reason.length > 1000)))
    throw new PublicationError(400, 'Provide a valid Monday, current version and optional reason of at most 1000 characters.');
  const actor = safeActor(uid, await store.read(`employees/${uid}`));
  await store.archive(data.weekStart as string, data.version, actor, typeof data.reason === 'string' ? data.reason.trim() : undefined);
  return { weekStart: data.weekStart, version: data.version, archived: true };
}
