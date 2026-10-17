import { detectAlerts, suggestStaff } from './detect';
import type { RosterAssignment, RosterDuty, RosterSnapshot, RosterStaff } from './detect';

const staff: RosterStaff[] = [
  { id: 'S1', name: 'Sarah', availability: 'Available', workload: 65 },
  { id: 'M1', name: 'Marco', availability: 'Available', workload: 72 },
  { id: 'T1', name: 'Thabo', availability: 'Available', workload: 55 },
  { id: 'L1', name: 'Lindiwe', availability: 'Unavailable', workload: 48 },
];

const duties: RosterDuty[] = [
  { id: 'd1', name: 'Theatre Preparation', area: 'Theatre 1', time: '09:30', duration: '60 min', required: 2, priority: 'High' },
  { id: 'd2', name: 'Ward Round', area: 'Ward B', time: '10:00', duration: '30 min', required: 1, priority: 'Medium' },
  { id: 'd3', name: 'Stock Take', area: 'Pharmacy', time: '14:00', duration: '45 min', required: 1, priority: 'Low' },
];

const roster = (assignments: RosterAssignment[]): RosterSnapshot => ({ staff, duties, assignments });
const asg = (id: string, dutyId: string, staffIds: string[], day = 'Fri'): RosterAssignment => ({ id, dutyId, day, staffIds });

describe('detectAlerts', () => {
  it('flags a duty with no staff and uses the duty priority', () => {
    const alerts = detectAlerts(roster([asg('a1', 'd1', [])]));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ key: 'staffing:a1', type: 'UnassignedDuty', priority: 'High', title: 'Unassigned Duty' });
  });

  it('flags an understaffed duty with the count', () => {
    const [alert] = detectAlerts(roster([asg('a1', 'd1', ['S1'])]));
    expect(alert.title).toBe('Understaffed Duty');
    expect(alert.details).toContain('1 of 2');
  });

  it('raises nothing when every duty is covered and nobody clashes', () => {
    expect(detectAlerts(roster([asg('a1', 'd1', ['S1', 'M1']), asg('a2', 'd2', ['T1']), asg('a3', 'd3', ['S1'])]))).toEqual([]);
  });

  it('detects the same person on overlapping duties', () => {
    const alerts = detectAlerts(roster([asg('a1', 'd1', ['S1', 'M1']), asg('a2', 'd2', ['S1'])]));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ key: 'overlap:a1:a2:S1', type: 'Conflict', priority: 'High' });
  });

  it('does not treat back-to-back or different-day duties as conflicts', () => {
    expect(detectAlerts(roster([asg('a1', 'd1', ['S1', 'M1']), asg('a2', 'd2', ['T1'])]))).toEqual([]);
    expect(detectAlerts(roster([asg('a1', 'd1', ['S1', 'M1'], 'Fri'), asg('a2', 'd2', ['S1'], 'Sat')]))).toEqual([]);
  });

  it('flags unavailable staff who are assigned', () => {
    const alerts = detectAlerts(roster([asg('a2', 'd2', ['L1'])]));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ key: 'unavailable:a2:L1', type: 'Conflict' });
  });

  it('produces stable keys so repeated runs never duplicate alerts', () => {
    const r = roster([asg('a1', 'd1', []), asg('a2', 'd2', ['L1'])]);
    expect(detectAlerts(r).map((a) => a.key)).toEqual(detectAlerts(r).map((a) => a.key));
  });
});

describe('suggestStaff', () => {
  it('excludes unavailable, already-assigned and clashing staff, lightest workload first', () => {
    // Theatre Prep 09:30-10:30 needs cover. Thabo is on the 10:00 Ward Round, Marco is already on it.
    const r = roster([asg('a1', 'd1', ['M1']), asg('a2', 'd2', ['T1'])]);
    expect(suggestStaff(r, 'a1').map((s) => s.id)).toEqual(['S1']);
  });

  it('orders remaining candidates by workload', () => {
    const r = roster([asg('a1', 'd1', [])]);
    expect(suggestStaff(r, 'a1').map((s) => s.id)).toEqual(['T1', 'S1', 'M1']);
  });

  it('returns nothing for an unknown assignment', () => {
    expect(suggestStaff(roster([]), 'nope')).toEqual([]);
  });
});