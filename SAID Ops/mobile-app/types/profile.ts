export type DemoStaffProfile = {
  editable: {
    fullName: string;
    notificationsEnabled: boolean;
    workEmail: string;
    workPhone: string;
  };
  employment: {
    joined: string;
    status: 'Active';
  };
  operational: {
    access: string;
    department: string;
    operationalRole: string;
    // See the comment on DemoTask.locationId in types/tasks.ts — same placeholder-until-resolved
    // convention applies here.
    primaryLocationId: string;
    staffId: string;
    systemRole: string;
  };
  skills: string[];
};

export function getStaffInitials(fullName: string) {
  return fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'SA';
}
