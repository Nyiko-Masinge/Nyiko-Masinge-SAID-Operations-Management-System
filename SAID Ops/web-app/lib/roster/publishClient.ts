import type { User } from 'firebase/auth';
import type { Staff } from '../../components/OpsProvider';
import type { DutyTemplate, PublishedRoster } from './types';
import type { CoverageIssue } from './scheduling';
export class PublicationRejection extends Error {
  constructor(message: string, public readonly code: string, public readonly coverageIssues: CoverageIssue[] = []) { super(message); }
}

export function publicationPayload(snapshot: PublishedRoster, staff: readonly Staff[], templates: readonly DutyTemplate[], confirmCoverage: boolean) {
  return { weekStart: snapshot.weekStart, confirmCoverage, items: snapshot.scheduledWork.map(work => ({
    scheduledWorkId: work.id, date: work.date, title: work.title, description: work.description,
    startTime: work.startTime, endTime: work.endTime, locationId: work.locationId,
    requiredStaff: work.required, isCritical: work.isCritical,
    ...(work.dutyId ? { dutyId: work.dutyId } : {}),
    ...(work.dutyId && (work.priority ?? templates.find(duty => duty.id === work.dutyId)?.priority) ?
      { priority: work.priority ?? templates.find(duty => duty.id === work.dutyId)!.priority } : {}),
    assignedEmployees: work.staffIds.map(id => {
      const person = staff.find(row => row.id === id);
      if (!person?.uid || !person.employeeId) throw new Error(`Employee ${id} is unprovisioned or has no resolved Auth UID. Provision and reload workforce before publishing.`);
      return { uid: person.uid, employeeId: person.employeeId };
    }),
  })) };
}

export async function persistPublication(user: User, payload: ReturnType<typeof publicationPayload>): Promise<{ version: string; warnings: string[]; coverageIssues: CoverageIssue[]; items: Record<string, unknown>[] }> {
  const token = await user.getIdToken();
  const response = await fetch('/api/rosters/publish', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) throw new PublicationRejection(typeof body.error === 'string' ? body.error : 'Roster publication failed. The previous publication remains current.', body.code ?? 'PUBLICATION_FAILED', body.coverageIssues ?? []);
  if (typeof body.version !== 'string' || !body.version) throw new Error('Publication response was invalid. Reload before retrying.');
  if (!Array.isArray(body.items) || !Array.isArray(body.warnings) || !Array.isArray(body.coverageIssues)) throw new Error('Publication response was invalid. Reload before retrying.');
  return { version: body.version, warnings: body.warnings, coverageIssues: body.coverageIssues, items: body.items };
}
