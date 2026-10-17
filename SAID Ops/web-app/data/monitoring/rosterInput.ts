// Read-only local monitoring view. WS2 ScheduledWork remains the scheduling authority;
// this does not create persisted records or activate any live monitoring adapter.
import type { DutyTemplate, ScheduledWork } from '../../lib/roster/types';
import type { RosterSnapshot, RosterStaff } from './detect';

export function toMonitoringRoster(
  staff: RosterStaff[],
  templates: DutyTemplate[],
  scheduledWork: ScheduledWork[],
  locationName: (id: string) => string,
): RosterSnapshot {
  const priorityByTemplate = new Map(templates.map(template => [template.id, template.priority]));
  const minutes = (time: string) => { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; };
  return {
    staff,
    duties: scheduledWork.map(work => ({
      id: work.id, name: work.title,
      area: work.locationId ? locationName(work.locationId) : work.area,
      time: work.startTime, duration: `${minutes(work.endTime) - minutes(work.startTime)} min`,
      required: work.required,
      priority: (work.dutyId && priorityByTemplate.get(work.dutyId)) || 'Medium',
    })),
    assignments: scheduledWork.map(work => ({ id: work.id, dutyId: work.id, day: work.date, staffIds: [...work.staffIds] })),
  };
}
