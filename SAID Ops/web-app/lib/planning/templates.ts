import { collection, getDocsFromServer } from 'firebase/firestore';
import { getFirebaseDb } from '../firebase';
import { revisionOf, validStringList, type TemplateFields } from './model';
import { validateTemplate } from '../roster/templates';
import type { DutyTemplate } from '../roster/types';

export function mapTemplate(id: string, data: Record<string, unknown>): DutyTemplate {
  const result: DutyTemplate = {
    id, name: data.name as string, description: data.description as string, area: data.locationId as string,
    locationId: data.locationId as string, time: data.defaultStartTime as string,
    duration: `${data.durationMinutes} min`, required: data.requiredStaff as number,
    recurrence: data.recurrence as string, priority: data.priority as DutyTemplate['priority'],
    isCritical: data.isCritical as boolean, status: data.active === true ? 'Active' : 'Inactive',
    requirements: data.requirements as string[], requiredSkills: data.requiredSkills as string[], revision: revisionOf(data),
  };
  if (typeof data.name !== 'string' || typeof data.description !== 'string' || typeof data.locationId !== 'string' ||
      !data.locationId || typeof data.active !== 'boolean' || !validStringList(data.requiredSkills) ||
      !validStringList(data.requirements, 32, 500) || !validateTemplate(result, []).ok)
    throw new Error('A persisted template is invalid. Ask an administrator to repair its planning fields.');
  return result;
}
export async function loadTemplates(): Promise<DutyTemplate[]> {
  const snapshot = await getDocsFromServer(collection(getFirebaseDb(), 'dutyTemplates'));
  return snapshot.docs.map(record => mapTemplate(record.id, record.data()));
}
export function templateFields(duty: DutyTemplate): TemplateFields {
  return { name: duty.name, description: duty.description, locationId: duty.locationId ?? '',
    defaultStartTime: duty.time, durationMinutes: Number(duty.duration.replace(' min', '')),
    recurrence: duty.recurrence, requiredStaff: duty.required, priority: duty.priority,
    isCritical: duty.isCritical, active: duty.status === 'Active', requiredSkills: duty.requiredSkills ?? [], requirements: duty.requirements };
}
