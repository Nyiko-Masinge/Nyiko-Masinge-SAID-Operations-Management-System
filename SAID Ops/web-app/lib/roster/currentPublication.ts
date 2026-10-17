import { collection, doc, getDocFromServer, getDocsFromServer } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '../firebase';
import { firestoreRosterEnabled } from './backend';
import { validWeek } from './week';
import { datesForWeek } from './mock';
import type { DutyTemplate, ScheduledWork } from './types';
import type { Staff } from '../../components/OpsProvider';
import type { Location } from '../locations';
import { validStringList } from '../planning/model';

type TeamMember = { employeeId: string; displayName: string; jobCategory: string };
export type CurrentItem = Omit<ScheduledWork, 'area' | 'staffIds'> & { locationId: string; assignedUids: string[]; team: TeamMember[] };
export type CurrentPublication = ({ status: 'EMPTY'; items: [] } | { status: 'DATA'; version: string; items: CurrentItem[] }) & { archived?: boolean };
export type CurrentPublicationReader = {
  metadata: (week: string) => Promise<Record<string, unknown> | undefined>;
  items: (week: string, version: string) => Promise<{ id: string; data: Record<string, unknown> }[]>;
};
const reader: CurrentPublicationReader = {
  metadata: async week => {
    const value = await getDocFromServer(doc(getFirebaseDb(), 'publishedRosters', week));
    return value.exists() ? value.data() : undefined;
  },
  items: async (week, version) => {
    const value = await getDocsFromServer(collection(getFirebaseDb(), 'publishedRosters', week, 'versions', version, 'items'));
    return value.docs.map(item => ({ id: item.id, data: item.data() }));
  },
};
const segment = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim()) && !value.includes('/') && value !== '.' && value !== '..';
const time = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function mapPublicationItem(id: string, data: Record<string, unknown>, week: string): CurrentItem {
  if (!segment(id) || data.scheduledWorkId !== id || data.weekStart !== week ||
      typeof data.date !== 'string' || !datesForWeek(week).includes(data.date) ||
      !time(data.startTime) || !time(data.endTime) || data.startTime >= data.endTime ||
      typeof data.title !== 'string' || !data.title.trim() || typeof data.description !== 'string' ||
      !segment(data.locationId) || !Number.isInteger(data.requiredStaff) || Number(data.requiredStaff) < 1 || Number(data.requiredStaff) > 100 ||
      typeof data.isCritical !== 'boolean' || !Array.isArray(data.assignedUids) ||
      data.assignedUids.some(uid => !segment(uid)) || new Set(data.assignedUids).size !== data.assignedUids.length ||
      !Array.isArray(data.team) || data.team.length !== data.assignedUids.length ||
      (data.dutyId !== undefined && !segment(data.dutyId)) ||
      (data.priority !== undefined && (!data.dutyId || !['High', 'Medium', 'Low'].includes(String(data.priority)))) ||
      (data.requiredSkills !== undefined && !validStringList(data.requiredSkills)) ||
      (data.requirements !== undefined && !validStringList(data.requirements, 32, 500))) {
    throw new Error('Invalid current publication item.');
  }
  const team = data.team.map(person => {
    if (!person || typeof person !== 'object' || !segment(person.employeeId) ||
        typeof person.displayName !== 'string' || !person.displayName.trim() || typeof person.jobCategory !== 'string') {
      throw new Error('Invalid published assignment identity.');
    }
    // Stage 6B's trusted publisher emits safe team members in assignedUids order.
    return { employeeId: person.employeeId, displayName: person.displayName, jobCategory: person.jobCategory };
  });
  if (new Set(team.map(person => person.employeeId)).size !== team.length) throw new Error('Duplicate published Employee ID.');
  return { id, title: data.title, description: data.description, date: data.date,
    startTime: data.startTime, endTime: data.endTime, locationId: data.locationId,
    required: Number(data.requiredStaff), isCritical: data.isCritical, assignedUids: [...data.assignedUids], team,
    ...(data.requiredSkills ? { requiredSkills: [...data.requiredSkills as string[]] } : {}),
    ...(data.requirements ? { requirements: [...data.requirements as string[]] } : {}),
    ...(data.dutyId !== undefined ? { dutyId: data.dutyId as string } : {}),
    ...(data.priority !== undefined ? { priority: data.priority as DutyTemplate['priority'] } : {}) };
}

/** Stage 6B current-version snapshot, with a pointer recheck. Execution progress is never read. */
export async function readCurrentRosterPublication(week: string, source = reader, historical = false): Promise<CurrentPublication> {
  if (!firestoreRosterEnabled) return { status: 'EMPTY', items: [] };
  const auth = getFirebaseAuth(), owner = auth.currentUser;
  if (!owner || !validWeek(week)) throw new Error('A signed-in supervisor and valid Monday are required.');
  for (let attempt = 0; attempt < 2; attempt++) {
    const metadata = await source.metadata(week);
    if (auth.currentUser !== owner) throw new Error('Session changed.');
    if (!metadata) return { status: 'EMPTY', items: [] };
    const version = metadata.currentVersion;
    if (metadata.weekStart !== week || !segment(version)) throw new Error('Invalid current publication metadata.');
    if (metadata.archived === true && !historical) return { status: 'EMPTY', items: [], archived: true };
    let rows;
    try { rows = await source.items(week, version); }
    catch (error) {
      const latest = await source.metadata(week);
      if (auth.currentUser !== owner) throw new Error('Session changed.');
      if (attempt === 0 && latest?.currentVersion !== version) continue;
      throw error;
    }
    const latest = await source.metadata(week);
    if (auth.currentUser !== owner) throw new Error('Session changed.');
    if (latest?.currentVersion !== version) { if (!attempt) continue; throw new Error('Roster changed while loading.'); }
    if (latest.archived === true && !historical) return { status: 'EMPTY', items: [], archived: true };
    if (rows.length > 400 || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Invalid publication size or identity.');
    const items = rows.map(row => mapPublicationItem(row.id, row.data, week)).sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
    return { status: 'DATA', version, items, ...(latest.archived === true ? { archived: true } : {}) }; // An empty published version is still Published.
  }
  throw new Error('Reload the current publication.');
}

export function restoreRosterItems(items: readonly CurrentItem[], workforce: readonly Staff[], locations: readonly Location[], templates: readonly DutyTemplate[]) {
  const staff = [...workforce], duties = [...templates];
  const scheduled: ScheduledWork[] = items.map(item => {
    const { assignedUids, team, ...work } = item;
    const area = locations.find(location => location.id === item.locationId)?.name ?? item.locationId;
    const staffIds = assignedUids.map((uid, index) => {
      const identity = team[index];
      const person = staff.find(row => row.uid === uid && row.employeeId === identity.employeeId);
      if (person) return person.id;
      const fallback: Staff = { id: `published-uid:${uid}`, uid, employeeId: identity.employeeId,
        name: `${identity.displayName} (${identity.employeeId}; unresolved UID ${uid})`, role: identity.jobCategory,
        locationId: item.locationId, status: 'Inactive', availability: 'Unavailable', workload: 0,
        email: '', phone: '', skills: [], publicationFallback: true };
      if (staff.some(row => row.id === fallback.id)) throw new Error('Conflicting published staff identity.');
      staff.push(fallback);
      return fallback.id;
    });
    if (work.dutyId && !duties.some(duty => duty.id === work.dutyId)) {
      // Minimum session-only source reference for editing/republishing an existing occurrence.
      // Inactive prevents this recovered reference from generating new recurring work.
      duties.push({ id: work.dutyId, name: work.title, description: work.description, area, locationId: work.locationId,
        time: work.startTime, duration: `${(Number(work.endTime.slice(0,2))*60+Number(work.endTime.slice(3)))-(Number(work.startTime.slice(0,2))*60+Number(work.startTime.slice(3)))} min`,
        required: work.required, priority: work.priority ?? 'Medium', isCritical: work.isCritical,
        recurrence: 'Published occurrence', status: 'Inactive', requiredSkills: [...(work.requiredSkills ?? [])], requirements: [...(work.requirements ?? [])], publicationFallback: true });
    }
    return { ...work, area, staffIds };
  });
  return { scheduled, staff, duties };
}
