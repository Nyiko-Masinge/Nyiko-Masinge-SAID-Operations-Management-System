export type Employee = {
  id: string;
  firstName: string;
  surname: string;
  email: string;
  phoneNumber: string;
  profilePictureUrl?: string;
  roleId: string;
};

export type TeamMember = {
  employeeId: string;
  isPrimary?: boolean;
  displayName?: string;
  jobCategory?: string;
};
