export type NotificationBackend = 'memory' | 'firestore';

export function requestedNotificationBackend(flag: string | undefined): NotificationBackend {
  return flag?.trim().toLowerCase() === 'firestore' ? 'firestore' : 'memory';
}

export function notificationAccessError(configured: boolean, backend: NotificationBackend, uid: string | null): string | null {
  if (backend === 'memory') return null;
  if (!configured) return 'Live notifications need Firebase configuration. No live access was started.';
  if (!uid) return 'Sign in to use live notifications.';
  return null;
}
