type SeedRole = {
  id: string;
  name: string;
};

type SeedEmployee = {
  id: string;
  firstName: string;
  surname: string;
  email: string;
  phoneNumber: string;
  profilePictureUrl: string;
  roleId: string;
};

type SeedLocation = {
  id: string;
  name: string;
};

type SeedTeamMember = {
  employeeId: string;
  isPrimary: boolean;
};

type SeedShift = {
  id: string;
  title: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Unable to Complete';
  description: string;
  tag: string;
  locationId: string;
  team: SeedTeamMember[];
};

export const seedRoles: SeedRole[] = [
  { id: 'veterinary-assistant', name: 'Veterinary Assistant' },
  { id: 'theatre-technician', name: 'Theatre Technician' },
  { id: 'nurse', name: 'Nurse' },
  { id: 'driver', name: 'Driver' },
  { id: 'animal-care-assistant', name: 'Animal Care Assistant' },
];

export const seedEmployees: SeedEmployee[] = [
  {
    id: 'emp-sarah-j',
    firstName: 'Sarah',
    surname: 'Jenkins',
    email: 'sarah.jenkins@saidops.demo',
    phoneNumber: '071 234 5678',
    profilePictureUrl: '',
    roleId: 'veterinary-assistant',
  },
  {
    id: 'emp-marco-r',
    firstName: 'Marco',
    surname: 'Rossi',
    email: 'marco.rossi@saidops.org',
    phoneNumber: '+27 11 234 5679',
    profilePictureUrl: '',
    roleId: 'nurse',
  },
  {
    id: 'emp-lindiwe-m',
    firstName: 'Lindiwe',
    surname: 'Mokoena',
    email: 'lindiwe.mokoena@saidops.org',
    phoneNumber: '+27 11 234 5680',
    profilePictureUrl: '',
    roleId: 'nurse',
  },
  {
    id: 'emp-thabo-d',
    firstName: 'Thabo',
    surname: 'Dlamini',
    email: 'thabo.dlamini@saidops.org',
    phoneNumber: '+27 11 234 5681',
    profilePictureUrl: '',
    roleId: 'animal-care-assistant',
  },
  {
    id: 'emp-adam-d',
    firstName: 'Adam',
    surname: 'Davids',
    email: 'adam.davids@saidops.org',
    phoneNumber: '+27 11 234 5682',
    profilePictureUrl: '',
    roleId: 'nurse',
  },
  {
    id: 'emp-michelle-k',
    firstName: 'Michelle',
    surname: 'Khumalo',
    email: 'michelle.khumalo@saidops.org',
    phoneNumber: '+27 11 234 5683',
    profilePictureUrl: '',
    roleId: 'nurse',
  },
  {
    id: 'emp-sipho-n',
    firstName: 'Sipho',
    surname: 'Nkosi',
    email: 'sipho.nkosi@saidops.org',
    phoneNumber: '+27 11 234 5684',
    profilePictureUrl: '',
    roleId: 'driver',
  },
  {
    id: 'emp-thandi-t',
    firstName: 'Thandi',
    surname: 'Tshabalala',
    email: 'thandi.tshabalala@saidops.org',
    phoneNumber: '+27 11 234 5685',
    profilePictureUrl: '',
    roleId: 'nurse',
  },
];

export const seedLocations: SeedLocation[] = [
  { id: 'receiving-area', name: 'Receiving Area' },
  { id: 'ward-a', name: 'Ward A' },
  { id: 'ward-b', name: 'Ward B' },
  { id: 'ward-c', name: 'Ward C' },
  { id: 'theatre-1', name: 'Theatre 1' },
  { id: 'operating-theatre-1', name: 'Operating Theatre 1' },
  { id: 'recovery-ward', name: 'Recovery Ward' },
  { id: 'kennel-block', name: 'Kennel Block' },
  { id: 'stores', name: 'Stores' },
  { id: 'outreach-bay', name: 'Outreach Bay' },
  { id: 'break-room-2', name: 'Break Room 2' },
  { id: 'operations-hub', name: 'Operations Hub' },
  { id: 'service-bay', name: 'Service Bay' },
];

export const seedShifts: SeedShift[] = [
  {
    id: 'admissions-triage',
    title: 'Admissions & Triage - Ward B',
    shiftDate: '2026-10-23',
    startTime: '07:00',
    endTime: '08:30',
    status: 'Completed',
    description: 'Prepare Ward B intake area and complete the operational triage handover before morning admissions.',
    tag: 'admissions',
    locationId: 'ward-b',
    team: [
      { employeeId: 'emp-sarah-j', isPrimary: true },
      { employeeId: 'emp-marco-r', isPrimary: false },
    ],
  },
  {
    id: 'theatre-preparation',
    title: 'Theatre Preparation - Ward A',
    shiftDate: '2026-10-23',
    startTime: '09:00',
    endTime: '11:00',
    status: 'In Progress',
    description: 'Prepare Theatre 1 in Ward A for scheduled procedures. Ensure equipment is functional and sterile supplies are ready.',
    tag: 'theatre',
    locationId: 'theatre-1',
    team: [
      { employeeId: 'emp-sarah-j', isPrimary: true },
      { employeeId: 'emp-marco-r', isPrimary: false },
      { employeeId: 'emp-lindiwe-m', isPrimary: false },
      { employeeId: 'emp-thabo-d', isPrimary: false },
    ],
  },
  {
    id: 'treatment-sterilisation',
    title: 'Treatment Area Sterilisation',
    shiftDate: '2026-10-23',
    startTime: '13:00',
    endTime: '14:00',
    status: 'Scheduled',
    description: 'Sterilise the treatment areas in Wards A and C and replenish clinical-grade disinfectant supplies.',
    tag: 'sterilisation',
    locationId: 'ward-a',
    team: [
      { employeeId: 'emp-sarah-j', isPrimary: true },
      { employeeId: 'emp-lindiwe-m', isPrimary: false },
      { employeeId: 'emp-thabo-d', isPrimary: false },
    ],
  },
  {
    id: 'inventory-check',
    title: 'Inventory & Stock Check',
    shiftDate: '2026-10-23',
    startTime: '16:30',
    endTime: '17:00',
    status: 'Scheduled',
    description: 'Complete the scheduled consumables and stock check in Break Room 2 before the end-of-day handover.',
    tag: 'inventory',
    locationId: 'break-room-2',
    team: [
      { employeeId: 'emp-sarah-j', isPrimary: true },
      { employeeId: 'emp-marco-r', isPrimary: false },
    ],
  },
  {
    id: 'mon-admissions',
    title: 'Admissions Support',
    shiftDate: '2026-10-19',
    startTime: '08:00',
    endTime: '09:00',
    status: 'Scheduled',
    description: 'Support morning admissions in the receiving area.',
    tag: 'admissions',
    locationId: 'receiving-area',
    team: [{ employeeId: 'emp-sarah-j', isPrimary: true }],
  },
  {
    id: 'mon-round',
    title: 'General Ward Round',
    shiftDate: '2026-10-19',
    startTime: '12:00',
    endTime: '13:00',
    status: 'Scheduled',
    description: 'Complete the scheduled general ward round in Ward A.',
    tag: 'ward-round',
    locationId: 'ward-a',
    team: [{ employeeId: 'emp-sarah-j', isPrimary: true }],
  },
  {
    id: 'tue-theatre',
    title: 'Theatre Preparation',
    shiftDate: '2026-10-20',
    startTime: '07:30',
    endTime: '09:00',
    status: 'Scheduled',
    description: 'Prepare Operating Theatre 1 for scheduled procedures.',
    tag: 'theatre',
    locationId: 'operating-theatre-1',
    team: [{ employeeId: 'emp-sarah-j', isPrimary: true }],
  },
  {
    id: 'tue-recovery',
    title: 'Post-Op Recovery',
    shiftDate: '2026-10-20',
    startTime: '14:00',
    endTime: '15:00',
    status: 'Scheduled',
    description: 'Support post-operative recovery checks in the recovery ward.',
    tag: 'recovery',
    locationId: 'recovery-ward',
    team: [{ employeeId: 'emp-sarah-j', isPrimary: true }],
  },
  {
    id: 'wed-kennel',
    title: 'Kennel Block Check',
    shiftDate: '2026-10-21',
    startTime: '08:30',
    endTime: '09:30',
    status: 'Scheduled',
    description: 'Complete the scheduled kennel block check.',
    tag: 'kennel',
    locationId: 'kennel-block',
    team: [{ employeeId: 'emp-sarah-j', isPrimary: true }],
  },
  {
    id: 'wed-stock',
    title: 'Equipment Stock Check',
    shiftDate: '2026-10-21',
    startTime: '13:00',
    endTime: '14:00',
    status: 'Scheduled',
    description: 'Check equipment stock levels in stores.',
    tag: 'stock',
    locationId: 'stores',
    team: [{ employeeId: 'emp-sarah-j', isPrimary: true }],
  },
  {
    id: 'thu-outreach',
    title: 'Outreach Preparation',
    shiftDate: '2026-10-22',
    startTime: '09:00',
    endTime: '10:00',
    status: 'Scheduled',
    description: 'Prepare outreach supplies and the vehicle bay for scheduled outreach.',
    tag: 'outreach',
    locationId: 'outreach-bay',
    team: [{ employeeId: 'emp-sarah-j', isPrimary: true }],
  },
  {
    id: 'thu-sterilise',
    title: 'Treatment Area Sterilisation',
    shiftDate: '2026-10-22',
    startTime: '15:00',
    endTime: '16:00',
    status: 'Scheduled',
    description: 'Sterilise treatment surfaces in Ward C.',
    tag: 'sterilisation',
    locationId: 'ward-c',
    team: [{ employeeId: 'emp-sarah-j', isPrimary: true }],
  },
  {
    id: 'next-intake',
    title: 'Morning Intake Briefing',
    shiftDate: '2026-10-26',
    startTime: '08:00',
    endTime: '09:00',
    status: 'Scheduled',
    description: 'Complete the morning intake briefing in the receiving area.',
    tag: 'intake',
    locationId: 'receiving-area',
    team: [{ employeeId: 'emp-sarah-j', isPrimary: true }],
  },
  {
    id: 'next-treatment',
    title: 'Treatment Bay Readiness',
    shiftDate: '2026-10-27',
    startTime: '10:00',
    endTime: '11:00',
    status: 'Scheduled',
    description: 'Confirm treatment bay readiness in Ward A.',
    tag: 'treatment',
    locationId: 'ward-a',
    team: [{ employeeId: 'emp-sarah-j', isPrimary: true }],
  },
  {
    id: 'next-outreach',
    title: 'Outreach Vehicle Check',
    shiftDate: '2026-10-28',
    startTime: '09:30',
    endTime: '10:30',
    status: 'Scheduled',
    description: 'Complete the outreach vehicle check in the service bay.',
    tag: 'outreach',
    locationId: 'service-bay',
    team: [{ employeeId: 'emp-sarah-j', isPrimary: true }],
  },
  {
    id: 'next-inventory',
    title: 'Inventory Reconciliation',
    shiftDate: '2026-10-29',
    startTime: '14:00',
    endTime: '15:00',
    status: 'Scheduled',
    description: 'Reconcile inventory in stores.',
    tag: 'inventory',
    locationId: 'stores',
    team: [{ employeeId: 'emp-sarah-j', isPrimary: true }],
  },
  {
    id: 'next-handover',
    title: 'Weekly Handover',
    shiftDate: '2026-10-30',
    startTime: '15:00',
    endTime: '16:00',
    status: 'Scheduled',
    description: 'Complete the weekly operational handover.',
    tag: 'handover',
    locationId: 'operations-hub',
    team: [{ employeeId: 'emp-sarah-j', isPrimary: true }],
  },
];
