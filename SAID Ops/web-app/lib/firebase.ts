import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

// Client configuration only (public identifiers, not secrets). Real values go in an
// ignored `.env.local`; see `.env.example`. NEXT_PUBLIC_ variables must be referenced
// statically so Next.js can inline them at build time.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const PLACEHOLDER_PREFIX = 'your-';

const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS_ENABLED === 'true';
type FirebaseRuntime = {
  authByApp: WeakMap<FirebaseApp, Auth>;
  authEmulators: WeakSet<Auth>;
  firestoreEmulators: WeakSet<Firestore>;
};
// Survives development module reloads; services are tracked by their actual instance.
const runtimeGlobal = globalThis as typeof globalThis & { __saidWebFirebaseRuntime?: FirebaseRuntime };
function runtime(): FirebaseRuntime {
  return runtimeGlobal.__saidWebFirebaseRuntime ??= {
    authByApp: new WeakMap(), authEmulators: new WeakSet(), firestoreEmulators: new WeakSet(),
  };
}

function emulatorEndpoints(): { authUrl: string; host: string; port: number } | null {
  if (!useEmulators) return null;
  if (!config.projectId?.startsWith('demo-')) throw new Error('Emulator mode requires a demo- Firebase project ID.');
  const authUrl = new URL(process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL ?? '');
  const host = process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST ?? '';
  const port = Number(process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT);
  if (authUrl.protocol !== 'http:' || !authUrl.hostname || !authUrl.port ||
      authUrl.username || authUrl.password || authUrl.pathname !== '/' || authUrl.search || authUrl.hash ||
      !/^[a-zA-Z0-9.-]+$/.test(host) || host.startsWith('your-') ||
      !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Set an HTTP Auth emulator URL with a port, and a Firestore emulator host/port. Physical devices need a reachable development-machine host.');
  }
  return { authUrl: authUrl.origin, host, port };
}

export function isFirebaseConfigured(): boolean {
  return Object.values(config).every((value) => Boolean(value) && !String(value).startsWith(PLACEHOLDER_PREFIX));
}

// Lazy, so pages can be prerendered at build time without Firebase credentials.
function getFirebaseApp(): FirebaseApp {
  emulatorEndpoints(); // Reject invalid opt-in before creating or using any service.
  return getApps().length ? getApp() : initializeApp(config);
}

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp());
  const endpoints = emulatorEndpoints();
  if (endpoints && !runtime().authEmulators.has(auth)) {
    connectAuthEmulator(auth, endpoints.authUrl, { disableWarnings: true });
    runtime().authEmulators.add(auth);
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  const db = getFirestore(getFirebaseApp());
  const endpoints = emulatorEndpoints();
  if (endpoints && !runtime().firestoreEmulators.has(db)) {
    connectFirestoreEmulator(db, endpoints.host, endpoints.port);
    runtime().firestoreEmulators.add(db);
  }
  return db;
}
