// Maps the staff-facing Employee ID to a Firebase Auth email, and back. Agreed with Nyiko:
// the user-facing login is Employee ID + password only (not all staff have an email address).
// Firebase's Email/Password provider still requires *an* email internally, so we derive a
// deterministic, Firebase-only address from the Employee ID.
//
// Hard rules (do not relax these without re-coordinating with Nyiko):
// - This synthetic address is never real, is never sent to, and must never be shown to the
//   user or treated as their contact email. It exists purely so Firebase Auth has something
//   to store; nothing should read it back out as "the employee's email".
// - Firebase UID is NOT the Employee ID. The UID is only ever used as the `employees/{uid}`
//   document id and in Firestore rules (`request.auth.uid`). The human-readable Employee ID
//   lives in that document's `employeeId` field and is looked up there, never assumed from
//   the UID or from this synthetic address.
const SYNTHETIC_EMAIL_DOMAIN = 'saidops.internal';

// Employee IDs are entered by hand at login, so normalise case/whitespace before deriving the
// synthetic email, and strip anything that isn't valid in an email local-part.
function normalizeEmployeeId(employeeId: string): string {
  return employeeId.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');
}

export function employeeIdToSyntheticEmail(employeeId: string): string {
  const normalized = normalizeEmployeeId(employeeId);
  return `${normalized}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

// A quick, login-screen-only check so we can tell someone "that looks like an email, not an
// Employee ID" before ever calling Firebase. Not used for anything security-relevant.
export function looksLikeEmail(value: string): boolean {
  return value.includes('@');
}
