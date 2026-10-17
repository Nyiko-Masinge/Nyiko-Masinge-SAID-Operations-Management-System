/** Stage 7A operational contract. Identity and authorization remain trusted provisioning. */
export type AvailabilityState = 'Available' | 'On Duty' | 'On Leave' | 'Training' | 'Unavailable';
export type Availability = {
  normalState: 'Available' | 'On Duty';
  state: AvailabilityState;
  effectiveFrom: string; // Canonical UTC ISO instant; inclusive.
  effectiveTo: string | null; // Exclusive; null means ongoing.
};
export type WorkforceFields = {
  jobCategory: string;
  locationId: string;
  active: boolean;
  availability: Availability;
  skills: string[];
};
export type TemplateFields = {
  name: string;
  description: string;
  locationId: string;
  defaultStartTime: string; // HH:mm in Africa/Johannesburg, same as the planner.
  durationMinutes: number; // Positive, must end before midnight.
  recurrence: string;
  requiredStaff: number;
  priority: 'High' | 'Medium' | 'Low';
  isCritical: boolean;
  active: boolean;
  requiredSkills: string[];
  requirements: string[]; // Instructions/checklist, never a skills alias.
};

export const availabilityStates: AvailabilityState[] = ['Available', 'On Duty', 'On Leave', 'Training', 'Unavailable'];
export function availabilityAt(value: Availability, instant: string): AvailabilityState {
  return instant >= value.effectiveFrom && (value.effectiveTo === null || instant < value.effectiveTo)
    ? value.state : value.normalState;
}

export function validAvailability(value: unknown): value is Availability {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  const instant = (item: unknown): item is string => typeof item === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item) &&
    Number.isFinite(Date.parse(item)) && new Date(item).toISOString() === item;
  return Object.keys(data).length === 4 && ['Available', 'On Duty'].includes(String(data.normalState)) &&
    availabilityStates.includes(data.state as AvailabilityState) && instant(data.effectiveFrom) &&
    (data.effectiveTo === null || (instant(data.effectiveTo) && data.effectiveTo > data.effectiveFrom));
}
export function validStringList(value: unknown, maxItems = 32, maxLength = 80): value is string[] {
  return Array.isArray(value) && value.length <= maxItems &&
    value.every(item => typeof item === 'string' && Boolean(item.trim()) && item === item.trim() && item.length <= maxLength) &&
    new Set(value.map(item => item.toLowerCase())).size === value.length;
}
export function revisionOf(data: Record<string, unknown>): number {
  if (data.revision === undefined) return 0; // Legacy revision, not an operational default.
  if (!Number.isSafeInteger(data.revision) || Number(data.revision) < 0) throw new Error('Invalid planning revision. Contact an administrator.');
  return Number(data.revision);
}
