import { isFirebaseConfigured } from '../../lib/firebase';
import { createInMemoryNotificationRepository, createUnavailableNotificationRepository } from './repository';
import type { NotificationRepository } from './repository';
import { notificationAccessError, requestedNotificationBackend } from './backend';
import { createFirestoreNotificationRepository } from './firestoreRepository';

export const notificationBackend = requestedNotificationBackend(process.env.EXPO_PUBLIC_MONITORING_BACKEND);

/**
 * Explicit demo mode stays local even when Firebase is configured. Requested live access
 * uses only the authenticated employee's nested notification path.
 */
export function createNotificationRepository(uid: string | null = null): NotificationRepository {
  const reason = notificationAccessError(isFirebaseConfigured(), notificationBackend, uid);
  if (reason) return createUnavailableNotificationRepository(reason);
  return notificationBackend === 'firestore' ? createFirestoreNotificationRepository() : createInMemoryNotificationRepository();
}
