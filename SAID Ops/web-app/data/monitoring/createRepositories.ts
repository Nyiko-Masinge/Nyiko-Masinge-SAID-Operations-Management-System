import { monitoringUnavailableReason } from '../../lib/dataSource';
import { createInMemoryRepositories, createUnavailableRepositories } from './repositories';
import type { Repositories } from './repositories';

/**
 * The one place that decides which backend runs the monitoring feature.
 *
 * Demo uses memory. Explicit live requests report unavailable while shared contracts
 * remain provisional; they cannot load or write the old Firestore adapters.
 */
export function createRepositories(): Repositories {
  if (monitoringUnavailableReason) return createUnavailableRepositories(monitoringUnavailableReason);
  return createInMemoryRepositories();
}
