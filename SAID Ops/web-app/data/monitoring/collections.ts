// Firestore collection names used by alerts, history, notes and notifications.
//
// PROVISIONAL — NOT FINAL. These names and the document shapes that go with them
// (data/monitoring/model.ts) are this branch's working proposal, not an agreed contract.
// Do not treat them as settled, and do not let other workstreams build against them, until
// they've been reviewed with Nyiko during integration (see docs/monitoring-integration-gaps.md).
//
// Centralised here so that once a name changes, it changes in exactly one place rather than
// in every repository file that currently hardcodes it.
export const COLLECTIONS = {
  alerts: 'alerts',
  auditLogs: 'auditLogs',
  notes: 'notes',
  notifications: 'notifications',
} as const;