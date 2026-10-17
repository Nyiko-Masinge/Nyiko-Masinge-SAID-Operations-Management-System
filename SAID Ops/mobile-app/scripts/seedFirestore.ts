import { readFileSync } from 'node:fs';
import { resolve } from 'path';

import { initializeApp } from 'firebase/app';
import { collection, doc, getFirestore, writeBatch } from 'firebase/firestore';

import {
  seedEmployees,
  seedLocations,
  seedRoles,
  seedShifts,
} from '../data/firestoreSeed';

/**
 * One-off connectivity-proof seed for said-ops-test.
 * Historical fixture utility only: WS5 rules are now authoritative and deny
 * these unauthenticated writes. Never run this seed against the shared project.
 *
 * Run from mobile-app: npm run seed:firestore
 */
function loadDotEnv(filePath: string) {
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(resolve(process.cwd(), '.env'));

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  throw new Error(
    `Missing Firebase config: ${missing.join(', ')}. Set EXPO_PUBLIC_FIREBASE_* in .env.`,
  );
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedCollection<T extends { id: string }>(
  batch: ReturnType<typeof writeBatch>,
  collectionName: string,
  documents: T[],
) {
  for (const document of documents) {
    batch.set(doc(collection(db, collectionName), document.id), document);
  }
}

async function main() {
  const batch = writeBatch(db);
  seedCollection(batch, 'roles', seedRoles);
  seedCollection(batch, 'employees', seedEmployees);
  seedCollection(batch, 'locations', seedLocations);
  seedCollection(batch, 'shifts', seedShifts);
  await batch.commit();

  console.log(
    [
      'Firestore seed complete (test-mode project; not production-safe).',
      `roles: ${seedRoles.length}`,
      `employees: ${seedEmployees.length}`,
      `locations: ${seedLocations.length}`,
      `shifts: ${seedShifts.length}`,
    ].join('\n'),
  );
  process.exit(0);
}

void main().catch((error: unknown) => {
  console.error('Firestore seed failed.', error);
  process.exit(1);
});
