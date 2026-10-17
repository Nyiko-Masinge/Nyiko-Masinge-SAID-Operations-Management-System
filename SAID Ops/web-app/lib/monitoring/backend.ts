import {firestoreRosterEnabled} from '../roster/backend';
// An explicit memory choice preserves local demonstrations. Live roster defaults to live monitoring.
export const liveMonitoringEnabled=process.env.NEXT_PUBLIC_MONITORING_BACKEND==='firestore'||(firestoreRosterEnabled&&process.env.NEXT_PUBLIC_MONITORING_BACKEND!=='memory');
