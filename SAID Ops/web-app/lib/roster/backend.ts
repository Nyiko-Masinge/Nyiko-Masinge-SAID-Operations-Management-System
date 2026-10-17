// Firebase configuration alone never enables workforce/publication integration.
export const firestoreRosterEnabled = process.env.NEXT_PUBLIC_ROSTER_BACKEND === 'firestore';
