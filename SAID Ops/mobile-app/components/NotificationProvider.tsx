import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';

import { createNotificationRepository, notificationBackend } from '../data/notifications/createRepository';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { notificationAccessError } from '../data/notifications/backend';
import { toDemoAlert } from '../data/notifications/model';
import type { AppNotification } from '../data/notifications/model';
import type { DemoAlert } from '../types/alerts';

interface NotificationsValue {
  loading: boolean;
  error: string | null;
  status: 'loading' | 'error' | 'empty' | 'data';
  canMarkRead: boolean;
  retry: () => void;
  /** Same shape App.tsx's screens already expect, so no screen needs to change. */
  alerts: DemoAlert[];
  markRead: (alertId: string) => Promise<boolean>;
  markAllRead: () => Promise<boolean>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

/**
 * staffId is local demo identity only. Live requests wait for Firebase restoration and use
 * its UID; business Employee ID/profile mapping remains WS1/WS5 central integration.
 */
export function NotificationsProvider({ children, staffId }: { children: ReactNode; staffId: string }) {
  const liveRequested = notificationBackend === 'firestore';
  const [session, setSession] = useState<{ ready: boolean; uid: string | null }>({ ready: !liveRequested || !isFirebaseConfigured(), uid: null });
  const repo = useMemo(() => createNotificationRepository(session.uid), [session.uid]);
  const recipientId = liveRequested ? session.uid : staffId;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadedRecipient, setLoadedRecipient] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    if (!liveRequested || !isFirebaseConfigured() || !auth) { setSession({ ready: true, uid: null }); return; }
    return onAuthStateChanged(auth, user => setSession({ ready: true, uid: user?.uid ?? null }));
  }, [liveRequested]);

  useEffect(() => {
    const request = ++generation.current;
    let cancelled = false;
    setNotifications([]);
    setLoadedRecipient(null);
    setLoadError(null);
    setWriteError(null);
    setLoading(true);
    if (!session.ready) return () => { cancelled = true; generation.current++; };
    const onError = (_cause: Error) => {
      if (cancelled || request !== generation.current) return;
      setNotifications([]);
      setLoadError(notificationAccessError(isFirebaseConfigured(), notificationBackend, session.uid) ?? 'Unable to load notifications. Please retry.');
      setLoading(false);
    };
    let unsubscribe = () => {};
    try {
      // Live mode subscribes only to the current authenticated recipient.
      unsubscribe = repo.subscribe(recipientId ?? '', list => {
        if (cancelled || request !== generation.current) return;
        setNotifications(list);
        setLoadedRecipient(recipientId);
        setLoadError(null);
        setLoading(false);
      }, onError);
    } catch {
      onError(new Error('Unable to load notifications. Please retry.'));
    }
    return () => { cancelled = true; generation.current++; unsubscribe(); };
  }, [repo, recipientId, session.ready, liveRequested, attempt]);

  const canMarkRead = !loading && !loadError && Boolean(recipientId) && (!liveRequested || auth?.currentUser?.uid === recipientId);
  const write = useCallback(async (alertId?: string): Promise<boolean> => {
    const request = generation.current;
    if (liveRequested && (!auth?.currentUser || auth.currentUser.uid !== recipientId)) { setWriteError('Sign in to update your notifications.'); return false; }
    if (!canMarkRead || !recipientId) { setWriteError('Notifications cannot be updated right now.'); return false; }
    setWriteError(null);
    try {
      if (alertId) await repo.markRead(alertId, recipientId);
      else await repo.markAllRead(recipientId);
      return request === generation.current;
    } catch {
      if (request === generation.current) setWriteError('Unable to mark notifications as read. Please try again.');
      return false;
    }
  }, [repo, recipientId, canMarkRead, liveRequested]);
  const markRead = useCallback((alertId: string) => write(alertId), [write]);
  const markAllRead = useCallback(() => write(), [write]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  const alerts = useMemo(() => !liveRequested || (loadedRecipient === recipientId && auth?.currentUser?.uid === recipientId)
    ? notifications.map(toDemoAlert) : [], [notifications, liveRequested, loadedRecipient, recipientId, auth?.currentUser?.uid]);

  const error = loadError ?? writeError;
  const status = loading ? 'loading' : error ? 'error' : alerts.length === 0 ? 'empty' : 'data';
  const value = useMemo<NotificationsValue>(() => ({ loading, error, status, canMarkRead, retry, alerts, markRead, markAllRead }), [loading, error, status, canMarkRead, retry, alerts, markRead, markAllRead]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return ctx;
}
