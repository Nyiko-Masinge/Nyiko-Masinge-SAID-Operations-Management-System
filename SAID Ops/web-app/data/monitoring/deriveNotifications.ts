// Pure logic: works out which staff notifications an assignment change should raise.
// No Firestore, no React — the same shape as detect.ts, so it's easy to unit test and could
// move into a Cloud Function later without rewriting the decision logic itself.

import type { NewNotification } from './model';

export interface AssignmentChange {
  dutyId: string;
  dutyName: string;
  dutyArea: string;
  dutyTime: string;
  /** True if this assignment had nobody on it before this change (a first assignment, not a swap). */
  wasEmpty: boolean;
  /** Staff ids newly on the assignment. */
  added: string[];
  /** Staff ids no longer on the assignment. */
  removed: string[];
}

export function notificationsForAssignmentChange(change: AssignmentChange): NewNotification[] {
  const notifications: NewNotification[] = [];

  for (const recipientId of change.added) {
    notifications.push({
      recipientId,
      category: change.wasEmpty ? 'Roster' : 'TaskUpdate',
      title: change.wasEmpty ? 'New Duty Assigned' : 'Duty Assignment Updated',
      message: `${change.dutyName} at ${change.dutyTime} in ${change.dutyArea}.`,
      isRead: false,
      deliveryStatus: 'Sent',
      relatedDutyId: change.dutyId,
    });
  }

  for (const recipientId of change.removed) {
    notifications.push({
      recipientId,
      category: 'TaskUpdate',
      title: 'Removed from Duty',
      message: `You have been removed from ${change.dutyName}.`,
      isRead: false,
      deliveryStatus: 'Sent',
      relatedDutyId: change.dutyId,
    });
  }

  return notifications;
}