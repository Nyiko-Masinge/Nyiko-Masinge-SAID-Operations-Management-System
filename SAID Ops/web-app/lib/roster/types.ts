// Internal in-memory scheduling shapes. These do not define Firestore documents.
export type DutyTemplate = {
  id: string;
  name: string;
  description: string;
  area: string;
  locationId?: string; // Shared WS1 location identity; area remains the session snapshot name.
  time: string;
  duration: string;
  required: number;
  recurrence: string;
  priority: 'High' | 'Medium' | 'Low';
  isCritical: boolean;
  status: 'Active' | 'Inactive';
  requirements: string[];
  requiredSkills?: string[]; // Distinct from instructions; legacy local templates may omit it.
  revision?: number;
  publicationFallback?: boolean; // Recovered source reference, never a durable editable template.
};

export type ScheduledWork = {
  id: string;
  dutyId?: string; // Absent for an ad-hoc roster item.
  title: string;
  description: string;
  date: string; // Local roster date, YYYY-MM-DD; not a persistence timestamp.
  startTime: string; // HH:mm on date.
  endTime: string; // HH:mm on date; mock duties do not cross midnight.
  area: string;
  locationId?: string; // Shared WS1 location identity; area remains the session snapshot name.
  required: number;
  staffIds: string[];
  isCritical: boolean; // Template snapshot; later template edits do not rewrite dated work.
  priority?: DutyTemplate['priority']; // Preserve legitimate priority from a published occurrence.
  requiredSkills?: string[];
  requirements?: string[];
};

export type ScheduleInput = Omit<ScheduledWork, 'id' | 'staffIds' | 'isCritical'>;

export type StaffForAssignment = {
  id: string;
  availability: 'Available' | 'On Duty' | 'On Leave' | 'Training' | 'Unavailable' | 'Unknown';
  status?: 'Active' | 'Inactive' | 'Unknown';
  availabilityPlan?: import('../planning/model').Availability;
  operationalMissing?: boolean;
  publicationFallback?: boolean;
  skills?: string[];
};

export type AssignmentResult =
  | { ok: true }
  | { ok: false; code: 'WORK_NOT_FOUND' | 'STAFF_NOT_FOUND' | 'INACTIVE' | 'UNAVAILABLE' | 'DUPLICATE' | 'OVERLAP'; conflictingWorkId?: string };

export type RosterFailure = { ok: false; code:
  | 'WORK_NOT_FOUND' | 'STAFF_NOT_FOUND' | 'ASSIGNMENT_NOT_FOUND' | 'ARCHIVED'
  | 'INACTIVE' | 'UNAVAILABLE' | 'DUPLICATE' | 'OVERLAP'
  | 'INVALID_ID' | 'DUPLICATE_WORK_ID' | 'TITLE_REQUIRED' | 'INVALID_DATE'
  | 'INVALID_INTERVAL' | 'INVALID_REQUIRED' | 'AREA_REQUIRED'
  | 'TEMPLATE_NOT_FOUND' | 'TEMPLATE_INACTIVE' | 'TEMPLATE_CHANGE_NOT_ALLOWED';
  conflictingWorkId?: string;
};

export type RosterActionResult = { ok: true } | RosterFailure;
export type RosterMutationResult = { ok: true; scheduled: ScheduledWork[] } | RosterFailure;

export type GenerationIssue = { sourceId: string; code: RosterFailure['code'] };
export type UnsupportedRecurrence = { templateId: string; recurrence: string };
export type RosterGenerationResult =
  | { ok: true; scheduled: ScheduledWork[]; created: number; skippedDuplicates: number;
      unsupported: UnsupportedRecurrence[]; invalid: GenerationIssue[]; sourceCount: number }
  | RosterFailure;

// Session-only publication contract. Task progress and persistence are separate.
export type RosterLifecycle = {
  status: 'Draft' | 'Published';
  hasUnpublishedChanges: boolean;
};

export type PublishedScheduledWork = Readonly<Omit<ScheduledWork, 'staffIds' | 'requiredSkills' | 'requirements'>> & {
  readonly staffIds: readonly string[];
  readonly requiredSkills?: readonly string[];
  readonly requirements?: readonly string[];
};

export type PublishedRoster = {
  readonly weekStart: string;
  readonly scheduledWork: readonly PublishedScheduledWork[];
};

export type PublishedRosters = Readonly<Record<string, PublishedRoster>>;

export type PublicationCounts = {
  itemCount: number;
  uncoveredCount: number;
  understaffedCount: number;
  uncoveredCriticalCount: number;
  conflictCount: number;
  coverageIssues?: import('./scheduling').CoverageIssue[];
  warnings?: string[];
};

export type PublicationResult =
  | ({ status: 'published'; republished: boolean; snapshot: PublishedRoster } & PublicationCounts)
  | ({ status: 'confirmation_required' } & PublicationCounts)
  | ({ status: 'validation_failed'; code: 'INVALID_WEEK' | 'INVALID_WORK' | 'DUPLICATE_WORK_ID' | 'SCHEDULING_CONFLICT';
      workId?: string; validationCode?: RosterFailure['code']; conflict?: { first: ScheduledWork; second: ScheduledWork; staffIds: string[] } } & PublicationCounts);
