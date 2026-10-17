import { collection, getDocsFromServer } from 'firebase/firestore';
import { getFirebaseDb } from '../firebase';
import type { Staff } from '../../components/OpsProvider';
import { availabilityAt, validAvailability, validStringList, revisionOf } from '../planning/model';

export function mapWorkforce(uid: string, profile: Record<string, unknown>): Staff {
  if (typeof profile.employeeId !== 'string' || !profile.employeeId.trim() ||
      typeof profile.firstName !== 'string' || typeof profile.surname !== 'string' || typeof profile.roleId !== 'string')
    throw new Error('Workforce identity requires trusted provisioning repair.');
  const availabilityPlan = validAvailability(profile.availability) ? profile.availability : undefined;
  const skillsKnown = validStringList(profile.skills);
  return {
    id: profile.employeeId, employeeId: profile.employeeId, uid,
    name: `${profile.firstName} ${profile.surname}`.trim(),
    role: typeof profile.jobCategory === 'string' ? profile.jobCategory : 'Not provisioned',
    locationId: typeof profile.locationId === 'string' ? profile.locationId : '',
    status: typeof profile.active === 'boolean' ? profile.active ? 'Active' : 'Inactive' : 'Unknown',
    availability: availabilityPlan ? availabilityAt(availabilityPlan, new Date().toISOString()) : 'Unknown',
    availabilityPlan, workload: 0, skills: skillsKnown ? profile.skills as string[] : [], skillsKnown,
    operationalMissing: typeof profile.active !== 'boolean' || !availabilityPlan || !skillsKnown ||
      typeof profile.jobCategory !== 'string' || !profile.jobCategory.trim() || typeof profile.locationId !== 'string' || !profile.locationId,
    revision: revisionOf(profile),
    email: typeof profile.contactEmail === 'string' ? profile.contactEmail : '',
    phone: typeof profile.phoneNumber === 'string' ? profile.phoneNumber : '',
  };
}

export async function loadWorkforce(): Promise<Staff[]> {
  const snapshot = await getDocsFromServer(collection(getFirebaseDb(), 'employees'));
  const ids = new Set<string>();
  return snapshot.docs.map(record => {
    const profile = record.data();
    if (typeof profile.employeeId !== 'string' || !profile.employeeId.trim() ||
        typeof profile.firstName !== 'string' || typeof profile.surname !== 'string' ||
        typeof profile.roleId !== 'string' || ids.has(profile.employeeId)) {
      throw new Error('Workforce profiles have missing or duplicate business Employee IDs. Correct trusted provisioning.');
    }
    ids.add(profile.employeeId);
    return {
      ...mapWorkforce(record.id, profile),
    };
  });
}
