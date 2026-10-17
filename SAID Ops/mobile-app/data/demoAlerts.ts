import type { DemoAlert } from '../types/alerts';

export const initialDemoAlerts: DemoAlert[] = [
  { id: 'emergency-intake', category: 'high', title: 'Emergency: Assist Intake Ward', message: 'Immediate assistance required for critical arrival in Intake Ward A.', time: '10:42', read: false, icon: 'warning-outline' },
  { id: 'equipment-stock-check', category: 'high', title: 'Equipment Stock Check', message: 'Equipment stock check required in Ward B.', time: '10:15', read: false, icon: 'cube-outline' },
  { id: 'roster-update', category: 'info', title: 'Roster Update', message: 'Your roster has been updated for tomorrow.', time: '08:00', read: false, icon: 'calendar-outline', action: 'roster' },
  { id: 'task-completed', category: 'info', title: 'Task Completed', message: 'Routine inventory check was completed successfully.', time: 'Yesterday', read: true, icon: 'checkmark-circle-outline' },
  { id: 'facility-notice', category: 'system', title: 'Facility Notice', message: 'Facility maintenance is scheduled for Ward A.', time: 'Yesterday', read: true, icon: 'information-circle-outline' },
  { id: 'leave-approved', category: 'system', title: 'Leave Approved', message: 'Your annual leave request for 1 - 5 November has been approved.', time: '12 October', read: true, icon: 'calendar-clear-outline' },
];
