import { detectAlerts, suggestStaff } from './detect';
import { toMonitoringRoster } from './rosterInput';
import type { DutyTemplate, ScheduledWork } from '../../lib/roster/types';

const template: DutyTemplate = {
  id: 'template', name: 'Template name', description: '', area: 'Old snapshot',
  time: '08:00', duration: '60 min', required: 1, recurrence: 'Daily',
  priority: 'Low', isCritical: true, status: 'Active', requirements: [],
};
const occurrence: ScheduledWork = {
  id: 'work-a', dutyId: template.id, title: 'Edited occurrence', description: '',
  date: '2026-10-23', startTime: '14:00', endTime: '15:30', area: 'Old snapshot',
  locationId: 'parvo', required: 2, staffIds: ['staff-a'], isCritical: true,
};
const staff = [{ id: 'staff-a', name: 'A', availability: 'Available' }, { id: 'staff-b', name: 'B', availability: 'Available' }];
const name = (id: string) => id === 'parvo' ? 'Parvo Ward' : id;

test('local monitoring uses dated occurrence snapshots and shared locations', () => {
  const roster = toMonitoringRoster(staff, [template], [occurrence], name);
  expect(roster.duties[0]).toEqual({ id: 'work-a', name: 'Edited occurrence', area: 'Parvo Ward', time: '14:00', duration: '90 min', required: 2, priority: 'Low' });
  expect(roster.assignments[0]).toEqual({ id: 'work-a', dutyId: 'work-a', day: '2026-10-23', staffIds: ['staff-a'] });
  expect(detectAlerts(roster)[0]).toMatchObject({ key: 'staffing:work-a', dutyId: 'work-a', priority: 'Low' });
  expect(occurrence.isCritical).toBe(true); // Critical remains independent of priority.
});

test('ad-hoc scheduled work participates without a template or legacy assignment', () => {
  const work = { ...occurrence, id: 'adhoc', dutyId: undefined, staffIds: [] };
  const roster = toMonitoringRoster(staff, [], [work], name);
  expect(detectAlerts(roster)).toEqual([expect.objectContaining({ key: 'staffing:adhoc', dutyId: 'adhoc', type: 'UnassignedDuty' })]);
  expect(suggestStaff(roster, 'adhoc').map(person => person.id)).toEqual(['staff-a', 'staff-b']);
});

test('overlap detection and suggestions follow edited occurrence times and dates', () => {
  const second = { ...occurrence, id: 'work-b', startTime: '15:00', endTime: '16:00' };
  const roster = toMonitoringRoster(staff, [template], [occurrence, second], name);
  expect(detectAlerts(roster).some(alert => alert.key.startsWith('overlap:'))).toBe(true);
  expect(suggestStaff(roster, 'work-b').map(person => person.id)).toEqual(['staff-b']);
  expect(detectAlerts(toMonitoringRoster(staff, [template], [occurrence, { ...second, date: '2026-10-24' }], name)).some(alert => alert.key.startsWith('overlap:'))).toBe(false);
});

test('projection cannot mutate scheduled assignments and follows occurrence removal', () => {
  const roster = toMonitoringRoster(staff, [template], [occurrence], name);
  roster.assignments[0].staffIds.push('staff-b');
  expect(occurrence.staffIds).toEqual(['staff-a']);
  expect(toMonitoringRoster(staff, [template], [], name)).toEqual({ staff, duties: [], assignments: [] });
});
