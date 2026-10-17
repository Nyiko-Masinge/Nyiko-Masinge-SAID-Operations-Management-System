import type { User } from 'firebase/auth';
import type { TemplateFields, WorkforceFields } from './model';

async function save(user: User, endpoint: string, payload: unknown): Promise<Record<string, unknown>> {
  const token = await user.getIdToken();
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Planning save failed. Reload and retry.');
  if (!Number.isSafeInteger(data.revision) || data.revision < 1) throw new Error('Invalid save response. Reload to confirm the persisted values.');
  return data;
}
export const persistWorkforce = (user: User, uid: string, expectedRevision: number, fields: Partial<WorkforceFields>) =>
  save(user, '/api/planning/workforce', { uid, expectedRevision, fields });
export const persistTemplate = (user: User, templateId: string, expectedRevision: number, create: boolean, fields: TemplateFields) =>
  save(user, '/api/planning/templates', { templateId, expectedRevision, create, fields });
