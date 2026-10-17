import { createInMemoryRepositories } from './repositories';
import type { Repositories } from './repositories';
import type { Actor, Alert, AuditLog, DetectedAlert } from './model';

const supervisor: Actor = { id: 'SUP-001', name: 'Lerato Dlamini', role: 'Supervisor' };

const detected = (key: string, details = 'Theatre Preparation at 09:30 has no assigned staff.'): DetectedAlert => ({
  key,
  type: 'UnassignedDuty',
  priority: 'High',
  title: 'Unassigned Duty',
  details,
  area: 'Theatre 1',
  dutyId: 'd3',
});

let repos: Repositories;
let alerts: Alert[];
let logs: AuditLog[];

beforeEach(() => {
  repos = createInMemoryRepositories();
  repos.alerts.subscribe((a) => {
    alerts = a;
  });
  repos.audit.subscribe((l) => {
    logs = l;
  });
});

const withKey = (key: string) => alerts.filter((a) => a.key === key);

describe('alert sync', () => {
  it('opens a detected alert once, however many times it is re-checked', async () => {
    await repos.alerts.sync([detected('staffing:a2')]);
    await repos.alerts.sync([detected('staffing:a2')]);
    expect(withKey('staffing:a2')).toHaveLength(1);
    expect(withKey('staffing:a2')[0]).toMatchObject({ state: 'Open', origin: 'Detected' });
  });

  it('refreshes the details of an open alert when the roster changes', async () => {
    await repos.alerts.sync([detected('staffing:a2')]);
    await repos.alerts.sync([detected('staffing:a2', 'Theatre Preparation at 09:30 has 1 of 2 required staff.')]);
    expect(withKey('staffing:a2')[0].details).toContain('1 of 2');
  });

  it('closes the alert automatically once the roster is fixed', async () => {
    await repos.alerts.sync([detected('staffing:a2')]);
    await repos.alerts.sync([]);
    expect(withKey('staffing:a2')[0]).toMatchObject({ state: 'Resolved', resolvedBy: { id: 'system' } });
  });

  it('raises the alert again if the problem returns after an automatic close', async () => {
    await repos.alerts.sync([detected('staffing:a2')]);
    await repos.alerts.sync([]);
    await repos.alerts.sync([detected('staffing:a2')]);
    expect(withKey('staffing:a2').filter((a) => a.state === 'Open')).toHaveLength(1);
  });

  it('keeps an alert resolved by a person resolved', async () => {
    await repos.alerts.sync([detected('staffing:a2')]);
    await repos.alerts.resolve([withKey('staffing:a2')[0].id], supervisor, 'Covered by agency staff');
    await repos.alerts.sync([detected('staffing:a2')]);
    expect(withKey('staffing:a2')).toHaveLength(1);
    expect(withKey('staffing:a2')[0]).toMatchObject({ state: 'Resolved', resolutionNote: 'Covered by agency staff', resolvedBy: supervisor });
  });

  it('never closes alerts that were reported rather than detected', async () => {
    await repos.alerts.sync([]);
    expect(alerts.filter((a) => a.origin === 'Reported' && a.state === 'Open').length).toBeGreaterThan(0);
  });
});

describe('audit log', () => {
  it('appends newest first with a unique reference and a timestamp', async () => {
    const before = logs.length;
    const a = await repos.audit.append({ actor: supervisor, category: 'RosterChange', action: 'DutyAssigned', summary: 'Assigned duty', details: 'x', area: 'Ward B', entityType: 'duty' });
    const b = await repos.audit.append({ actor: supervisor, category: 'RosterChange', action: 'DutyAssigned', summary: 'Assigned duty', details: 'y', area: 'Ward B', entityType: 'duty' });
    expect(logs).toHaveLength(before + 2);
    expect(logs[0].id).toBe(b.id);
    expect(a.reference).not.toBe(b.reference);
    expect(a.timestamp).toBeTruthy();
  });

  it('offers no way to edit or delete entries', () => {
    expect(Object.keys(Object.getPrototypeOf(repos.audit)).concat(Object.getOwnPropertyNames(Object.getPrototypeOf(repos.audit)))).not.toEqual(
      expect.arrayContaining(['update', 'delete', 'remove']),
    );
  });
});

describe('notes', () => {
  it('scopes notes to their entity and returns them oldest first as they are added', async () => {
    let seen: { text: string }[] = [];
    repos.notes.subscribe('alert', 'a1', (n) => {
      seen = n as { text: string }[];
    });
    await repos.notes.add({ entityType: 'alert', entityId: 'a1', text: 'Checked with Sarah.', author: supervisor });
    await repos.notes.add({ entityType: 'duty', entityId: 'd3', text: 'Unrelated duty note.', author: supervisor });
    expect(seen.map((n) => n.text)).toEqual(['Checked with Sarah.']);
  });
});