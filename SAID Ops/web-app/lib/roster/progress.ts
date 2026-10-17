import { collection, doc, getDocFromServer, getDocsFromServer } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '../firebase';
import { firestoreRosterEnabled } from './backend';

export type Execution = {
  scheduledWorkId: string; uid: string; displayName: string; employeeId: string; title: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Unable to Complete';
  unableToCompleteReason?: string; updatedAt?: string; publicationVersion: string; progressVersion?: string;
};
export type ExecutionRead = {status: 'DATA' | 'EMPTY'; version?: string; rows: Execution[]};
export async function readSupervisorProgress(week: string, historical = false): Promise<ExecutionRead> {
  if (!firestoreRosterEnabled) return {status: 'EMPTY', rows: []};
  const auth = getFirebaseAuth(), user = auth.currentUser;
  if (!user || !/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error('Refresh progress after signing in.');
  const db = getFirebaseDb(), metadataRef = doc(db, 'publishedRosters', week);
  for (let attempt = 0; attempt < 2; attempt++) {
    const metadata = await getDocFromServer(metadataRef);
    if (!metadata.exists()) return {status: 'EMPTY', rows: []};
    if (metadata.data().archived === true && !historical) return {status: 'EMPTY', rows: []};
    const version = metadata.data().currentVersion;
    if (metadata.data().weekStart !== week || typeof version !== 'string' || !version || version.includes('/')) throw new Error('Invalid publication.');
    const items = await getDocsFromServer(collection(db, 'publishedRosters', week, 'versions', version, 'items'));
    const groups = await Promise.all(items.docs.map(async item => {
      const data = item.data();
      if (data.scheduledWorkId !== item.id || data.weekStart !== week || typeof data.title !== 'string' ||
          !Array.isArray(data.assignedUids) || !Array.isArray(data.team) || data.team.length !== data.assignedUids.length) throw new Error('Invalid published assignment.');
      return Promise.all(data.assignedUids.map(async (uid: string, index: number): Promise<Execution> => {
        const person = data.team[index]; // Trusted publisher emits team in assignedUids order.
        if (typeof uid !== 'string' || !uid || uid.includes('/') || typeof person?.displayName !== 'string' || typeof person?.employeeId !== 'string') throw new Error('Invalid published identity.');
        const snapshot = await getDocFromServer(doc(db, 'employees', uid, 'taskProgress', item.id));
        const progress = snapshot.exists() ? snapshot.data() : undefined;
        if (progress && (progress.scheduledWorkId !== item.id || progress.weekStart !== week ||
            typeof progress.publicationVersion !== 'string' || !progress.publicationVersion || progress.publicationVersion.includes('/') ||
            !['In Progress','Completed','Unable to Complete'].includes(progress.status) ||
            typeof progress.updatedAt?.toDate !== 'function' ||
            (progress.unableToCompleteReason !== undefined && typeof progress.unableToCompleteReason !== 'string') ||
            (progress.status === 'Unable to Complete' && !progress.unableToCompleteReason?.trim()))) throw new Error('Invalid task progress.');
        return {scheduledWorkId: item.id, uid, displayName: person.displayName, employeeId: person.employeeId, title: data.title,
          status: progress?.status ?? 'Scheduled', publicationVersion: version,
          ...(progress ? {progressVersion: progress.publicationVersion, updatedAt: progress.updatedAt.toDate().toISOString(),
            ...(typeof progress.unableToCompleteReason === 'string' ? {unableToCompleteReason: progress.unableToCompleteReason} : {})} : {})};
      }));
    }));
    const latest = await getDocFromServer(metadataRef);
    if (auth.currentUser !== user) throw new Error('Session changed.');
    if (latest.data()?.currentVersion !== version) { if (!attempt) continue; throw new Error('Roster changed. Refresh progress.'); }
    if (latest.data()?.archived === true && !historical) return {status: 'EMPTY', rows: []};
    const rows = groups.flat().sort((a,b) => a.scheduledWorkId.localeCompare(b.scheduledWorkId) || a.employeeId.localeCompare(b.employeeId));
    return {status: rows.length ? 'DATA' : 'EMPTY', version, rows};
  }
  throw new Error('Refresh progress.');
}
