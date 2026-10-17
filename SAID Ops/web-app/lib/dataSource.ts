// The single place the rest of the app asks "may monitoring write to Firestore?".
// Next.js only inlines NEXT_PUBLIC_* variables when they are written out literally, so the
// variable is read here directly rather than through a helper. Restart `npm run dev` after
// changing .env.local.

import { chooseMonitoringBackend, monitoringAccessError } from '../data/monitoring/backend';
import { isFirebaseConfigured } from './firebase';

export const monitoringBackend = chooseMonitoringBackend(isFirebaseConfigured(), process.env.NEXT_PUBLIC_MONITORING_BACKEND);
export const monitoringUsesFirestore = monitoringBackend === 'firestore';
export const monitoringUnavailableReason = monitoringAccessError(isFirebaseConfigured(), process.env.NEXT_PUBLIC_MONITORING_BACKEND);
