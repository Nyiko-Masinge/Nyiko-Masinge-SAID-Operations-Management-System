// PROVISIONAL Firestore repositories: factory and every data operation are disabled
// until central integration approves operational input, identity, paths and permissions.
//
// The old browser-write implementation is retained only for integration review. It cannot
// run against live collections. Live detection/reconciliation needs trusted server logic.

import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { LIVE_MONITORING_PENDING } from './backend';
import { COLLECTIONS } from './collections';
import { SYSTEM_ACTOR } from './model';
import type { Actor, Alert, AuditLog, DetectedAlert, NewAuditLog, NewNote, OperationalNote, Unsubscribe } from './model';
import type { AlertRepository, AuditLogRepository, NoteRepository, Repositories } from './repositories';

function requireDb(): never {
  // PROVISIONAL: direct factory use cannot bypass the disabled live backend.
  throw new Error(LIVE_MONITORING_PENDING);
}

const toIso = (value: Timestamp | undefined): string => (value ? value.toDate().toISOString() : new Date().toISOString());
const optionalIso = (value: Timestamp | undefined): string | undefined => (value ? value.toDate().toISOString() : undefined);

/**
 * Listener errors (a missing index, a permissions problem, a dropped connection) end the listener.
 * Without an error callback Firestore reports nothing and the screen just looks empty, so every
 * subscription routes failures here so the caller can show them to the user.
 */
const listenerError = (what: string, onError?: (error: Error) => void) => (error: Error) => {
  onError?.(error);
};

/* -------------------------------- Alerts -------------------------------- */

const ALERTS = COLLECTIONS.alerts; // PROVISIONAL, see collections.ts

function alertFromDoc(snap: QueryDocumentSnapshot<DocumentData>): Alert {
  const d = snap.data();
  return {
    id: snap.id,
    key: d.key,
    origin: d.origin,
    type: d.type,
    priority: d.priority,
    state: d.state,
    title: d.title,
    details: d.details,
    area: d.area,
    dutyId: d.dutyId ?? undefined,
    staffIds: d.staffIds ?? undefined,
    raisedAt: toIso(d.raisedAt),
    resolvedAt: optionalIso(d.resolvedAt),
    resolvedBy: d.resolvedBy ?? undefined,
    resolutionNote: d.resolutionNote ?? undefined,
  };
}

class FirestoreAlertRepository implements AlertRepository {
  subscribe(cb: (alerts: Alert[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(collection(requireDb(), ALERTS), orderBy('raisedAt', 'desc'));
    // Code Attribution — Ndivhuwo Ndou (ST10281928), retained provisional adapter.
    // This subscription follows Firebase's onSnapshot/error-callback/unsubscribe API;
    // requireDb still blocks this legacy adapter in production.
    // Firebase (n.d.) 'Get realtime updates with Cloud Firestore'.
    // https://firebase.google.com/docs/firestore/query-data/listen
    // Accessed: 5 October 2026.
    return onSnapshot(q, (snap) => cb(snap.docs.map(alertFromDoc)), listenerError('Alerts', onError));
  }

  async resolve(ids: string[], by: Actor, note?: string): Promise<Alert[]> {
    if (ids.length === 0) return [];
    const database = requireDb();
    const snaps = await Promise.all(ids.map((id) => getDocs(query(collection(database, ALERTS), where('__name__', '==', id)))));
    const targets = snaps.flatMap((s) => s.docs).filter((d) => d.data().state !== 'Resolved');
    if (targets.length === 0) return [];

    const batch = writeBatch(database);
    for (const snap of targets) {
      batch.update(snap.ref, {
        state: 'Resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: by,
        ...(note ? { resolutionNote: note } : {}),
      });
    }
    await batch.commit();
    return targets.map((snap) => ({ ...alertFromDoc(snap), state: 'Resolved', resolvedAt: new Date().toISOString(), resolvedBy: by, resolutionNote: note }));
  }

  // TODO(Phase 2): move this into a Cloud Function that runs on roster writes, using the
  // Admin SDK, so alerts cannot be forged or missed by a client that is offline or slow.
  async sync(detected: DetectedAlert[]): Promise<void> {
    const database = requireDb();
    const openDetected = await getDocs(
      query(collection(database, ALERTS), where('origin', '==', 'Detected'), where('state', '!=', 'Resolved')),
    );
    const wanted = new Map(detected.map((d): [string, DetectedAlert] => [d.key, d]));
    const batch = writeBatch(database);
    let writes = 0;

    for (const snap of openDetected.docs) {
      const key = snap.data().key as string;
      const match = wanted.get(key);
      if (!match) {
        batch.update(snap.ref, {
          state: 'Resolved',
          resolvedAt: serverTimestamp(),
          resolvedBy: SYSTEM_ACTOR,
          resolutionNote: 'Cleared automatically: the roster no longer has this problem.',
        });
        writes++;
      } else {
        const d = snap.data();
        if (d.title !== match.title || d.details !== match.details || d.priority !== match.priority) {
          batch.update(snap.ref, { title: match.title, details: match.details, priority: match.priority });
          writes++;
        }
        wanted.delete(key); // already exists and is open: do not recreate
      }
    }

    // A key resolved by a person (not the system) blocks recreation until the person's
    // decision is superseded some other way; check the last resolved doc for that key.
    for (const [key, d] of wanted) {
      const resolvedByPerson = await getDocs(
        query(collection(database, ALERTS), where('key', '==', key), where('state', '==', 'Resolved'), limit(5)),
      );
      const overridden = resolvedByPerson.docs.some((s) => s.data().resolvedBy?.id !== SYSTEM_ACTOR.id);
      if (overridden) continue;
      const ref = doc(collection(database, ALERTS));
      batch.set(ref, { ...d, origin: 'Detected', state: 'Open', raisedAt: serverTimestamp() });
      writes++;
    }

    if (writes > 0) await batch.commit();
  }
}

/* ----------------------------- Audit log ----------------------------- */

const AUDIT_LOGS = COLLECTIONS.auditLogs; // PROVISIONAL, see collections.ts

function auditFromDoc(snap: QueryDocumentSnapshot<DocumentData>): AuditLog {
  const d = snap.data();
  return {
    id: snap.id,
    reference: d.reference,
    timestamp: toIso(d.timestamp),
    actor: d.actor,
    category: d.category,
    action: d.action,
    summary: d.summary,
    details: d.details,
    area: d.area,
    entityType: d.entityType,
    entityId: d.entityId ?? undefined,
    before: d.before ?? undefined,
    after: d.after ?? undefined,
  };
}

const makeReference = (date: Date, seq: number): string =>
  `SAID-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(seq).padStart(4, '0')}`;

class FirestoreAuditLogRepository implements AuditLogRepository {
  subscribe(cb: (logs: AuditLog[]) => void, onError?: (error: Error) => void): Unsubscribe {
    // Capped so one busy day cannot pull the whole history into every browser tab.
    const q = query(collection(requireDb(), AUDIT_LOGS), orderBy('timestamp', 'desc'), limit(500));
    return onSnapshot(q, (snap) => cb(snap.docs.map(auditFromDoc)), listenerError('History', onError));
  }

  async append(entry: NewAuditLog): Promise<AuditLog> {
    const database = requireDb();
    const now = new Date();
    const seq = Math.floor(Math.random() * 9000) + 1000; // collision risk is acceptable for a display reference only
    const reference = makeReference(now, seq);
    const ref = await addDoc(collection(database, AUDIT_LOGS), { ...entry, reference, timestamp: serverTimestamp() });
    return { ...entry, id: ref.id, reference, timestamp: now.toISOString() };
  }
}

/* -------------------------------- Notes -------------------------------- */

const NOTES = COLLECTIONS.notes; // PROVISIONAL, see collections.ts

function noteFromDoc(snap: QueryDocumentSnapshot<DocumentData>): OperationalNote {
  const d = snap.data();
  return { id: snap.id, entityType: d.entityType, entityId: d.entityId, text: d.text, author: d.author, createdAt: toIso(d.createdAt) };
}

class FirestoreNoteRepository implements NoteRepository {
  subscribe(entityType: OperationalNote['entityType'], entityId: string, cb: (notes: OperationalNote[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(
      collection(requireDb(), NOTES),
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
      orderBy('createdAt', 'asc'),
    );
    return onSnapshot(q, (snap) => cb(snap.docs.map(noteFromDoc)), listenerError('Notes', onError));
  }

  async add(note: NewNote): Promise<OperationalNote> {
    const ref = await addDoc(collection(requireDb(), NOTES), { ...note, createdAt: serverTimestamp() });
    return { ...note, id: ref.id, createdAt: new Date().toISOString() };
  }
}

export function createFirestoreRepositories(): Repositories {
  requireDb();
  return { alerts: new FirestoreAlertRepository(), audit: new FirestoreAuditLogRepository(), notes: new FirestoreNoteRepository() };
}
