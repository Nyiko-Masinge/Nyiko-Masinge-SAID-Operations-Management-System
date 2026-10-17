import { validAvailability, validStringList, revisionOf, type WorkforceFields, type TemplateFields } from '../planning/model';
import { daysForRecurrence, endFromDuration } from '../roster/generation';
import { validRequiredStaff } from '../roster/scheduling';

export class PlanningError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export type PlanningData = Record<string, unknown>;
export type PlanningStore = {
  verifyToken: (token: string) => Promise<{ uid: string }>;
  read: (path: string) => Promise<PlanningData | undefined>;
  // Atomic revision check and metadata. Callback runs against the current record.
  write: (path: string, actor: string, validate: (current: PlanningData | undefined) => PlanningData) => Promise<PlanningData>;
};
const fail = (message: string): never => { throw new PlanningError(400, message); };
function object(value: unknown): PlanningData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Invalid planning object.');
  return value as PlanningData;
}
function only(data: PlanningData, allowed: readonly string[]) {
  if (Object.keys(data).some(key => !allowed.includes(key))) fail('Unexpected or protected planning fields.');
}
function text(value: unknown, label: string, limit: number, blank = false): string {
  if (typeof value !== 'string' || (!blank && !value.trim()) || value.length > limit) fail(`Invalid ${label}.`);
  return (value as string).trim();
}
function id(value: unknown): string {
  const result = text(value, 'record identity', 128);
  if (result.includes('/') || result === '.' || result === '..') fail('Invalid record identity.');
  return result;
}
async function authorize(authorization: string | null, store: PlanningStore): Promise<string> {
  const token = /^Bearer (\S+)$/.exec(authorization ?? '')?.[1];
  if (!token) throw new PlanningError(401, 'Sign in as a supervisor to maintain planning records.');
  let uid: string;
  try { uid = id((await store.verifyToken(token)).uid); }
  catch { throw new PlanningError(401, 'Your session is invalid or expired. Sign in again.'); }
  const employee = await store.read(`employees/${uid}`);
  const roleId = employee?.roleId;
  const role = typeof roleId === 'string' && roleId && !roleId.includes('/') ? await store.read(`roles/${roleId}`) : undefined;
  if (role?.name !== 'Supervisor/Administrator' || (role.id !== undefined && role.id !== roleId))
    throw new PlanningError(403, 'Only Supervisor/Administrator may maintain planning records.');
  return uid;
}
async function location(value: unknown, current: PlanningData | undefined, store: PlanningStore): Promise<string> {
  const locationId = id(value);
  const area = await store.read(`locations/${locationId}`);
  if (!area || typeof area.name !== 'string' || !area.name.trim() ||
      (area.active !== undefined && typeof area.active !== 'boolean') ||
      (area.id !== undefined && area.id !== locationId) || (area.active === false && current?.locationId !== locationId))
    fail('Select a valid active location. An existing retired reference may be retained.');
  return locationId;
}
function checkRevision(current: PlanningData | undefined, expected: unknown, creating: boolean) {
  if (!Number.isSafeInteger(expected) || Number(expected) < 0) fail('Invalid expected revision.');
  if (creating ? Boolean(current) : !current) throw new PlanningError(409, 'Planning record changed or no longer exists. Reload before saving.');
  if ((current ? revisionOf(current) : 0) !== expected) throw new PlanningError(409, 'Another supervisor changed this record. Reload before saving.');
}

export async function writeWorkforce(authorization: string | null, input: unknown, store: PlanningStore) {
  const actor = await authorize(authorization, store), payload = object(input);
  only(payload, ['uid', 'expectedRevision', 'fields']);
  const uid = id(payload.uid), fields = object(payload.fields);
  only(fields, ['jobCategory', 'locationId', 'active', 'availability', 'skills']);
  const current = await store.read(`employees/${uid}`);
  if (!current) throw new PlanningError(404, 'Employee must first be provisioned by an administrator.');
  const next = { ...current, ...fields };
  const jobCategory = text(next.jobCategory, 'job category', 120);
  const locationId = await location(next.locationId, current, store);
  if (typeof next.active !== 'boolean') fail('Choose active or inactive explicitly.');
  if (!validAvailability(next.availability)) fail('Availability requires a normal state and valid effective window.');
  if (!validStringList(next.skills)) fail('Skills must be unique nonblank labels: at most 32, each at most 80 characters.');
  const approved: WorkforceFields = { jobCategory, locationId, active: next.active as boolean,
    availability: next.availability as WorkforceFields['availability'], skills: next.skills as string[] };
  return store.write(`employees/${uid}`, actor, record => {
    checkRevision(record, payload.expectedRevision, false);
    // Identity is never accepted from the client and never rewritten by this operation.
    if (!record || typeof record.employeeId !== 'string' || !record.employeeId.trim() ||
        typeof record.firstName !== 'string' || typeof record.surname !== 'string' || typeof record.roleId !== 'string')
      return fail('Employee identity needs trusted provisioning repair.');
    if (record.employeeId !== current.employeeId || record.roleId !== current.roleId || record.locationId !== current.locationId)
      throw new PlanningError(409, 'Employee changed during saving. Reload before saving.');
    return { ...approved };
  });
}

export async function writeTemplate(authorization: string | null, input: unknown, store: PlanningStore) {
  const actor = await authorize(authorization, store), payload = object(input);
  only(payload, ['templateId', 'expectedRevision', 'create', 'fields']);
  const templateId = id(payload.templateId), fields = object(payload.fields);
  if (typeof payload.create !== 'boolean') fail('Choose create or edit.');
  only(fields, ['name', 'description', 'locationId', 'defaultStartTime', 'durationMinutes', 'recurrence', 'requiredStaff', 'priority', 'isCritical', 'active', 'requiredSkills', 'requirements']);
  const current = await store.read(`dutyTemplates/${templateId}`), next = { ...current, ...fields };
  const name = text(next.name, 'template name', 200), description = text(next.description, 'description', 4000, true);
  const locationId = await location(next.locationId, current, store);
  if (typeof next.defaultStartTime !== 'string' || !Number.isSafeInteger(next.durationMinutes) ||
      !endFromDuration(next.defaultStartTime, `${next.durationMinutes} min`)) fail('Default time and duration must end before midnight.');
  if (typeof next.recurrence !== 'string' || !daysForRecurrence(next.recurrence)) fail('Unsupported recurrence.');
  if (!validRequiredStaff(next.requiredStaff)) fail('Required staff must be from 1 to 100.');
  if (!['High', 'Medium', 'Low'].includes(String(next.priority))) fail('Invalid priority.');
  if (typeof next.isCritical !== 'boolean' || typeof next.active !== 'boolean') fail('Critical and active must be explicit booleans.');
  if (!validStringList(next.requiredSkills) || !validStringList(next.requirements, 32, 500)) fail('Invalid skills or checklist. Keep them separate, unique and bounded.');
  const approved: TemplateFields = { name, description, locationId, defaultStartTime: next.defaultStartTime as string,
    durationMinutes: next.durationMinutes as number, recurrence: next.recurrence as string,
    requiredStaff: next.requiredStaff as number, priority: next.priority as TemplateFields['priority'],
    isCritical: next.isCritical as boolean, active: next.active as boolean,
    requiredSkills: next.requiredSkills as string[], requirements: next.requirements as string[] };
  return store.write(`dutyTemplates/${templateId}`, actor, record => {
    checkRevision(record, payload.expectedRevision, payload.create as boolean);
    return { ...approved };
  });
}
