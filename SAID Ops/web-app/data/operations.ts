export type DutyStatus = 'Completed' | 'In Progress' | 'Upcoming';
export type AlertPriority = 'High' | 'Medium' | 'Low';

export const supervisor = { name: 'Lerato Dlamini', initials: 'LD', employeeId: 'SUP-001', email: 'lerato.dlamini@saidops.demo', role: 'Supervisor' };

export const staff = [
  { name: 'Sarah Jenkins', role: 'Veterinary Assistant', area: 'Intake Ward A', status: 'On duty' },
  { name: 'Marco Radebe', role: 'Theatre Technician', area: 'Theatre 1', status: 'On duty' },
  { name: 'Lindiwe Mokoena', role: 'Veterinary Assistant', area: 'Ward B', status: 'Unavailable' },
  { name: 'Thabo Dlamini', role: 'Animal Care Assistant', area: 'Ward C', status: 'On duty' },
];

export const duties = [
  { time: '07:00', title: 'Admissions & Triage', location: 'Ward B', status: 'Completed' as DutyStatus },
  { time: '09:00', title: 'Theatre Preparation', location: 'Theatre 1', status: 'In Progress' as DutyStatus },
  { time: '13:00', title: 'Treatment Sterilisation', location: 'Ward A & C', status: 'Upcoming' as DutyStatus },
  { time: '16:30', title: 'Inventory & Stock Check', location: 'Break Room 2', status: 'Upcoming' as DutyStatus },
  { time: '18:30', title: 'Kennel Cleaning', location: 'Kennel Block', status: 'Upcoming' as DutyStatus },
];

export const alerts = [
  { title: 'Unassigned Duty', detail: 'Theatre Preparation at 09:30 is unassigned.', priority: 'High' as AlertPriority, age: '5 min ago', icon: '!', tone: 'danger' },
  { title: 'Staff Conflict', detail: 'Sarah Jenkins has overlapping assignments.', priority: 'High' as AlertPriority, age: '12 min ago', icon: '◌', tone: 'warning' },
  { title: 'Urgent Reassignment', detail: 'Lindiwe M. is unavailable for Ward B shift.', priority: 'Medium' as AlertPriority, age: '18 min ago', icon: '↻', tone: 'orange' },
  { title: 'Equipment Check Unable to Complete', detail: 'Oxygen Check in Theatre 1 reported issue.', priority: 'Low' as AlertPriority, age: '25 min ago', icon: 'i', tone: 'info' },
];

export const areas = [
  { name: 'Intake', duties: 3, state: 'On Track', icon: '⌂', tone: 'good' },
  { name: 'Theatre', duties: 4, state: 'Attention', icon: '✚', tone: 'attention' },
  { name: 'General Wards', duties: 5, state: 'On Track', icon: '▰', tone: 'good' },
  { name: 'Pharmacy', duties: 3, state: 'On Track', icon: '◈', tone: 'good' },
  { name: 'Kennel Block', duties: 3, state: 'On Track', icon: '♧', tone: 'good' },
];
