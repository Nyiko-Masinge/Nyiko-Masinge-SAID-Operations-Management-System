// Alert detection (FR-11 conflicts, FR-12 uncovered duties).
// Pure functions with no React or Firebase imports, so the same code runs in the
// browser today and can move into a Cloud Function later, and is easy to unit test.

import type { DetectedAlert } from './model';

export interface RosterStaff {
  id: string;
  name: string;
  availability: string;
  workload?: number;
}

export interface RosterDuty {
  id: string;
  name: string;
  area: string;
  time: string; // "HH:MM"
  duration: string; // "60 min"
  required: number;
  priority: 'High' | 'Medium' | 'Low';
}

export interface RosterAssignment {
  id: string;
  dutyId: string;
  day: string;
  staffIds: string[];
}

export interface RosterSnapshot {
  staff: RosterStaff[];
  duties: RosterDuty[];
  assignments: RosterAssignment[];
}

const UNAVAILABLE = ['Unavailable', 'On Leave'];

interface Slot {
  start: number;
  end: number;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

const slotOf = (duty: RosterDuty): Slot => {
  const start = toMinutes(duty.time);
  return { start, end: start + (parseInt(duty.duration, 10) || 60) };
};

const overlaps = (a: Slot, b: Slot): boolean => a.start < b.end && b.start < a.end;

export function detectAlerts(roster: RosterSnapshot): DetectedAlert[] {
  const duties = new Map<string, RosterDuty>(roster.duties.map((d): [string, RosterDuty] => [d.id, d]));
  const staff = new Map<string, RosterStaff>(roster.staff.map((s): [string, RosterStaff] => [s.id, s]));
  const out: DetectedAlert[] = [];

  for (const a of roster.assignments) {
    const duty = duties.get(a.dutyId);
    if (!duty) continue;

    // Uncovered or understaffed duty
    const have = a.staffIds.length;
    if (have < duty.required) {
      out.push({
        key: `staffing:${a.id}`,
        type: 'UnassignedDuty',
        priority: duty.priority,
        title: have === 0 ? 'Unassigned Duty' : 'Understaffed Duty',
        details:
          have === 0
            ? `${duty.name} at ${duty.time} has no assigned staff.`
            : `${duty.name} at ${duty.time} has ${have} of ${duty.required} required staff.`,
        area: duty.area,
        dutyId: duty.id,
      });
    }

    // Assigned to someone who cannot work
    for (const id of a.staffIds) {
      const person = staff.get(id);
      if (person && UNAVAILABLE.includes(person.availability)) {
        out.push({
          key: `unavailable:${a.id}:${id}`,
          type: 'Conflict',
          priority: 'High',
          title: 'Unavailable Staff Assigned',
          details: `${person.name} is ${person.availability.toLowerCase()} but assigned to ${duty.name} at ${duty.time}.`,
          area: duty.area,
          dutyId: duty.id,
          staffIds: [id],
        });
      }
    }
  }

  // Same person on two overlapping duties on the same day
  const list = roster.assignments;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.day !== b.day) continue;
      const da = duties.get(a.dutyId);
      const db = duties.get(b.dutyId);
      if (!da || !db || !overlaps(slotOf(da), slotOf(db))) continue;
      for (const id of a.staffIds.filter((s) => b.staffIds.includes(s))) {
        out.push({
          key: `overlap:${a.id}:${b.id}:${id}`,
          type: 'Conflict',
          priority: 'High',
          title: 'Staff Conflict',
          details: `${staff.get(id)?.name ?? id} is double-booked: ${da.name} (${da.time}) overlaps ${db.name} (${db.time}).`,
          area: da.area,
          dutyId: da.id,
          staffIds: [id],
        });
      }
    }
  }

  return out;
}

/** Staff who could take this assignment: available, not already on it, no clash that day. Lightest workload first. */
export function suggestStaff(roster: RosterSnapshot, assignmentId: string): RosterStaff[] {
  const target = roster.assignments.find((a) => a.id === assignmentId);
  const duty = target && roster.duties.find((d) => d.id === target.dutyId);
  if (!target || !duty) return [];

  const slot = slotOf(duty);
  const busy = new Set<string>();
  for (const other of roster.assignments) {
    if (other.id === target.id || other.day !== target.day) continue;
    const otherDuty = roster.duties.find((d) => d.id === other.dutyId);
    if (otherDuty && overlaps(slot, slotOf(otherDuty))) other.staffIds.forEach((id) => busy.add(id));
  }

  return roster.staff
    .filter((s) => s.availability === 'Available' && !target.staffIds.includes(s.id) && !busy.has(s.id))
    .sort((x, y) => (x.workload ?? 0) - (y.workload ?? 0));
}