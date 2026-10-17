import type { TeamMember } from './employees';

export type ShiftStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Unable to Complete';

export type TaskChecklistItem = {
  assignee: string;
  completed: boolean;
  completedAt?: string;
  id: string;
  label: string;
};

export type DemoShift = {
  // Shared task presentation for fixtures and Stage 6B published duties.
  id: string;
  title: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  description: string;
  tag?: string;
  locationId: string;
  team: TeamMember[];
  unableToCompleteReason?: string;
  /** Authoritative WS2 identity for published work. Fixtures may omit it.
   * Legacy tuple matching applies only when both duty and task lack this ID. */
  scheduledWorkId?: string;
  publicationVersion?: string;
  archived?: boolean;
  weekStart?: string;
  isCritical?: boolean;
  /** UI-only marker; never persisted to Firestore. */
  isLive?: boolean;
  // Extra UI fields (kept for current functionality)
  taskId: string;
  priority: 'High' | 'Normal';
  dueBy: string;
  estimatedDuration: string;
  startedAt?: string;
  checklist: TaskChecklistItem[];
  note?: string;
};
