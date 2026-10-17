import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, initializeAuth } from 'firebase/auth';
// Code Attribution — Tival Koovarjee (ST10377152), React Native Auth integration.
// This existing type suppression addresses the import discrepancy reported in issue #9316.
// yakupafsin (2025) 'TypeScript: getReactNativePersistence not exported from firebase/auth'.
// https://github.com/firebase/firebase-js-sdk/issues/9316
// Accessed: 5 October 2026.
// @ts-expect-error — firebase/auth's TypeScript types don't list the React Native entry
// point yet, even though Metro (Expo's bundler) resolves it correctly at runtime. This is
// a known upstream gap: https://github.com/firebase/firebase-js-sdk/issues/9316
import { getReactNativePersistence } from 'firebase/auth';
import { Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Client configuration only (public identifiers, not secrets). Real values go in an
// ignored local `.env` file (EXPO_PUBLIC_* vars); see `.env.example`.
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const PLACEHOLDER_PREFIX = 'your-';

const useEmulators = process.env.EXPO_PUBLIC_FIREBASE_EMULATORS_ENABLED === 'true';
type FirebaseRuntime = {
  authByApp: WeakMap<FirebaseApp, Auth>;
  authEmulators: WeakSet<Auth>;
  firestoreEmulators: WeakSet<Firestore>;
};
// Survives development module reloads; services are tracked by their actual instance.
const runtimeGlobal = globalThis as typeof globalThis & { __saidMobileFirebaseRuntime?: FirebaseRuntime };
function runtime(): FirebaseRuntime {
  return runtimeGlobal.__saidMobileFirebaseRuntime ??= {
    authByApp: new WeakMap(), authEmulators: new WeakSet(), firestoreEmulators: new WeakSet(),
  };
}

function emulatorEndpoints(): { authUrl: string; host: string; port: number } | null {
  if (!useEmulators) return null;
  if (!config.projectId?.startsWith('demo-')) throw new Error('Emulator mode requires a demo- Firebase project ID.');
  const authUrl = new URL(process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL ?? '');
  const host = process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST ?? '';
  const port = Number(process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT);
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

function getFirebaseApp(): FirebaseApp {
  emulatorEndpoints(); // Reject invalid opt-in before creating or using any service.
  return getApps().length ? getApp() : initializeApp(config);
}

// initializeAuth (with AsyncStorage persistence) must only be called once per app instance,
// including module reloads. Emulator routing completes before the instance is returned.
export function getFirebaseAuth(): Auth {
  const app = getFirebaseApp();
  let cachedAuth = runtime().authByApp.get(app);
  if (!cachedAuth) {
    // Code Attribution — Tival Koovarjee (ST10377152), persistent mobile login.
    // This initialization follows Expo's initializeAuth/getReactNativePersistence setup.
    // Expo (n.d.) 'Recommended Additional Setup for Firebase Authentication'.
    // https://github.com/expo/fyi/blob/main/firebase-js-auth-setup.md
    // Accessed: 5 October 2026.
    cachedAuth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    runtime().authByApp.set(app, cachedAuth);
  }
  const endpoints = emulatorEndpoints();
  if (endpoints && !runtime().authEmulators.has(cachedAuth)) {
    connectAuthEmulator(cachedAuth, endpoints.authUrl, { disableWarnings: true });
    runtime().authEmulators.add(cachedAuth);
  }
  return cachedAuth;
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

// WS3 task clients share WS1's app and persistent Auth instance. Configuration
// alone does not enable live tasks; each task must be explicitly marked isLive.
export const FIREBASE_CONFIGURED = isFirebaseConfigured();
export const auth = FIREBASE_CONFIGURED ? getFirebaseAuth() : null;
export const db = FIREBASE_CONFIGURED ? getFirebaseDb() : null;
