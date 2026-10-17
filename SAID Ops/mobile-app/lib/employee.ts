// Shapes follow the Task 1 Source of Truth, section 9.1.11 (Data Schema).
// Stage 7A operational additions are documented in docs/STAGE_7A_DURABLE_PLANNING.md.
import type { Timestamp } from 'firebase/firestore';
// Mirrors web-app/lib/employee.ts — the two apps don't share a build step, so this is
// kept in sync by hand until the group agrees on a shared package.
export type Role = {
  id: string;
  name: string;
};

export type Employee = {
  id: string; // Firestore document id, == the Firebase Auth UID. Never the Employee ID.
  employeeId: string; // human-readable id staff type at login, e.g. "EMP-0008". NOT the doc id.
  firstName: string;
  surname: string;
  // Real contact email, if the employee has one. Optional — many staff won't. Never the
  // synthetic Firebase Auth email; see lib/authIdentity.ts. Never assume this exists.
  contactEmail?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  roleId: string;
  // Optional for backward-compatible identity reads. Missing means not provisioned.
  jobCategory?: string;
  locationId?: string;
  active?: boolean;
  availability?: {
    normalState: 'Available' | 'On Duty';
    state: 'Available' | 'On Duty' | 'On Leave' | 'Training' | 'Unavailable';
    effectiveFrom: string;
    effectiveTo: string | null;
  };
  skills?: string[];
  revision?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  updatedBy?: string;
};

export const employeeFullName = (e: Pick<Employee, 'firstName' | 'surname'>) => `${e.firstName} ${e.surname}`.trim();
