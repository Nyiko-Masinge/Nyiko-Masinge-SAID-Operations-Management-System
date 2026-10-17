// Writes notifications produced by deriveNotifications.ts into the `notifications` collection
// the mobile app reads from. Write-only here: the web app has no screen for personal
// notifications (supervisors see the equivalent on the Alerts and History screens).
//
// PROVISIONAL: the shape of these documents is this branch's proposal, not an agreed shared
// contract. See doc/monitoring-integration-gaps.md. Live activation remains disabled.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getFirebaseDb } from '../../lib/firebase';
import { monitoringUsesFirestore, monitoringUnavailableReason } from '../../lib/dataSource';
import { COLLECTIONS } from './collections'; // PROVISIONAL, see collections.ts
import type { NewNotification } from './model';

/**
 * Resolves true if the notification was written, false if it was intentionally skipped
 * because monitoring is not using Firestore (demo mode). Rejects if a write was attempted and
 * failed, so the caller can make that failure visible instead of losing it.
 *
 * TODO(central integration): move into a Cloud Function on the same roster/assignment writes,
 * so notifications are issued by trusted server code.
 */
export async function writeNotification(notification: NewNotification): Promise<boolean> {
  if (monitoringUnavailableReason) throw new Error(monitoringUnavailableReason);
  if (!monitoringUsesFirestore) return false;
  const db = getFirebaseDb();
  await addDoc(collection(db, COLLECTIONS.notifications), { ...notification, createdAt: serverTimestamp() });
  return true;
}
