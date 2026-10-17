// Domain model for Notifications, Monitoring & Operational History.
// Timestamps are ISO 8601 strings so these types do not depend on Firebase.
// The Firestore repositories convert Timestamp <-> ISO at the boundary.

export type Unsubscribe = () => void;

export interface Actor {
  id: string;
  name: string;
  role: string;
}

export const SYSTEM_ACTOR: Actor = { id: 'system', name: 'System', role: 'System' };

/* ------------------------------ Alerts ------------------------------ */

export type AlertPriority = 'High' | 'Medium' | 'Low';
export type AlertType =
  | 'Conflict'
  | 'UnassignedDuty'
  | 'UnableToComplete'
  | 'Overdue'
  | 'Equipment'
  | 'Other';
export type AlertState = 'Open' | 'Acknowledged' | 'Resolved';
/** Detected = worked out from the roster; Reported = raised by staff or another system event. */
export type AlertOrigin = 'Detected' | 'Reported';

export interface Alert {
  id: string;
  /** Stable identity, e.g. "staffing:a2". Detected alerts reuse it so they are never duplicated. */
  key: string;
  origin: AlertOrigin;
  type: AlertType;
  priority: AlertPriority;
  state: AlertState;
  title: string;
  details: string;
  area: string;
  dutyId?: string;
  staffIds?: string[];
  raisedAt: string;
  resolvedAt?: string;
  resolvedBy?: Actor;
  resolutionNote?: string;
}

/** What the detection engine produces; the repository adds id, state and timestamps. */
export type DetectedAlert = Pick<Alert, 'key' | 'type' | 'priority' | 'title' | 'details' | 'area'> &
  Partial<Pick<Alert, 'dutyId' | 'staffIds'>>;

/** The existing AlertsScreen tab label for each alert type. */
export const ALERT_TAB: Record<AlertType, string> = {
  Conflict: 'Conflicts',
  UnassignedDuty: 'Unassigned Duties',
  UnableToComplete: 'Unable to Complete',
  Overdue: 'Overdue',
  Equipment: 'Other',
  Other: 'Other',
};

/* --------------------------- Audit / history --------------------------- */

export type AuditCategory =
  | 'RosterChange'
  | 'DutyChange'
  | 'StaffChange'
  | 'AlertResolution'
  | 'SystemEvent';

export type AuditAction =
  | 'RosterCreated'
  | 'RosterPublished'
  | 'DutyCreated'
  | 'DutyUpdated'
  | 'DutyAssigned'
  | 'DutyReassigned'
  | 'DutyStatusChanged'
  | 'StaffAdded'
  | 'StaffUpdated'
  | 'StaffAvailabilityChanged'
  | 'AlertResolved'
  | 'NoteAdded'
  | 'SystemBackup';

export type AuditEntityType = 'roster' | 'duty' | 'staff' | 'alert' | 'system';

/** The existing HistoryScreen tab label for each category. */
export const AUDIT_TAB: Record<AuditCategory, string> = {
  RosterChange: 'Roster Changes',
  DutyChange: 'Duty Changes',
  StaffChange: 'Staff Changes',
  AlertResolution: 'Alert Resolutions',
  SystemEvent: 'System Events',
};

/** Immutable record of one operational event (NFR-26 / NFR-27). */
export interface AuditLog {
  id: string;
  reference: string; // e.g. SAID-2026-1023-0001
  timestamp: string;
  actor: Actor;
  category: AuditCategory;
  action: AuditAction;
  summary: string; // short label shown in the Action column
  details: string;
  area: string;
  entityType: AuditEntityType;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/** What callers supply; id, reference and timestamp are assigned by the repository. */
export type NewAuditLog = Omit<AuditLog, 'id' | 'reference' | 'timestamp'>;

/* ------------------------------- Notes ------------------------------- */

export type NoteEntityType = 'roster' | 'duty' | 'alert';

export interface OperationalNote {
  id: string;
  entityType: NoteEntityType;
  entityId: string;
  text: string;
  author: Actor;
  createdAt: string;
}

/** What callers supply; id and createdAt are assigned by the repository. */
export type NewNote = Omit<OperationalNote, 'id' | 'createdAt'>;

/* --------------------------- Notifications --------------------------- */
// Written by trusted code only (Cloud Functions), read by the recipient.
// Category list is a proposal: agree it with the mobile-app branch.

export type NotificationCategory =
  | 'Emergency'
  | 'Roster'
  | 'TaskUpdate'
  | 'CriticalDuty'
  | 'Equipment'
  | 'Facility';

export type DeliveryStatus = 'Pending' | 'Sent' | 'Failed';

export interface AppNotification {
  id: string;
  recipientId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  relatedDutyId?: string;
  relatedAlertId?: string;
  issuedBy?: Actor;
  deliveryStatus: DeliveryStatus;
}

/** What creating a notification needs; id and createdAt are assigned by the writer. */
export type NewNotification = Omit<AppNotification, 'id' | 'createdAt'>;

/* ------------------------------ Helpers ------------------------------ */

const TZ = 'Africa/Johannesburg';

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
}

export const formatDateTime = (iso: string): string => `${formatDate(iso)} ${formatTime(iso)}`;

export function formatWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', timeZone: TZ });
}

/** "5 min ago", "3 h ago" ... replaces the hard-coded `age` strings. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}