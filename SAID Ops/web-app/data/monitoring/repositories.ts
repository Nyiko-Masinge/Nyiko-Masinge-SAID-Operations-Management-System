import { supervisor } from '../operations';
import { SYSTEM_ACTOR } from './model';
import type { Actor, Alert, AuditLog, DetectedAlert, NewAuditLog, NewNote, OperationalNote, Unsubscribe } from './model';

/* ------------------------------ Contracts ------------------------------ */
// The UI only depends on these interfaces. A Firestore implementation
// (same shape, backed by onSnapshot) can replace the in-memory one later.

export interface AlertRepository {
  /** Calls cb immediately with the current list, then on every change (like onSnapshot). */
  subscribe(cb: (alerts: Alert[]) => void, onError?: (error: Error) => void): Unsubscribe;
  /** Marks the given alerts Resolved and returns the ones that actually changed. */
  resolve(ids: string[], by: Actor, note?: string): Promise<Alert[]>;
  /**
   * Reconciles detected alerts with the roster: opens new ones, refreshes changed ones and
   * closes those whose problem has gone. An alert a person resolved by hand stays resolved.
   * In Firestore this becomes a Cloud Function triggered by roster writes.
   */
  sync(detected: DetectedAlert[]): Promise<void>;
}

/** Append-only by design: there is deliberately no update or delete. */
export interface AuditLogRepository {
  /** Newest first. */
  subscribe(cb: (logs: AuditLog[]) => void, onError?: (error: Error) => void): Unsubscribe;
  append(entry: NewAuditLog): Promise<AuditLog>;
}

/** Read is scoped per entity so a duty's or alert's notes stay separate. */
export interface NoteRepository {
  subscribe(entityType: OperationalNote['entityType'], entityId: string, cb: (notes: OperationalNote[]) => void, onError?: (error: Error) => void): Unsubscribe;
  add(note: NewNote): Promise<OperationalNote>;
}

export interface Repositories {
  alerts: AlertRepository;
  audit: AuditLogRepository;
  notes: NoteRepository;
}

/** Requested live mode shows unavailable rather than seeded data disguised as a live result. */
export function createUnavailableRepositories(reason: string): Repositories {
  const failure = () => new Error(reason);
  const reject = async (): Promise<never> => { throw failure(); };
  return {
    alerts: { subscribe: (_cb, onError) => { onError?.(failure()); return () => {}; }, resolve: reject, sync: reject },
    audit: { subscribe: (_cb, onError) => { onError?.(failure()); return () => {}; }, append: reject },
    notes: { subscribe: (_type, _id, _cb, onError) => { onError?.(failure()); return () => {}; }, add: reject },
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
// Timestamps are relative to "now" so the demo never shows stale dates.
// Only *reported* alerts are seeded. Unassigned and conflict alerts are detected from the roster.

const ago = (mins: number): string => new Date(Date.now() - mins * 60_000).toISOString();

const LERATO: Actor = { id: supervisor.employeeId, name: supervisor.name, role: supervisor.role };

const seedAlerts = (): Alert[] => [
  { id: 'a3', key: 'reported:a3', origin: 'Reported', type: 'UnableToComplete', priority: 'Medium', state: 'Open', title: 'Unable to Complete', details: 'Kennel Cleaning could not be completed.', area: 'Kennel Block', dutyId: 'd8', raisedAt: ago(1200) },
  { id: 'a4', key: 'reported:a4', origin: 'Reported', type: 'Overdue', priority: 'High', state: 'Open', title: 'Overdue Duty', details: 'Outreach Preparation is overdue.', area: 'Outreach', dutyId: 'd10', raisedAt: ago(1205) },
  { id: 'a5', key: 'reported:a5', origin: 'Reported', type: 'Equipment', priority: 'Low', state: 'Open', title: 'Equipment Review', details: 'Oxygen Check reported an equipment issue.', area: 'General Wards', dutyId: 'd5', raisedAt: ago(1250) },
];

const makeReference = (iso: string, seq: number): string =>
  `SAID-${iso.slice(0, 4)}-${iso.slice(5, 7)}${iso.slice(8, 10)}-${String(seq).padStart(4, '0')}`;

const seedEntry = (n: number, minsAgo: number, f: NewAuditLog): AuditLog => {
  const timestamp = ago(minsAgo);
  return { id: `seed-${n}`, reference: makeReference(timestamp, n), timestamp, ...f };
};

// Newest first. n is the chronological sequence number.
const seedAudit = (): AuditLog[] => [
  seedEntry(5, 20, { actor: LERATO, category: 'AlertResolution', action: 'AlertResolved', summary: 'Resolved staff conflict', details: 'Resolved conflict between Sarah J. and Lindiwe M.', area: 'Theatre 1', entityType: 'alert' }),
  seedEntry(4, 30, { actor: LERATO, category: 'RosterChange', action: 'DutyAssigned', summary: 'Assigned Closing & Handover', details: 'Assigned duty to Marco R.', area: 'All Areas', entityType: 'duty' }),
  seedEntry(3, 45, { actor: LERATO, category: 'DutyChange', action: 'DutyCreated', summary: 'Created Outreach Preparation', details: 'Created recurring duty template', area: 'Outreach', entityType: 'duty' }),
  seedEntry(2, 60, { actor: LERATO, category: 'StaffChange', action: 'StaffAvailabilityChanged', summary: 'Availability updated', details: 'Changed staff availability', area: 'Ward B', entityType: 'staff' }),
  seedEntry(1, 400, { actor: SYSTEM_ACTOR, category: 'SystemEvent', action: 'SystemBackup', summary: 'Daily system backup', details: 'System event completed', area: 'System', entityType: 'system' }),
];

/* --------------------------- In-memory versions --------------------------- */

class InMemoryAlertRepository implements AlertRepository {
  private store: Store<Alert> = createStore(seedAlerts());
  private seq = 100;

  subscribe(cb: (alerts: Alert[]) => void): Unsubscribe {
    return this.store.subscribe(cb);
  }

  async resolve(ids: string[], by: Actor, note?: string): Promise<Alert[]> {
    const resolvedAt = new Date().toISOString();
    const changed: Alert[] = [];
    const next = this.store.get().map((a) => {
      if (!ids.includes(a.id) || a.state === 'Resolved') return a;
      // Conditional spread: Firestore rejects `undefined` field values.
      const updated: Alert = { ...a, state: 'Resolved', resolvedAt, resolvedBy: by, ...(note ? { resolutionNote: note } : {}) };
      changed.push(updated);
      return updated;
    });
    if (changed.length > 0) this.store.set(next);
    return changed;
  }

  async sync(detected: DetectedAlert[]): Promise<void> {
    const now = new Date().toISOString();
    const current = this.store.get();
    const wanted = new Map<string, DetectedAlert>(detected.map((d): [string, DetectedAlert] => [d.key, d]));
    const reconciled: Alert[] = [];
    let changed = false;

    for (const a of current) {
      if (a.origin !== 'Detected' || a.state === 'Resolved') {
        reconciled.push(a);
        continue;
      }
      const d = wanted.get(a.key);
      if (!d) {
        // The roster no longer has this problem: close it.
        changed = true;
        reconciled.push({ ...a, state: 'Resolved', resolvedAt: now, resolvedBy: SYSTEM_ACTOR, resolutionNote: 'Cleared automatically: the roster no longer has this problem.' });
      } else if (d.title !== a.title || d.details !== a.details || d.priority !== a.priority) {
        changed = true;
        reconciled.push({ ...a, title: d.title, details: d.details, priority: d.priority });
      } else {
        reconciled.push(a);
      }
    }

    // A key is blocked while its alert is open, or after a person resolved it (their decision stands).
    // Alerts the system auto-closed can be raised again if the problem returns.
    const blocked = new Set(
      current.filter((a) => a.state !== 'Resolved' || a.resolvedBy?.id !== SYSTEM_ACTOR.id).map((a) => a.key),
    );
    const created: Alert[] = detected
      .filter((d) => !blocked.has(d.key))
      .map((d) => ({ ...d, id: `det-${++this.seq}`, origin: 'Detected' as const, state: 'Open' as const, raisedAt: now }));

    if (changed || created.length > 0) this.store.set([...created, ...reconciled]);
  }
}

class InMemoryAuditLogRepository implements AuditLogRepository {
  private store: Store<AuditLog>;
  private seq: number;

  constructor(seed: AuditLog[]) {
    this.store = createStore(seed);
    this.seq = seed.length;
  }

  subscribe(cb: (logs: AuditLog[]) => void): Unsubscribe {
    return this.store.subscribe(cb);
  }

  async append(entry: NewAuditLog): Promise<AuditLog> {
    const timestamp = new Date().toISOString();
    this.seq += 1;
    const log: AuditLog = { ...entry, id: `log-${this.seq}`, reference: makeReference(timestamp, this.seq), timestamp };
    this.store.set([log, ...this.store.get()]);
    return log;
  }
}

class InMemoryNoteRepository implements NoteRepository {
  private store: Store<OperationalNote> = createStore([]);
  private seq = 0;

  subscribe(entityType: OperationalNote['entityType'], entityId: string, cb: (notes: OperationalNote[]) => void): Unsubscribe {
    return this.store.subscribe((all) => cb(all.filter((n) => n.entityType === entityType && n.entityId === entityId)));
  }

  async add(note: NewNote): Promise<OperationalNote> {
    this.seq += 1;
    const created: OperationalNote = { ...note, id: `note-${this.seq}`, createdAt: new Date().toISOString() };
    this.store.set([...this.store.get(), created]);
    return created;
  }
}

export function createInMemoryRepositories(): Repositories {
  return { alerts: new InMemoryAlertRepository(), audit: new InMemoryAuditLogRepository(seedAudit()), notes: new InMemoryNoteRepository() };
}
