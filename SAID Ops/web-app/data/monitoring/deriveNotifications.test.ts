import { notificationsForAssignmentChange } from './deriveNotifications';

const base = { dutyId: 'd3', dutyName: 'Theatre Preparation', dutyArea: 'Theatre 1', dutyTime: '09:30' };

describe('notificationsForAssignmentChange', () => {
  it('raises a Roster notification for a first-ever assignment', () => {
    const [n] = notificationsForAssignmentChange({ ...base, wasEmpty: true, added: ['S1'], removed: [] });
    expect(n).toMatchObject({ recipientId: 'S1', category: 'Roster', title: 'New Duty Assigned', relatedDutyId: 'd3' });
    expect(n.message).toContain('Theatre Preparation');
  });

  it('raises a TaskUpdate notification when someone is added to an already-staffed duty', () => {
    const [n] = notificationsForAssignmentChange({ ...base, wasEmpty: false, added: ['S2'], removed: [] });
    expect(n).toMatchObject({ recipientId: 'S2', category: 'TaskUpdate', title: 'Duty Assignment Updated' });
  });

  it('notifies a removed staff member separately from anyone added', () => {
    const notifications = notificationsForAssignmentChange({ ...base, wasEmpty: false, added: ['S2'], removed: ['S1'] });
    expect(notifications).toHaveLength(2);
    const removedNotice = notifications.find((n) => n.recipientId === 'S1');
    expect(removedNotice).toMatchObject({ category: 'TaskUpdate', title: 'Removed from Duty' });
  });

  it('produces nothing when there is no real change', () => {
    expect(notificationsForAssignmentChange({ ...base, wasEmpty: false, added: [], removed: [] })).toEqual([]);
  });

  it('notifies every added and removed staff member, not just the first', () => {
    const notifications = notificationsForAssignmentChange({ ...base, wasEmpty: true, added: ['S1', 'S2'], removed: ['S3', 'S4'] });
    expect(notifications.map((n) => n.recipientId).sort()).toEqual(['S1', 'S2', 'S3', 'S4']);
  });
});