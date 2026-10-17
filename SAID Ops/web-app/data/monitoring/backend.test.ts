import { chooseMonitoringBackend, monitoringAccessError, LIVE_MONITORING_PENDING } from './backend';

describe('chooseMonitoringBackend', () => {
  it('stays in memory when Firebase is configured but the flag is not set', () => {
    expect(chooseMonitoringBackend(true, undefined)).toBe('memory');
    expect(chooseMonitoringBackend(true, '')).toBe('memory');
  });

  it('stays in memory when the flag is set but Firebase is not configured', () => {
    expect(chooseMonitoringBackend(false, 'firestore')).toBe('memory');
  });

  it('keeps provisional Firestore adapters disabled even with an explicit request', () => {
    expect(chooseMonitoringBackend(true, 'firestore')).toBe('memory');
    expect(monitoringAccessError(true, 'firestore')).toBe(LIVE_MONITORING_PENDING);
  });

  it('tolerates case and stray whitespace in the flag', () => {
    expect(chooseMonitoringBackend(true, '  Firestore ')).toBe('memory');
    expect(monitoringAccessError(true, '  Firestore ')).toBe(LIVE_MONITORING_PENDING);
  });

  it('treats any other value as memory rather than guessing', () => {
    expect(chooseMonitoringBackend(true, 'true')).toBe('memory');
    expect(chooseMonitoringBackend(true, 'live')).toBe('memory');
  });

  it('reports missing live configuration while keeping demo mode error-free', () => {
    expect(monitoringAccessError(false, 'firestore')).toContain('Firebase configuration');
    expect(monitoringAccessError(true, 'memory')).toBeNull();
    expect(monitoringAccessError(true, undefined)).toBeNull();
  });
});
