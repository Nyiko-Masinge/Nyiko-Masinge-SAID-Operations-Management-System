import type { AppNotification, NewNotification, Unsubscribe } from './model';

export interface NotificationRepository {
  /** Calls cb immediately with the current list for this recipient, then on every change. */
  subscribe(recipientId: string, cb: (notifications: AppNotification[]) => void, onError: (error: Error) => void): Unsubscribe;
  markRead(id: string, recipientId: string): Promise<void>;
  markAllRead(recipientId: string): Promise<void>;
}

export function createUnavailableNotificationRepository(reason: string): NotificationRepository {
  const reject = async (): Promise<never> => { throw new Error(reason); };
  return {
    subscribe: (_id, _cb, onError) => { onError(new Error(reason)); return () => {}; },
    markRead: reject,
    markAllRead: reject,
  };
}

/* ------------------------------ Tiny store ------------------------------ */

interface Store<T> {
  get(): T[];
  set(next: T[]): void;
  subscribe(cb: (items: T[]) => void): Unsubscribe;
}

function createStore<T>(initial: T[]): Store<T> {
  let items = initial;
  const listeners = new Set<(items: T[]) => void>();
  return {
    get: () => items,
    set(next: T[]) {
      items = next;
      listeners.forEach((l) => l(items));
    },
    subscribe(cb: (items: T[]) => void) {
      listeners.add(cb);
      cb(items);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

/* ------------------------------ Seed data ------------------------------ */
// Carries over the content of data/demoAlerts.ts so the app looks the same before Firebase
// is configured. recipientId is filled in per-subscriber, since a demo notification isn't
// really addressed to anyone until someone asks for "my" notifications.

const ago = (mins: number): string => new Date(Date.now() - mins * 60_000).toISOString();

const seedFor = (recipientId: string): AppNotification[] => [
  { id: `${recipientId}:n1`, recipientId, category: 'Emergency', title: 'Emergency: Assist Intake Ward', message: 'Immediate assistance required for critical arrival in Intake Ward A.', createdAt: ago(15), isRead: false, deliveryStatus: 'Sent' },
  { id: `${recipientId}:n2`, recipientId, category: 'Equipment', title: 'Equipment Stock Check', message: 'Equipment stock check required in Ward B.', createdAt: ago(45), isRead: false, deliveryStatus: 'Sent' },
  { id: `${recipientId}:n3`, recipientId, category: 'Roster', title: 'Roster Update', message: 'Your roster has been updated for tomorrow.', createdAt: ago(150), isRead: false, deliveryStatus: 'Sent' },
  { id: `${recipientId}:n4`, recipientId, category: 'TaskUpdate', title: 'Task Completed', message: 'Routine inventory check was completed successfully.', createdAt: ago(1500), isRead: true, deliveryStatus: 'Sent' },
  { id: `${recipientId}:n5`, recipientId, category: 'Facility', title: 'Facility Notice', message: 'Facility maintenance is scheduled for Ward A.', createdAt: ago(1560), isRead: true, deliveryStatus: 'Sent' },
];

/* --------------------------- In-memory version --------------------------- */

export class InMemoryNotificationRepository implements NotificationRepository {
  private stores = new Map<string, Store<AppNotification>>();
  private seq = 100;

  private storeFor(recipientId: string): Store<AppNotification> {
    let store = this.stores.get(recipientId);
    if (!store) {
      store = createStore(seedFor(recipientId));
      this.stores.set(recipientId, store);
    }
    return store;
  }

  subscribe(recipientId: string, cb: (notifications: AppNotification[]) => void): Unsubscribe {
    return this.storeFor(recipientId).subscribe((items) => cb([...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
  }

  async markRead(id: string, recipientId: string): Promise<void> {
    const store = this.storeFor(recipientId);
    if (!store.get().some((n) => n.id === id)) throw new Error('Notification is not available for this recipient.');
    store.set(store.get().map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  async markAllRead(recipientId: string): Promise<void> {
    const store = this.storeFor(recipientId);
    store.set(store.get().map((n) => ({ ...n, isRead: true })));
  }

  /** For other features to raise a notification once they decide when that should happen. */
  async create(notification: NewNotification): Promise<AppNotification> {
    this.seq += 1;
    const created: AppNotification = { ...notification, id: `n-${this.seq}`, createdAt: new Date().toISOString() };
    const store = this.storeFor(notification.recipientId);
    store.set([created, ...store.get()]);
    return created;
  }
}

export function createInMemoryNotificationRepository(): NotificationRepository {
  return new InMemoryNotificationRepository();
}
