// Pure trusted-boundary logic, injected for deterministic tests. Admin access lives in admin.ts.
import { safeActor, type SafeActor } from './operationalEvents';
import { validWeek } from '../roster/week';
import { datesForWeek } from '../roster/mock';
import { validAvailability, validStringList } from '../planning/model';
import { availableForWork, coverageIssue, timeOverlaps, validRequiredStaff, type CoverageIssue } from '../roster/scheduling';

export class PublicationError extends Error {
  constructor(public readonly status: number, message: string, public readonly code = 'MALFORMED_DATA', public readonly coverageIssues: CoverageIssue[] = []) { super(message); }
}
export type RecordData = Record<string, unknown>;
export type PublicationStore = {
  verifyToken: (token: string) => Promise<{ uid: string }>;
  read: (path: string) => Promise<RecordData | undefined>;
  validAuthUser: (uid: string) => Promise<boolean>;
  createSnapshot: (week: string, version: string, items: RecordData[], actor?: SafeActor) => Promise<void>;
  switchCurrent: (week: string, version: string, authoritative?: { path: string; data: RecordData | undefined }[]) => Promise<void>;
  version: () => string;
};
export const MAX_PUBLICATION_ITEMS = 400;
function fail(message: string): never { throw new PublicationError(400, message); }
function record(value: unknown): RecordData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Invalid publication object.');
  return value as RecordData;
}
function keys(data: RecordData, allowed: string[]) {
  if (Object.keys(data).some(key => !allowed.includes(key))) fail('Unexpected publication fields. Private/team projections must not be supplied by clients.');
}
function text(value: unknown, name: string, limit = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) return fail(`${name} must be nonblank and at most ${limit} characters.`);
  return value.trim();
}
function id(value: unknown, name: string): string {
  const result = text(value, name, 128);
  if (result.includes('/') || result === '.' || result === '..') return fail(`Invalid ${name}.`);
  return result;
}
function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0,10) !== value) return fail('Invalid work date.');
  return value;
}
function time(value: unknown): string {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return fail('Invalid work time.');
  return value;
}

export async function authorizePublisher(authorization: string | null, store: PublicationStore): Promise<string> {
  const match = /^Bearer (\S+)$/.exec(authorization ?? '');
  if (!match) throw new PublicationError(401, 'Sign in as a supervisor before publishing.');
  let uid: string;
  try { uid = (await store.verifyToken(match[1])).uid; }
  catch { throw new PublicationError(401, 'Your session is invalid or expired. Sign in again.'); }
  const employee = await store.read(`employees/${uid}`);
  const roleId = employee?.roleId;
  const role = typeof roleId === 'string' && roleId && !roleId.includes('/') ? await store.read(`roles/${roleId}`) : undefined;
  if (!role || role.name !== 'Supervisor/Administrator' || (role.id !== undefined && role.id !== roleId)) {
    throw new PublicationError(403, 'Only Supervisor/Administrator may publish rosters.');
  }
  return uid;
}

export async function publishTrusted(authorization: string | null, input: unknown, store: PublicationStore) {
  const cache = new Map<string, Promise<RecordData | undefined>>();
  const read = (path: string) => { if (!cache.has(path)) cache.set(path, store.read(path)); return cache.get(path)!; };
  const actorUid = await authorizePublisher(authorization, { ...store, read });
  const actor = safeActor(actorUid, await read(`employees/${actorUid}`));
  const payload = record(input);
  keys(payload, ['weekStart','items','confirmCoverage']);
  const weekStart = date(payload.weekStart);
  if (!validWeek(weekStart)) fail('weekStart must be a valid Monday.');
  if ((await read(`publishedRosters/${weekStart}`))?.archived === true) throw new PublicationError(409, 'Archived rosters are read-only.', 'ARCHIVED');
  if (typeof payload.confirmCoverage !== 'boolean') fail('confirmCoverage must be boolean.');
  if (!Array.isArray(payload.items) || payload.items.length > MAX_PUBLICATION_ITEMS) fail(`Publication requires an items array of at most ${MAX_PUBLICATION_ITEMS} items.`);
  const dates = new Set(datesForWeek(weekStart));
  const ids = new Set<string>();
  const authUsers = new Map<string, Promise<boolean>>();
  const validAuthUser = (uid: string) => { if (!authUsers.has(uid)) authUsers.set(uid, store.validAuthUser(uid)); return authUsers.get(uid)!; };
  const items: RecordData[] = [];
  const coverageIssues: CoverageIssue[] = [];
  const businessIdentities = new Map<string, string>();
  for (const value of payload.items) {
    const row = record(value);
    keys(row, ['scheduledWorkId','date','title','description','startTime','endTime','locationId','requiredStaff','isCritical','dutyId','priority','assignedEmployees']);
    const scheduledWorkId = id(row.scheduledWorkId, 'scheduledWorkId');
    if (ids.has(scheduledWorkId)) fail(`Duplicate scheduledWorkId: ${scheduledWorkId}.`);
    ids.add(scheduledWorkId);
    const workDate = date(row.date);
    if (!dates.has(workDate)) fail('Work date is outside the selected week.');
    const startTime = time(row.startTime), endTime = time(row.endTime);
    if (startTime >= endTime) fail('startTime must be before endTime.');
    const title = text(row.title,'title');
    if (typeof row.description !== 'string' || row.description.length > 4000) fail('Invalid description.');
    const locationId = id(row.locationId,'locationId');
    const location = await read(`locations/${locationId}`);
    if (!location || typeof location.name !== 'string' || !location.name.trim() || location.active === false ||
        (location.active !== undefined && typeof location.active !== 'boolean') ||
        (location.id !== undefined && location.id !== locationId)) throw new PublicationError(400, `Location ${locationId} is missing, invalid or retired. Select an active area before publishing.`, 'INVALID_LOCATION');
    const requiredStaff = row.requiredStaff;
    if (!validRequiredStaff(requiredStaff)) throw new PublicationError(400, 'Required staff must be a whole number from 1 to 100.', 'INVALID_STAFFING');
    if (typeof row.isCritical !== 'boolean') fail('isCritical must be boolean.');
    if (!Array.isArray(row.assignedEmployees) || row.assignedEmployees.length > 100) fail('Invalid assignedEmployees.');
    let template: RecordData | undefined;
    const dutyId = row.dutyId === undefined ? undefined : id(row.dutyId, 'dutyId');
    if (dutyId) {
      template = await read(`dutyTemplates/${dutyId}`);
      if (!template || template.active !== true || typeof template.isCritical !== 'boolean' ||
          !validStringList(template.requiredSkills) || !validStringList(template.requirements, 32, 500) ||
          !validRequiredStaff(template.requiredStaff) || !['High','Medium','Low'].includes(String(template.priority)) ||
          typeof template.name !== 'string' || !template.name.trim() || typeof template.description !== 'string' ||
          typeof template.locationId !== 'string' || !template.locationId || template.locationId.includes('/'))
        throw new PublicationError(409, 'The source template is missing, inactive or needs repair. Reload templates before publishing.', 'STALE_AUTHORITATIVE_DATA');
    }
    const assignedUids: string[] = [], team: RecordData[] = [];
    for (const assigned of row.assignedEmployees) {
      const ref = record(assigned); keys(ref,['uid','employeeId']);
      const uid = id(ref.uid,'employee UID'), employeeId = text(ref.employeeId,'employeeId');
      if (assignedUids.includes(uid)) fail(`Duplicate assigned UID: ${uid}.`);
      const profile = await read(`employees/${uid}`);
      if (!profile || profile.employeeId !== employeeId || typeof profile.firstName !== 'string' || typeof profile.surname !== 'string' ||
          !`${profile.firstName} ${profile.surname}`.trim() || typeof profile.roleId !== 'string' || !profile.roleId || profile.roleId.includes('/') ||
          (profile.uid !== undefined && profile.uid !== uid) ||
          !(await validAuthUser(uid))) throw new PublicationError(400, `Employee ${employeeId} has no valid provisioned Auth/profile identity.`, 'INVALID_EMPLOYEE');
      const assignedRole=await read(`roles/${profile.roleId}`);
      if (!assignedRole || !['Staff Member','Supervisor/Administrator'].includes(String(assignedRole.name)) ||
          (assignedRole.id !== undefined && assignedRole.id !== profile.roleId) || team.some(person=>person.employeeId===employeeId) ||
          (businessIdentities.has(employeeId) && businessIdentities.get(employeeId) !== uid))
        throw new PublicationError(400, `Employee ${employeeId} has an invalid role or duplicate business identity.`, 'INVALID_EMPLOYEE');
      businessIdentities.set(employeeId, uid);
      if (profile.active === false) throw new PublicationError(400, `Employee ${employeeId} is inactive. Assign an active employee before publishing.`, 'INACTIVE_EMPLOYEE');
      if (profile.active !== true || !validAvailability(profile.availability) || !validStringList(profile.skills) ||
          typeof profile.jobCategory !== 'string' || !profile.jobCategory.trim() || profile.jobCategory.length > 120 ||
          typeof profile.locationId !== 'string' || !profile.locationId.trim() || profile.locationId.includes('/'))
        throw new PublicationError(400, `Employee ${employeeId} needs a complete operational profile. Reload workforce or ask an administrator to repair it.`, 'INVALID_EMPLOYEE');
      if (!availableForWork(profile.availability, { date: workDate, startTime, endTime }))
        throw new PublicationError(400, `Employee ${employeeId} is unavailable during ${title} on ${workDate} (${startTime}–${endTime}).`, 'UNAVAILABLE_EMPLOYEE');
      assignedUids.push(uid);
      team.push({employeeId,displayName:`${profile.firstName} ${profile.surname}`.trim(),jobCategory:typeof profile.jobCategory === 'string' ? profile.jobCategory : 'Staff'});
    }
    const isCritical = row.isCritical || template?.isCritical === true;
    const item: RecordData = {scheduledWorkId,weekStart,date:workDate,title,description:row.description,startTime,endTime,locationId,requiredStaff,assignedUids,isCritical,team};
    if (dutyId) {
      item.dutyId = dutyId;
      item.requiredSkills = [...template!.requiredSkills as string[]];
      item.requirements = [...template!.requirements as string[]];
      item.priority = row.priority ?? template!.priority;
    }
    if (row.priority !== undefined) {
      if (!item.dutyId || !['High','Medium','Low'].includes(String(row.priority))) fail('Only template-backed work may supply a High/Medium/Low priority.');
      item.priority = row.priority;
    }
    items.push(item);
    const issue = coverageIssue({ id: scheduledWorkId, title, isCritical, required: requiredStaff, staffIds: assignedUids },
      (item.requiredSkills ?? []) as string[], await Promise.all(assignedUids.map(async uid => (await read(`employees/${uid}`))!.skills as string[])));
    if (issue) coverageIssues.push(issue);
  }
  // All identities/profile/area checks complete before any coverage override is considered.
  for (let first = 0; first < items.length; first++) for (let second = first + 1; second < items.length; second++) {
    const a = items[first], b = items[second];
    if (timeOverlaps(a as unknown as {date:string;startTime:string;endTime:string}, b as unknown as {date:string;startTime:string;endTime:string}) &&
        (a.assignedUids as string[]).some(uid => (b.assignedUids as string[]).includes(uid)))
      throw new PublicationError(400, `Overlapping assignments: ${a.title} and ${b.title} on ${a.date}. Resolve the conflicting times before publishing.`, 'OVERLAP');
  }
  const warnings = coverageIssues.map(issue => `${issue.title}: ${issue.assigned}/${issue.required} staff${issue.missingSkills.length ? `; missing skills: ${issue.missingSkills.join(', ')}` : ''}${issue.isCritical ? ' (Critical)' : ''}.`);
  if (!payload.confirmCoverage && coverageIssues.length)
    throw new PublicationError(400, 'Unresolved staffing or required skills need explicit Publish Anyway confirmation. Review these issues first.', 'COVERAGE_CONFIRMATION_REQUIRED', coverageIssues);
  const version = store.version();
  await store.createSnapshot(weekStart, version, items, actor);
  await store.switchCurrent(weekStart, version, await Promise.all([...cache].map(async ([path, data]) => ({ path, data: await data }))));
  // Last: reject changed authoritative facts atomically with the pointer switch.
  return {weekStart,version,itemCount:items.length,warnings,coverageIssues,items};
}
