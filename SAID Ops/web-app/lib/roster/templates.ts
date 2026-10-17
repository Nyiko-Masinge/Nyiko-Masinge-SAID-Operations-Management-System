import { daysForRecurrence, endFromDuration } from './generation';
import type { DutyTemplate } from './types';
import { validRequiredStaff } from './scheduling';

export type TemplateResult = { ok: true } | { ok: false; code: 'INVALID_ID' | 'DUPLICATE_ID' | 'NAME_REQUIRED' | 'AREA_REQUIRED' | 'INVALID_TIME' | 'INVALID_DURATION' | 'INVALID_REQUIRED' | 'UNSUPPORTED_RECURRENCE' | 'INVALID_PRIORITY' | 'INVALID_STATUS' | 'INVALID_CRITICAL' | 'SAVE_FAILED'; message?: string };

export function validateTemplate(template: DutyTemplate, existing: readonly DutyTemplate[], editingId?: string): TemplateResult {
  if (!template.id.trim()) return { ok: false, code: 'INVALID_ID' };
  if (existing.some(item => item.id === template.id && item.id !== editingId)) return { ok: false, code: 'DUPLICATE_ID' };
  if (!template.name.trim()) return { ok: false, code: 'NAME_REQUIRED' };
  if (!template.area.trim()) return { ok: false, code: 'AREA_REQUIRED' };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(template.time)) return { ok: false, code: 'INVALID_TIME' };
  if (!/^\d+ min$/.test(template.duration) || !endFromDuration(template.time, template.duration)) return { ok: false, code: 'INVALID_DURATION' };
  if (!validRequiredStaff(template.required)) return { ok: false, code: 'INVALID_REQUIRED' };
  if (!daysForRecurrence(template.recurrence)) return { ok: false, code: 'UNSUPPORTED_RECURRENCE' };
  if (!['High', 'Medium', 'Low'].includes(template.priority)) return { ok: false, code: 'INVALID_PRIORITY' };
  if (typeof template.isCritical !== 'boolean') return { ok: false, code: 'INVALID_CRITICAL' };
  if (!['Active', 'Inactive'].includes(template.status)) return { ok: false, code: 'INVALID_STATUS' };
  return { ok: true };
}
