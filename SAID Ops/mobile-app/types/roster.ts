import type { ShiftStatus } from './tasks';

export type RosterDutyStatus = ShiftStatus;

export type RosterDuty = {
  id: string;
  locationId: string;
  status: RosterDutyStatus;
  startTime: string;
  endTime: string;
  title: string;
  shiftDate: string;
  /** Authoritative WS2 identity for published work. Fixtures may omit it.
   * Legacy tuple matching applies only when both duty and task lack this ID. */
  scheduledWorkId?: string;
};

export type RosterDay = {
  date: string;
  day: string;
  duties: RosterDuty[];
  id: string;
  isDayOff?: boolean;
  shiftDate: string;
};

export type RosterWeek = {
  days: RosterDay[];
  id: string;
  range: string;
};
