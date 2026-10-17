import 'server-only';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PublicationError, type PublicationStore } from './publication';
import { publicationEvents, safeActor } from './operationalEvents';
import type { PlanningStore } from './planning';
import type { ArchiveStore } from './archive';
import { publicationNotifications, supervisorRecipients } from './notifications';
import { progressEventId, progressMutation, type ProgressStore } from './taskProgress';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

export function adminConfiguration(env: NodeJS.ProcessEnv) {
  if (env.SAID_ROSTER_BACKEND !== 'firestore') throw new PublicationError(503,'Trusted publication is disabled.');
  const emulator = env.SAID_FIREBASE_EMULATORS_ENABLED === 'true';
  const projectId = env.SAID_FIREBASE_PROJECT_ID;
  if (!projectId || (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== projectId)) throw new PublicationError(503,'Server and client Firebase projects must match.');
  if (emulator) {
    const validHost = (value?: string) => { const match=/^(127\.0\.0\.1|localhost):([0-9]+)$/.exec(value ?? ''); return Boolean(match && Number(match[2]) > 0 && Number(match[2]) <= 65535); };
    if (projectId !== 'demo-said-5ce3e' || !validHost(env.FIREBASE_AUTH_EMULATOR_HOST) || !validHost(env.FIRESTORE_EMULATOR_HOST)) throw new PublicationError(503,'Server emulator mode requires demo-said-5ce3e and explicit loopback Auth/Firestore hosts.');
  } else if (projectId.startsWith('demo-') || env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST) {
    throw new PublicationError(503,'Production Admin configuration cannot use demo projects or emulator endpoints.');
  }
  return {emulator,projectId};
}

/** Stage 7A shares the existing verified Admin configuration and Auth boundary. */
export function planningStore(): PlanningStore {
  const publisher = publicationStore();
  const db = getFirestore(getApps().find(app => app.name === 'said-roster-publisher')!);
  return {
    verifyToken: publisher.verifyToken,
    read: publisher.read,
    write: async (path, actor, validate) => db.runTransaction(async transaction => {
      const ref = db.doc(path), snapshot = await transaction.get(ref);
      const current = snapshot.exists ? snapshot.data() : undefined;
      const fields = validate(current);
      const revision = Number(current?.revision ?? 0) + 1;
      transaction.set(ref, { ...fields, revision, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor,
        ...(!snapshot.exists ? { createdAt: FieldValue.serverTimestamp(), createdBy: actor } : {}) }, { merge: true });
      return { ...current, ...fields, revision }; // Read adapters obtain authoritative timestamp metadata.
    }),
  };
}

export function publicationStore(): PublicationStore {
  const {emulator,projectId} = adminConfiguration(process.env);
  const name = 'said-roster-publisher';
  const existing = getApps().find(app => app.name === name);
  if (existing && existing.options.projectId !== projectId) throw new PublicationError(503,'Restart the server after changing Firebase configuration.');
  const app = existing ?? initializeApp({projectId,...(emulator ? {} : {credential:serverCredential(process.env,projectId)})},name);
  const auth=getAuth(app), db=getFirestore(app);
  return {
    verifyToken:token=>auth.verifyIdToken(token, true),
    validAuthUser:async uid=>{try{return !(await auth.getUser(uid)).disabled;}catch{return false;}},
    read:async path=>{const result=await db.doc(path).get();return result.exists?result.data():undefined;},
    version:()=>randomUUID(),
    createSnapshot:async(week,version,items,actor)=>{
      const root=db.doc(`publishedRosters/${week}/versions/${version}`);
      const batch=db.batch();
      batch.create(root,{weekStart:week,version,itemCount:items.length,...(actor ? {publishedBy:actor} : {}),publishedAt:FieldValue.serverTimestamp()});
      for(const item of items) batch.create(root.collection('items').doc(String(item.scheduledWorkId)),item);
      await batch.commit();
    },
    // Code Attribution — Aaryan Makan (ST10259834), trusted roster publication.
    // This pointer switch follows Firestore's read-before-write transaction pattern,
    // committing the pointer, operational events and required inbox records atomically.
    // Firebase (n.d.) 'Transactions and batched writes'.
    // https://firebase.google.com/docs/firestore/manage-data/transactions
    // Accessed: 5 October 2026.
    switchCurrent:async(week,version,authoritative=[])=>{
      const root=db.doc(`publishedRosters/${week}`), snapshot=root.collection('versions').doc(version);
      await db.runTransaction(async transaction=>{
        const completed=await transaction.get(snapshot);
        const prior = await transaction.get(root);
        if (prior.data()?.archived === true) throw new PublicationError(409, 'Archived rosters are read-only.', 'ARCHIVED');
        const previousVersion = prior.data()?.currentVersion as string | undefined;
        const oldItems = previousVersion ? await transaction.get(root.collection(`versions/${previousVersion}/items`)) : undefined;
        const newItems = await transaction.get(snapshot.collection('items'));
        if(!completed.exists) throw new Error('Publication snapshot was not committed.');
        // Firestore retries this transaction if any read record changes before commit.
        // Compare full records, including legacy documents without revision metadata.
        if (authoritative.length) {
          const latest = await transaction.getAll(...authoritative.map(record => db.doc(record.path)));
          if (latest.some((record, index) => !isDeepStrictEqual(record.exists ? record.data() : undefined, authoritative[index].data)))
            throw new PublicationError(409, 'Workforce, locations or templates changed while publishing. Reload them and review the roster before retrying.', 'STALE_AUTHORITATIVE_DATA');
        }
        const actor = completed.data()?.publishedBy;
        if (!actor) throw new Error('Missing trusted publication actor.');
        if (previousVersion === version) return; // Retrying this committed switch never resets inbox read state.
        const before = oldItems?.docs.map(doc => doc.data()) ?? [], after = newItems.docs.map(doc => doc.data());
        const events = publicationEvents(week, version, previousVersion, before, after, actor);
        const supervisors = await transactionSupervisors(db, transaction);
        const notifications = publicationNotifications(events[0].id, { ...events[0].data, occurredAt: FieldValue.serverTimestamp() }, before, after, supervisors);
        const existingNotifications = notifications.length ? await transaction.getAll(...notifications.map(n => db.doc(n.path))) : [];
        for (const event of events) {
          transaction.create(db.doc('operationalEvents/' + event.id), { ...event.data, occurredAt: FieldValue.serverTimestamp(), recordedAt: FieldValue.serverTimestamp() });
        }
        notifications.forEach((n, index) => { if (!existingNotifications[index].exists) transaction.create(db.doc(n.path), n.data); });
        transaction.set(root,{weekStart:week,currentVersion:version,publishedBy:actor,publishedAt:FieldValue.serverTimestamp()});
      });
    },
  };
}

async function transactionSupervisors(db: Firestore, transaction: Transaction) {
  const employees = await transaction.get(db.collection('employees'));
  const roles = await transaction.get(db.collection('roles'));
  return supervisorRecipients(employees.docs.map(d => ({ id: d.id, data: d.data() })), roles.docs.map(d => ({ id: d.id, data: d.data() })));
}

export function progressStore(): ProgressStore {
  const publisher = publicationStore();
  const db = getFirestore(getApps().find(app => app.name === 'said-roster-publisher')!);
  return { verifyToken: publisher.verifyToken, commit: (uid, action) => db.runTransaction(async transaction => {
    const progressRef = db.doc(`employees/${uid}/taskProgress/${action.scheduledWorkId}`);
    const eventRef = db.doc(`operationalEvents/${progressEventId(uid, action.requestId)}`);
    const [employee, root, before, receipt] = await transaction.getAll(db.doc(`employees/${uid}`), db.doc(`publishedRosters/${action.weekStart}`), progressRef, eventRef);
    const roleId = employee.data()?.roleId, version = root.data()?.currentVersion;
    const role = typeof roleId === 'string' && roleId && !roleId.includes('/') ? await transaction.get(db.doc(`roles/${roleId}`)) : undefined;
    const item = typeof version === 'string' && version && !version.includes('/') ? await transaction.get(db.doc(`publishedRosters/${action.weekStart}/versions/${version}/items/${action.scheduledWorkId}`)) : undefined;
    const supervisors = action.status === 'Unable to Complete' && !receipt.exists ? await transactionSupervisors(db, transaction) : [];
    const mutation = progressMutation(uid, action, employee.data(), role?.data(), root.data(), item?.data(), before.data(), receipt.data(), supervisors, FieldValue.serverTimestamp());
    if (mutation.replay) return mutation.result;
    const existingNotifications = mutation.notifications.length ? await transaction.getAll(...mutation.notifications.map(n => db.doc(n.path))) : [];
    transaction.set(progressRef, mutation.progress);
    transaction.create(eventRef, mutation.event);
    mutation.notifications.forEach((n, index) => { if (!existingNotifications[index].exists) transaction.create(db.doc(n.path), n.data); });
    return mutation.result;
  }) };
}

export function serverCredential(env: NodeJS.ProcessEnv, projectId: string) {
  if (!env.SAID_FIREBASE_SERVICE_ACCOUNT_JSON) return applicationDefault();
  try {
    const data = JSON.parse(env.SAID_FIREBASE_SERVICE_ACCOUNT_JSON);
    if (data.type !== 'service_account' || data.project_id !== projectId || typeof data.client_email !== 'string' || typeof data.private_key !== 'string') throw new Error();
    return cert(data);
  } catch { throw new PublicationError(503, 'Invalid server-only Firebase service-account configuration.'); }
}

export function archiveStore(): ArchiveStore {
  const publisher = publicationStore();
  const db = getFirestore(getApps().find(app => app.name === 'said-roster-publisher')!);
  return { ...publisher, archive: async (week, version, actor, reason) => db.runTransaction(async transaction => {
    const ref = db.doc(`publishedRosters/${week}`);
    const [root, employee] = await transaction.getAll(ref, db.doc(`employees/${actor.uid}`));
    const profile = employee.data(), roleId = profile?.roleId;
    const role = typeof roleId === 'string' && roleId && !roleId.includes('/') ? await transaction.get(db.doc(`roles/${roleId}`)) : undefined;
    if (role?.data()?.name !== 'Supervisor/Administrator' || (role.data()?.id !== undefined && role.data()?.id !== roleId))
      throw new PublicationError(403, 'Supervisor access changed. Sign in again.');
    if (!root.exists || root.data()?.weekStart !== week || root.data()?.currentVersion !== version)
      throw new PublicationError(409, 'The publication changed. Refresh history before archiving.', 'STALE_PUBLICATION');
    if (root.data()?.archived === true) return; // Retry never replaces original attribution/reason.
    const snapshot = await transaction.get(ref.collection('versions').doc(version));
    if (!snapshot.exists) throw new PublicationError(409, 'Missing immutable publication.');
    const verifiedActor = safeActor(actor.uid, profile);
    if (JSON.stringify(verifiedActor) !== JSON.stringify(actor)) throw new PublicationError(409, 'Actor identity changed. Refresh and retry.');
    transaction.update(ref, { archived: true, archivedAt: FieldValue.serverTimestamp(), archivedBy: actor, ...(reason ? { archiveReason: reason } : {}) });
    transaction.create(db.doc(`operationalEvents/archive-${week}-${version}`), { type: 'RosterArchived', weekStart: week, publicationVersion: version, actor, actorProvenance: 'authenticated-supervisor', occurredAt: FieldValue.serverTimestamp(), recordedAt: FieldValue.serverTimestamp(), ...(reason ? { reason } : {}) });
  }) };
}
