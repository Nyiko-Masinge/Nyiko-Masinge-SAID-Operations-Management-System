// Display adapter for persistent employee notifications and explicit local fixtures.
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { AlertCategory, AlertAction, DemoAlert } from '../../types/alerts';

export type Unsubscribe = () => void;
type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type NotificationCategory = 'Emergency' | 'Roster' | 'TaskUpdate' | 'CriticalDuty' | 'Equipment' | 'Facility';
export type DeliveryStatus = 'Pending' | 'Sent' | 'Failed';

export interface AppNotification {
  id: string;
  recipientId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  createdAt: string; // ISO 8601
  isRead: boolean;
  relatedDutyId?: string;
  relatedAlertId?: string;
  deliveryStatus: DeliveryStatus;
}

/** What creating a notification needs; id and createdAt are assigned by the repository. */
export type NewNotification = Omit<AppNotification, 'id' | 'createdAt'>;

/**
 * Display tier and icon are deliberately not stored on the document (matching the same
 * decision made for web alerts): they're presentation, derived here from the category, so
 * changing how something looks never needs a data migration.
 */
const DISPLAY_TIER: Record<NotificationCategory, AlertCategory> = {
  Emergency: 'high',
  CriticalDuty: 'high',
  Roster: 'info',
  TaskUpdate: 'info',
  Equipment: 'info',
  Facility: 'system',
};

const NOTIFICATION_ICON: Record<NotificationCategory, IoniconName> = {
  Emergency: 'warning-outline',
  CriticalDuty: 'alert-circle-outline',
  Roster: 'calendar-outline',
  TaskUpdate: 'checkmark-circle-outline',
  Equipment: 'cube-outline',
  Facility: 'information-circle-outline',
};

/** A duty-linked notification opens the roster; anything else has no in-app destination yet. */
const notificationAction = (n: AppNotification): AlertAction | undefined => (n.relatedDutyId ? 'roster' : undefined);

/** Adapts a Firestore notification to the shape StaffAlertsScreen/NotificationTray/AlertDetailSheet already expect. */
export function toDemoAlert(n: AppNotification): DemoAlert {
  // Falls back rather than crashing if a document ever has a category outside the six valid
  // ones (bad data entry, a future category not added here yet, and so on) — the point of
  // the tray is to be reliable, so an unrecognised notification should still render, just
  // with a neutral appearance, rather than take the whole screen down.
  const tier = DISPLAY_TIER[n.category] ?? 'info';
  const icon = NOTIFICATION_ICON[n.category] ?? 'information-circle-outline';
  if (!(n.category in DISPLAY_TIER)) {
    // eslint-disable-next-line no-console
    console.warn(`Notification ${n.id} has an unrecognised category "${n.category}"; expected one of: ${Object.keys(DISPLAY_TIER).join(', ')}.`);
  }
  return {
    id: n.id,
    category: tier,
    icon,
    title: n.title,
    message: n.message,
    time: formatNotificationTime(n.createdAt),
    read: n.isRead,
    action: notificationAction(n),
  };
}

/** "10:42" today, "Yesterday", or "12 October" further back — matches the existing demo data's style. */
export function formatNotificationTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}
