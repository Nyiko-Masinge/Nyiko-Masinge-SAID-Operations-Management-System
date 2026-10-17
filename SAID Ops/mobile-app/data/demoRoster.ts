import type { RosterWeek } from '../types/roster';

export const demoRosterWeeks: RosterWeek[] = [
  {
    id: 'current', range: '19 - 25 October 2026', days: [
      { id: 'mon-19', day: 'MON', date: '19', shiftDate: '2026-10-19', duties: [{ id: 'mon-admissions', startTime: '08:00', endTime: '09:00', title: 'Admissions Support', locationId: 'receiving-area', status: 'Scheduled', shiftDate: '2026-10-19' }, { id: 'mon-round', startTime: '12:00', endTime: '13:00', title: 'General Ward Round', locationId: 'ward-a', status: 'Scheduled', shiftDate: '2026-10-19' }] },
      { id: 'tue-20', day: 'TUE', date: '20', shiftDate: '2026-10-20', duties: [{ id: 'tue-theatre', startTime: '07:30', endTime: '09:00', title: 'Theatre Preparation', locationId: 'operating-theatre-1', status: 'Scheduled', shiftDate: '2026-10-20' }, { id: 'tue-recovery', startTime: '14:00', endTime: '15:00', title: 'Post-Op Recovery', locationId: 'recovery-ward', status: 'Scheduled', shiftDate: '2026-10-20' }] },
      { id: 'wed-21', day: 'WED', date: '21', shiftDate: '2026-10-21', duties: [{ id: 'wed-kennel', startTime: '08:30', endTime: '09:30', title: 'Kennel Block Check', locationId: 'kennel-block', status: 'Scheduled', shiftDate: '2026-10-21' }, { id: 'wed-stock', startTime: '13:00', endTime: '14:00', title: 'Equipment Stock Check', locationId: 'stores', status: 'Scheduled', shiftDate: '2026-10-21' }] },
      { id: 'thu-22', day: 'THU', date: '22', shiftDate: '2026-10-22', duties: [{ id: 'thu-outreach', startTime: '09:00', endTime: '10:00', title: 'Outreach Preparation', locationId: 'outreach-bay', status: 'Scheduled', shiftDate: '2026-10-22' }, { id: 'thu-sterilise', startTime: '15:00', endTime: '16:00', title: 'Treatment Area Sterilisation', locationId: 'ward-c', status: 'Scheduled', shiftDate: '2026-10-22' }] },
      { id: 'fri-23', day: 'FRI', date: '23', shiftDate: '2026-10-23', duties: [{ id: 'fri-admissions', startTime: '07:00', endTime: '08:30', title: 'Admissions & Triage - Ward B', locationId: 'ward-b', status: 'Completed', shiftDate: '2026-10-23' }, { id: 'fri-theatre', startTime: '09:00', endTime: '11:00', title: 'Theatre Preparation - Ward A', locationId: 'theatre-1', status: 'In Progress', shiftDate: '2026-10-23' }, { id: 'fri-treatment', startTime: '13:00', endTime: '14:00', title: 'Treatment Area Sterilisation', locationId: 'ward-a', status: 'Scheduled', shiftDate: '2026-10-23' }, { id: 'fri-inventory', startTime: '16:30', endTime: '17:00', title: 'Inventory & Stock Check', locationId: 'break-room-2', status: 'Scheduled', shiftDate: '2026-10-23' }] },
      { id: 'sat-24', day: 'SAT', date: '24', shiftDate: '2026-10-24', isDayOff: true, duties: [] },
      { id: 'sun-25', day: 'SUN', date: '25', shiftDate: '2026-10-25', isDayOff: true, duties: [] },
    ],
  },
  {
    id: 'next', range: '26 October - 1 November 2026', days: [
      { id: 'mon-26', day: 'MON', date: '26', shiftDate: '2026-10-26', duties: [{ id: 'next-intake', startTime: '08:00', endTime: '09:00', title: 'Morning Intake Briefing', locationId: 'receiving-area', status: 'Scheduled', shiftDate: '2026-10-26' }] },
      { id: 'tue-27', day: 'TUE', date: '27', shiftDate: '2026-10-27', duties: [{ id: 'next-treatment', startTime: '10:00', endTime: '11:00', title: 'Treatment Bay Readiness', locationId: 'ward-a', status: 'Scheduled', shiftDate: '2026-10-27' }] },
      { id: 'wed-28', day: 'WED', date: '28', shiftDate: '2026-10-28', duties: [{ id: 'next-outreach', startTime: '09:30', endTime: '10:30', title: 'Outreach Vehicle Check', locationId: 'service-bay', status: 'Scheduled', shiftDate: '2026-10-28' }] },
      { id: 'thu-29', day: 'THU', date: '29', shiftDate: '2026-10-29', duties: [{ id: 'next-inventory', startTime: '14:00', endTime: '15:00', title: 'Inventory Reconciliation', locationId: 'stores', status: 'Scheduled', shiftDate: '2026-10-29' }] },
      { id: 'fri-30', day: 'FRI', date: '30', shiftDate: '2026-10-30', duties: [{ id: 'next-handover', startTime: '15:00', endTime: '16:00', title: 'Weekly Handover', locationId: 'operations-hub', status: 'Scheduled', shiftDate: '2026-10-30' }] },
      { id: 'sat-31', day: 'SAT', date: '31', shiftDate: '2026-10-31', isDayOff: true, duties: [] },
      { id: 'sun-01', day: 'SUN', date: '01', shiftDate: '2026-11-01', isDayOff: true, duties: [] },
    ],
  },
];
