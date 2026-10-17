export type MonitoringBackend = 'memory' | 'firestore';

export const LIVE_MONITORING_PENDING = 'Live monitoring is unavailable until operational data, identity and storage permissions are integrated. Demo data is kept local.';

export function monitoringAccessError(firebaseConfigured: boolean, flag: string | undefined): string | null {
  if (flag?.trim().toLowerCase() !== 'firestore') return null;
  return firebaseConfigured ? LIVE_MONITORING_PENDING : 'Live monitoring needs Firebase configuration. No live access was started.';
}

/**
 * Decides where monitoring data (alerts, history, notes, staff notifications) is stored.
 *
 * Firebase being configured is deliberately NOT enough on its own. The roster that drives
 * alert detection, history entries and notifications is still fixture data held in
 * OpsProvider, and letting it write to or reconcile against live Firestore would put demo
 * data into real collections (and into the audit log, which is append-only and cannot be
 * cleaned up from the app). A Firestore request remains unavailable until central
 * integration approves live operational input and storage/identity permissions.
 */
export function chooseMonitoringBackend(_firebaseConfigured: boolean, _flag: string | undefined): MonitoringBackend {
  // Configuration and a mode flag cannot approve provisional shared contracts.
  return 'memory';
}
