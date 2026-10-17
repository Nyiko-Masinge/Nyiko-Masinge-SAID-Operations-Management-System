import type { Role } from './employee';

// PROPOSED role names, taken from the Source of Truth ("Supervisor/Administrator" and
// "Staff Member"). Confirm the exact `roles` document values with the team before relying
// on them, and keep every role comparison in this file.
export const ROLE_NAMES = {
  supervisor: 'Supervisor/Administrator',
  staff: 'Staff Member',
} as const;

export const isSupervisorRole = (role: Pick<Role, 'name'> | null | undefined) => role?.name === ROLE_NAMES.supervisor;
