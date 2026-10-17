import { useEffect, useState } from 'react';

import { getAllLocations, Location } from './locations';
import { useAuth } from '../components/AuthProvider';

// Fetches the live `locations` collection once Firebase Auth has resolved to a signed-in
// session, not on mount regardless of auth state. Firestore security rules require
// request.auth != null to read this collection, so firing the query before sign-in resolves
// (or while signed out) only produces a permission-denied error that this hook used to swallow
// silently. Waiting on `status` avoids that, and a signed-out screen no longer shows a
// spurious error banner.
// `locationName(id)` resolves a locationId to its Firestore name; if nothing matches yet (e.g.
// Task 1 prototype demo data still carries a placeholder name instead of a real Firestore id --
// see types/tasks.ts), it falls back to showing the id/placeholder itself rather than a broken
// lookup. `error` is the one real failure case (the fetch itself failed) and is surfaced, not
// swallowed, so a screen can show it and offer `retry()`.
export function useLocations() {
  const { status, user } = useAuth();
  const uid = user?.uid;
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (status !== 'signedIn') {
      // Still resolving auth, or genuinely signed out -- neither is a load failure.
      setAllLocations([]);
      setError(null);
      setLoading(status === 'loading');
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAllLocations()
      .then((fetched) => {
        if (cancelled) return;
        setAllLocations(fetched);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load operational areas. Check your connection and try again.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status, uid, attempt]);

  // New selections use active areas; saved references still resolve retired names.
  const locations = allLocations.filter((l) => l.active !== false);
  const locationName = (id: string) => allLocations.find((l) => l.id === id)?.name ?? id;
  const retry = () => setAttempt((n) => n + 1);

  return { locations, loading, error, locationName, retry };
}
