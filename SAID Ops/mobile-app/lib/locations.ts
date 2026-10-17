import { collection, DocumentData, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';

import { getFirebaseDb } from './firebase';

// Shapes follow the Task 1 Source of Truth (FR-3: operational areas/locations are
// supervisor-managed data, not hardcoded strings). Do not add fields here without team
// agreement; see docs/DEVELOPMENT_CONTRACT.md.
// Mirrors web-app/lib/locations.ts — the two apps don't share a build step, so this is
// kept in sync by hand until the group agrees on a shared package, same as employee.ts/roles.ts.
export type Location = {
  id: string;
  name: string;
  // PROPOSED: soft-delete flag so a location can be retired without breaking historical
  // shifts/duties that still reference its id. Confirm the exact field name with whoever
  // builds the web CRUD screen before relying on it elsewhere.
  active: boolean;
};

// employees, duties, and shifts reference a location by this id (locationId), never by name.
export const LOCATIONS_COLLECTION = 'locations';

function toLocation(id: string, data: DocumentData): Location {
  return { id, name: data.name as string, active: (data.active as boolean | undefined) ?? true };
}

export async function getLocation(locationId: string): Promise<Location | null> {
  const snap = await getDoc(doc(getFirebaseDb(), LOCATIONS_COLLECTION, locationId));
  return snap.exists() ? toLocation(snap.id, snap.data()) : null;
}

// All locations (active and retired), alphabetised. getActiveLocations filters this client-side
// rather than querying Firestore with where('active','==',true) -- see the comment there.
export async function getAllLocations(): Promise<Location[]> {
  const db = getFirebaseDb();
  // Code Attribution — Tival Koovarjee (ST10377152), location query.
  // This ordering uses Firestore's automatic ascending field-index pattern.
  // Google Cloud (n.d.) 'Standard edition index overview'.
  // https://docs.cloud.google.com/firestore/native/docs/standard-index-overview
  // Accessed: 5 October 2026.
  const q = query(collection(db, LOCATIONS_COLLECTION), orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toLocation(d.id, d.data()));
}

// Active locations only, alphabetised — for new selections. Saved IDs use all locations.
// Filters client-side, not with a Firestore where('active','==',true) clause: that query
// silently excludes any document that doesn't have the active field at all, which is exactly
// the shape of a location created before this field existed. toLocation() already treats a
// missing field as active=true for reads; the query-side filter has to agree with that.
export async function getActiveLocations(): Promise<Location[]> {
  const all = await getAllLocations();
  // Code Attribution — Tival Koovarjee (ST10377152), legacy-area compatibility.
  // This local filter retains missing active fields; Firestore != queries exclude missing
  // fields, as documented by Kerpelman, T. (2020) 'Cloud Firestore now supports not equal queries'.
  // https://firebase.blog/posts/2020/09/cloud-firestore-not-equal-queries
  // Accessed: 5 October 2026.
  return all.filter((l) => l.active !== false);
}

// Convenience for screens that just need to show a name for a known locationId
// (e.g. a duty card, a staff profile's Primary Location row) without a live listener.
export async function getLocationName(locationId: string): Promise<string> {
  const location = await getLocation(locationId);
  return location?.name ?? 'Unknown location';
}
