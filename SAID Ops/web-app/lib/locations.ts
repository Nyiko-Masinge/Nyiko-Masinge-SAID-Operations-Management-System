import {
  addDoc, collection, doc, DocumentData, getDoc, getDocs, orderBy, query, updateDoc,
} from 'firebase/firestore';

import { getFirebaseDb } from './firebase';

// Shapes follow the Task 1 Source of Truth (FR-3: operational areas/locations must be
// supervisor-managed data, not hardcoded strings). Do not add fields here without team
// agreement; see docs/DEVELOPMENT_CONTRACT.md.
// Mirrors mobile-app/lib/locations.ts — the two apps don't share a build step, so this is
// kept in sync by hand until the group agrees on a shared package, same as employee.ts/roles.ts.
export type Location = {
  id: string;
  name: string;
  // PROPOSED: soft-delete flag so a location can be retired without breaking historical
  // shifts/duties that still reference its id (FR-3 calls this "retire", not "delete").
  // Confirm the exact field name with the team before other workstreams depend on it.
  active: boolean;
};

// employees, duties, and shifts reference a location by this id (locationId), never by name.
export const LOCATIONS_COLLECTION = 'locations';

function toLocation(id: string, data: DocumentData): Location {
  return { id, name: data.name as string, active: (data.active as boolean | undefined) ?? true };
}

export async function getLocation(id: string): Promise<Location | null> {
  const snap = await getDoc(doc(getFirebaseDb(), LOCATIONS_COLLECTION, id));
  return snap.exists() ? toLocation(snap.id, snap.data()) : null;
}

// All locations (active and retired), alphabetised. The supervisor management screen needs
// retired ones too, since they must stay visible/re-activatable, not disappear.
export async function getAllLocations(): Promise<Location[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, LOCATIONS_COLLECTION), orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toLocation(d.id, d.data()));
}

// Active locations only, alphabetised — what staff/duty/roster pickers should offer, since a
// retired location shouldn't be assignable to anything new. Filters client-side, not with a
// Firestore where('active','==',true) clause: that query silently excludes any document that
// doesn't have the active field at all, which is exactly the shape of a location created before
// this field existed. toLocation() already treats a missing field as active=true for reads; the
// query-side filter has to agree with that, not override it.
export async function getActiveLocations(): Promise<Location[]> {
  const all = await getAllLocations();
  return all.filter((l) => l.active !== false);
}

export async function createLocation(name: string): Promise<Location> {
  const trimmed = name.trim();
  const ref = await addDoc(collection(getFirebaseDb(), LOCATIONS_COLLECTION), { name: trimmed, active: true });
  return { id: ref.id, name: trimmed, active: true };
}

export async function renameLocation(id: string, name: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), LOCATIONS_COLLECTION, id), { name: name.trim() });
}

export async function setLocationActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), LOCATIONS_COLLECTION, id), { active });
}
