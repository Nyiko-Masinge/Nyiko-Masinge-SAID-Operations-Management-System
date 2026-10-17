import type { ShiftStatus } from '../types/tasks';

/** Presentation only: callers supply the effective, confirmed progress status. */
export function taskStatusLabel(status: ShiftStatus): string {
  const labels: Record<ShiftStatus, string> = {
    Scheduled: 'Not started',
    'In Progress': 'In progress',
    Completed: 'Completed',
    'Unable to Complete': 'Unable to complete',
  };
  return labels[status];
}
