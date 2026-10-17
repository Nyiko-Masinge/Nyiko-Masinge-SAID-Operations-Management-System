import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '../lib/firebase';
import { employeeIdToSyntheticEmail } from '../lib/authIdentity';
import type { Employee, Role } from '../lib/employee';
import { isStaffRole } from '../lib/roles';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
type AuthState = { status: AuthStatus; user: User | null; employee: Employee | null; role: Role | null };

type AuthContextValue = AuthState & {
  accessError: string | null;
  signIn: (employeeId: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // Employee ID accounts use a synthetic Firebase email (see lib/authIdentity.ts), so Firebase
  // can't deliver a reset link. This always rejects with an explanatory message — self-service
  // reset is a follow-up item, not yet agreed with Nyiko.
  resetPassword: (employeeId: string) => Promise<void>;
};

const SIGNED_OUT: AuthState = { status: 'signedOut', user: null, employee: null, role: null };
export const NOT_CONFIGURED_MESSAGE = 'Firebase is not configured for this app yet. Ask your workstream lead to add the EXPO_PUBLIC_FIREBASE_* values to .env.';

class AccessError extends Error {}

// PROPOSED: the employee document id is the Firebase Auth UID (employees/{uid}).
// Confirm with the team before other workstreams depend on it.
async function loadStaffProfile(user: User): Promise<{ employee: Employee; role: Role }> {
  const db = getFirebaseDb();
  const employeeSnap = await getDoc(doc(db, 'employees', user.uid));
  if (!employeeSnap.exists()) throw new AccessError('No staff profile is linked to this account. Contact your supervisor.');
  const employee = { ...(employeeSnap.data() as Omit<Employee, 'id'>), id: employeeSnap.id };

  const roleSnap = await getDoc(doc(db, 'roles', employee.roleId));
  if (!roleSnap.exists()) throw new AccessError('Your role could not be found. Contact your supervisor.');
  const role: Role = { id: roleSnap.id, name: (roleSnap.data() as { name: string }).name };

  if (!isStaffRole(role)) throw new AccessError('This account has supervisor access. Please use the SAID Ops web app instead.');
  return { employee, role };
}

export function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code)) return 'Incorrect Employee ID or password.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a moment and try again.';
  if (code === 'auth/user-disabled') return 'This account has been disabled. Contact your supervisor.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider missing');
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...SIGNED_OUT, status: 'loading' });
  const [accessError, setAccessError] = useState<string | null>(null);
  const authGeneration = useRef(0);

  useEffect(() => {
    if (!isFirebaseConfigured()) { setState(SIGNED_OUT); return; }
    const auth = getFirebaseAuth();
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const generation = ++authGeneration.current;
      if (!user) { setState(SIGNED_OUT); return; }
      const current = () => active && generation === authGeneration.current && auth.currentUser?.uid === user.uid;
      setState({ ...SIGNED_OUT, status: 'loading' });
      setAccessError(null);
      try {
        const { employee, role } = await loadStaffProfile(user);
        if (!current()) return;
        setAccessError(null);
        setState({ status: 'signedIn', user, employee, role });
      } catch (error) {
        if (!current()) return;
        setState(SIGNED_OUT);
        setAccessError(error instanceof AccessError ? error.message : 'We could not load your staff profile. Please try again.');
        await firebaseSignOut(auth);
      }
    });
    return () => { active = false; authGeneration.current++; unsubscribe(); };
  }, []);

  const signIn = useCallback(async (employeeId: string, password: string) => {
    if (!isFirebaseConfigured()) throw new Error(NOT_CONFIGURED_MESSAGE);
    setAccessError(null);
    // Employee ID is never sent to Firebase directly — only the derived synthetic email is.
    await signInWithEmailAndPassword(getFirebaseAuth(), employeeIdToSyntheticEmail(employeeId), password);
  }, []);

  const signOut = useCallback(async () => {
    authGeneration.current++;
    setState(SIGNED_OUT);
    setAccessError(null);
    if (isFirebaseConfigured()) await firebaseSignOut(getFirebaseAuth());
  }, []);

  const resetPassword = useCallback(async () => {
    // No real inbox exists for the synthetic Firebase email, so Firebase's reset-link email
    // can never arrive. Until an admin-side reset flow is agreed with Nyiko, point the user
    // at a human instead of pretending this works.
    throw new Error('Self-service password reset is not available for Employee ID accounts yet. Contact your supervisor or administrator to reset your password.');
  }, []);

  const value = useMemo(() => ({ ...state, accessError, signIn, signOut, resetPassword }), [state, accessError, signIn, signOut, resetPassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
