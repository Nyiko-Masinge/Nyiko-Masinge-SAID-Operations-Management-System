import type { DemoStaffProfile } from '../types/profile';

export const demoStaffProfile: DemoStaffProfile = {
  editable: {
    fullName: 'Sarah Jenkins',
    notificationsEnabled: true,
    workEmail: 'sarah.jenkins@saidops.demo',
    workPhone: '071 234 5678',
  },
  employment: { status: 'Active', joined: '15 March 2024' },
  operational: {
    staffId: 'SAID-VA-1024',
    systemRole: 'Staff Member',
    operationalRole: 'Veterinary Assistant',
    department: 'Veterinary Services',
    primaryLocationId: 'Intake Ward A',
    access: 'Staff Mobile Application',
  },
  skills: ['Animal Handling', 'Intake Procedures', 'Infection Control', 'Theatre Support'],
};
