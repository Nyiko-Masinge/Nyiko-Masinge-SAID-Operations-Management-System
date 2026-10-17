'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { liveMonitoringEnabled } from '../lib/monitoring/backend';
import { OperationalMonitoringProvider } from './OperationalMonitoringProvider';
import { useAuth } from './AuthProvider';
import { employeeFullName } from '../lib/employee';
import { toMonitoringRoster } from '../data/monitoring/rosterInput';
import type { RosterAssignment, RosterDuty } from '../data/monitoring/detect';
import { detectAlerts } from '../data/monitoring/detect';
import { notificationsForAssignmentChange } from '../data/monitoring/deriveNotifications';
import { writeNotification } from '../data/monitoring/notificationWriter';
import { createRepositories } from '../data/monitoring/createRepositories';
import type { MonitoringBackend } from '../data/monitoring/backend';
import type { Actor, Alert, AuditLog, NewAuditLog, NewNote, OperationalNote, Unsubscribe } from '../data/monitoring/model';
import { monitoringBackend, monitoringUnavailableReason } from '../lib/dataSource';
import { useOps } from './OpsProvider';
import type { Duty, Staff } from './OpsProvider';

export interface MonitoringValue {
  /** True until the first alerts update (success or failure) has arrived. */
  loading: boolean;
  /** True until the first History update (success or failure) has arrived. */
  historyLoading: boolean;
  /** 'memory' = demo mode (nothing is written to Firestore); 'firestore' = live persistence. */
  backend: MonitoringBackend;
  /** Latest background failure (a listener dropping, an unsaved History entry...). Null when none. */
  error: string | null;
  dismissError: () => void;
  /** True while the alerts / history subscriptions are failing, so screens can say "unavailable" rather than "empty". */
  alertsUnavailable: boolean;
  historyUnavailable: boolean;
  /** Every alert, resolved or not. */
  alerts: Alert[];
  /** Alerts that still need attention, highest priority first. Drives the badge, bell and dashboard. */
  openAlerts: Alert[];
  /** Newest first. */
  auditLogs: AuditLog[];
  /** Resolves alerts and writes one audit entry each. Rejects with a readable message if either step fails. */
  resolveAlerts: (ids: string[], note?: string) => Promise<void>;
  /** For other features (roster, duties, staff) to record their own events. The signed-in user is added automatically. */
  recordAudit: (entry: Omit<NewAuditLog, 'actor'>) => Promise<AuditLog>;
  /** Live notes for one duty/roster/alert. Call the returned function to stop listening. */
  subscribeNotes: (
    entityType: OperationalNote['entityType'],
    entityId: string,
    cb: (notes: OperationalNote[]) => void,
    onError?: (error: Error) => void,
  ) => Unsubscribe;
  /** Adds a note; the signed-in user is added automatically. Rejects if the note could not be saved. */
  addNote: (note: Omit<NewNote, 'author'>) => Promise<OperationalNote>;
}

export const MonitoringContext = createContext<MonitoringValue | null>(null);

const RANK = { High: 0, Medium: 1, Low: 2 } as const;

const errorMessage = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/**
 * Must be rendered inside <OpsProvider>. Alerts are detected from the roster it holds, and
 * staff / duty / assignment additions and edits are watched from it too (see the two effects
 * near the bottom) so that History stays accurate no matter which screen — Roster, Duties,
 * Staff, or the Alerts "Assign" action — actually made the change.
 *
 * Where data is stored is decided by `backend` (see data/monitoring/backend.ts): in demo mode
 * everything stays in memory, so fixture roster data can never write to or reconcile against
 * live Firestore just because Firebase happens to be configured.
 *
 * Actor identity comes from WS1. WS2 ScheduledWork supplies a read-only local
 * detection view; the former assignment model is never an independent authority.
 */
export function MonitoringProvider(props: { children: ReactNode }) {
  if(liveMonitoringEnabled) return <OperationalMonitoringProvider {...props} />;
  return DemoMonitoringProvider(props);
}
function DemoMonitoringProvider({ children }: { children: ReactNode }) {
  const { staff, duties, scheduledWork, locationName, locationsLoading, locationsError } = useOps();
  const { user, employee, role, status } = useAuth();
  const uid = user?.uid;
  const actor = useMemo<Actor | null>(() => status === 'signedIn' && user && employee && role
    ? { id: user.uid, name: employeeFullName(employee), role: role.name } : null, [status, user, employee, role]);
  const roster = useMemo(() => toMonitoringRoster(staff, duties, scheduledWork, locationName), [staff, duties, scheduledWork, locationName]);
  const assignments = roster.assignments;

  const repos = useMemo(() => createRepositories(), [uid]);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertsUnavailable, setAlertsUnavailable] = useState(false);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);

  // Every background failure is shown to the user.
  const reportError = useCallback((context: string, cause: unknown) => {
    setError(`${context}. ${errorMessage(cause)}`);
  }, []);
  const dismissError = useCallback(() => setError(null), []);

  useEffect(() => {
    const offAlerts = repos.alerts.subscribe(
      (a) => {
        setAlerts(a);
        setAlertsUnavailable(false);
        setLoading(false);
      },
      (cause) => {
        setAlertsUnavailable(true);
        setLoading(false);
        reportError('Alerts could not be loaded', cause);
      },
    );
    const offAudit = repos.audit.subscribe(
      (logs) => {
        setAuditLogs(logs);
        setHistoryUnavailable(false);
        setHistoryLoading(false);
      },
      (cause) => {
        setHistoryUnavailable(true);
        setHistoryLoading(false);
        reportError('History could not be loaded', cause);
      },
    );
    return () => {
      offAlerts();
      offAudit();
    };
  }, [repos, reportError]);

  // Re-check the roster whenever it changes. Later this runs in a Cloud Function on roster writes.
  useEffect(() => {
    // OpsProvider is fixture input; it must never reconcile a requested live backend.
    if (monitoringUnavailableReason || !actor || locationsLoading || locationsError) return;
    repos.alerts
      .sync(detectAlerts(roster))
      .catch((cause) => reportError('Alerts could not be updated from the roster', cause));
  }, [repos, roster, actor, locationsLoading, locationsError, reportError]);

  const recordAudit = useCallback(async (entry: Omit<NewAuditLog, 'actor'>) => {
    if (!actor) throw new Error('Sign in to record operational history.');
    return repos.audit.append({ actor, ...entry });
  }, [repos, actor]);

  // For the automatic watchers below, which have no screen to show a failure on.
  const logAudit = useCallback(
    (entry: Omit<NewAuditLog, 'actor'>) => {
      recordAudit(entry).catch((cause) => reportError('A History entry could not be saved', cause));
    },
    [recordAudit, reportError],
  );

  // The Staff screen (owned by another feature) calls OpsProvider's addStaff/updateStaff
  // directly and has no reason to know about the audit log. Rather than depending on that
  // screen to call recordAudit, watch the staff list here and log additions and field
  // changes automatically, so "Staff Changes" in History stays accurate either way.
  // Code Attribution — Ndivhuwo Ndou (ST10281928), demo monitoring.
  // This watcher follows the useRef/useEffect previous-value pattern, with session guards.
  // Walsh, D. (2021) 'React usePrevious Hook'.
  // https://davidwalsh.name/react-useprevious-hook
  // Accessed: 5 October 2026.
  const firstStaffRunRef = useRef(true);
  const prevStaffRef = useRef<Staff[]>([]);
  const prevStaffUid = useRef(uid);
  useEffect(() => {
    if (monitoringUnavailableReason || !actor || locationsLoading || locationsError) return;
    const wasFirstRun = firstStaffRunRef.current || prevStaffUid.current !== uid;
    prevStaffUid.current = uid;
    firstStaffRunRef.current = false;
    const prev = prevStaffRef.current;
    prevStaffRef.current = staff;
    if (wasFirstRun) return; // Initial seed load, not a change to log.

    const before = new Map(prev.map((s): [string, Staff] => [s.id, s]));
    for (const person of staff) {
      const was = before.get(person.id);
      if (!was) {
        logAudit({
          category: 'StaffChange',
          action: 'StaffAdded',
          summary: `Added ${person.name}`,
          details: `${person.name} (${person.role}) added to ${locationName(person.locationId)}.`,
          area: locationName(person.locationId),
          entityType: 'staff',
          entityId: person.id,
          after: { name: person.name, role: person.role, area: locationName(person.locationId), availability: person.availability },
        });
        continue;
      }
      const changedKeys = (Object.keys(person) as (keyof Staff)[]).filter((k) => k !== 'id' && person[k] !== was[k]);
      if (changedKeys.length === 0) continue;

      const onlyAvailability = changedKeys.length === 1 && changedKeys[0] === 'availability';
      logAudit({
        category: 'StaffChange',
        action: onlyAvailability ? 'StaffAvailabilityChanged' : 'StaffUpdated',
        summary: onlyAvailability ? 'Availability updated' : `Updated ${person.name}`,
        details: onlyAvailability
          ? `${person.name} availability changed to ${person.availability}.`
          : `${person.name}: ${changedKeys.join(', ')} updated.`,
        area: locationName(person.locationId),
        entityType: 'staff',
        entityId: person.id,
        before: Object.fromEntries(changedKeys.map((k) => [k, was[k]])),
        after: Object.fromEntries(changedKeys.map((k) => [k, person[k]])),
      });
    }
  }, [staff, logAudit, actor, uid, locationsLoading, locationsError, locationName]);

  // Same reasoning as the staff effect above, but for duties (Duty Changes) and assignments
  // (Roster Changes). This is what makes those two History tabs work regardless of whether
  // the change came from the Duties screen, the Roster screen, or the Alerts "Assign" button:
  // all of them go through the same OpsProvider state, which is all this effect watches.
  const firstRosterRunRef = useRef(true);
  const prevDutiesRef = useRef<Duty[]>([]);
  const prevAssignmentsRef = useRef<RosterAssignment[]>([]);
  const prevRosterUid = useRef(uid);
  useEffect(() => {
    if (monitoringUnavailableReason || !actor || locationsLoading || locationsError) return;
    const wasFirstRun = firstRosterRunRef.current || prevRosterUid.current !== uid;
    prevRosterUid.current = uid;
    firstRosterRunRef.current = false;
    const prevDuties = prevDutiesRef.current;
    const prevAssignments = prevAssignmentsRef.current;
    prevDutiesRef.current = duties;
    prevAssignmentsRef.current = assignments;
    if (wasFirstRun) return; // Initial seed load, not a change to log.

    const dutyById = new Map(roster.duties.map((d): [string, RosterDuty] => [d.id, d]));
    const prevDutyById = new Map(prevDuties.map((d): [string, Duty] => [d.id, d]));

    for (const duty of duties) {
      const was = prevDutyById.get(duty.id);
      if (!was) {
        logAudit({
          category: 'DutyChange',
          action: 'DutyCreated',
          summary: `Created ${duty.name}`,
          details: `${duty.name} added to ${duty.area} at ${duty.time}.`,
          area: duty.area,
          entityType: 'duty',
          entityId: duty.id,
          after: { name: duty.name, area: duty.area, time: duty.time, required: duty.required, priority: duty.priority },
        });
        continue;
      }
      const changedKeys = (Object.keys(duty) as (keyof Duty)[]).filter((k) => k !== 'id' && duty[k] !== was[k]);
      if (changedKeys.length === 0) continue;
      logAudit({
        category: 'DutyChange',
        action: 'DutyUpdated',
        summary: `Updated ${duty.name}`,
        details: `${duty.name}: ${changedKeys.join(', ')} updated.`,
        area: duty.area,
        entityType: 'duty',
        entityId: duty.id,
        before: Object.fromEntries(changedKeys.map((k) => [k, was[k]])),
        after: Object.fromEntries(changedKeys.map((k) => [k, duty[k]])),
      });
    }

    const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
    const prevAssignmentById = new Map(prevAssignments.map((a): [string, RosterAssignment] => [a.id, a]));
    for (const a of assignments) {
      // A brand-new assignment record is compared against an empty one, so any staff already
      // on it are treated as newly added rather than silently skipped.
      const was = prevAssignmentById.get(a.id) ?? { ...a, staffIds: [] as string[] };
      // Code Attribution — Ndivhuwo Ndou (ST10281928), demo assignment comparison.
      // These two comparisons follow array-differ's directional array-difference semantics;
      // this is a local Set/filter implementation, not an import or verbatim copy.
      // Sorhus, S. (n.d.) 'array-differ'. https://github.com/sindresorhus/array-differ
      // Accessed: 5 October 2026.
      const beforeSet = new Set(was.staffIds);
      const afterSet = new Set(a.staffIds);
      const added = a.staffIds.filter((id) => !beforeSet.has(id));
      const removed = was.staffIds.filter((id) => !afterSet.has(id));
      if (added.length === 0 && removed.length === 0) continue;

      const duty = dutyById.get(a.dutyId);
      // Skipped (resolves false) in demo mode; a failed write is shown to the user, not lost.
      for (const n of notificationsForAssignmentChange({
        dutyId: a.dutyId,
        dutyName: duty?.name ?? 'duty',
        dutyArea: duty?.area ?? a.day,
        dutyTime: duty?.time ?? '',
        wasEmpty: was.staffIds.length === 0,
        added,
        removed,
      })) {
        writeNotification({ ...n, issuedBy: actor }).catch((cause) => reportError('A staff notification could not be sent', cause));
      }

      const details = [added.length ? `Added ${added.map(staffName).join(', ')}` : '', removed.length ? `Removed ${removed.map(staffName).join(', ')}` : '']
        .filter(Boolean)
        .join('. ');
      logAudit({
        category: 'RosterChange',
        action: was.staffIds.length === 0 ? 'DutyAssigned' : 'DutyReassigned',
        summary: was.staffIds.length === 0 ? `Assigned ${duty?.name ?? 'duty'}` : `Reassigned ${duty?.name ?? 'duty'}`,
        details,
        area: duty?.area ?? a.day,
        entityType: 'duty',
        entityId: a.dutyId,
        before: { staffIds: was.staffIds },
        after: { staffIds: a.staffIds },
      });
    }
  }, [duties, assignments, roster, staff, logAudit, actor, uid, locationsLoading, locationsError, reportError]);

  const subscribeNotes = useCallback(
    (
      entityType: OperationalNote['entityType'],
      entityId: string,
      cb: (notes: OperationalNote[]) => void,
      onError?: (error: Error) => void,
    ) => repos.notes.subscribe(entityType, entityId, cb, onError),
    [repos],
  );

  const addNote = useCallback(async (note: Omit<NewNote, 'author'>) => {
    if (!actor) throw new Error('Sign in to add an operational note.');
    return repos.notes.add({ ...note, author: actor });
  }, [repos, actor]);

  // The two steps are separate writes, so one can succeed while the other fails. Each failure
  // is reported as exactly what happened rather than a generic error, so nobody is told an
  // alert is "resolved and recorded" when only half of that is true.
  // NOTE: once alert detection moves server-side, this moves with it (ideally as one atomic write).
  const resolveAlerts = useCallback(
    async (ids: string[], note?: string) => {
      if (ids.length === 0) return;
      if (!actor) throw new Error('Sign in to resolve operational alerts.');
      let resolved: Alert[];
      try {
        resolved = await repos.alerts.resolve(ids, actor, note);
      } catch (cause) {
        throw new Error(`Could not resolve ${ids.length === 1 ? 'the alert' : 'the alerts'}: ${errorMessage(cause)}`);
      }
      try {
        await Promise.all(
          resolved.map((a) =>
            repos.audit.append({
              actor,
              category: 'AlertResolution',
              action: 'AlertResolved',
              summary: `${a.origin === 'Detected' ? 'Overrode' : 'Resolved'}: ${a.title}`,
              details: note ? `${a.details} Note: ${note}` : a.details,
              area: a.area,
              entityType: 'alert',
              entityId: a.id,
              before: { state: 'Open' },
              after: { state: 'Resolved' },
            }),
          ),
        );
      } catch (cause) {
        throw new Error(`The alert was resolved, but its History entry could not be saved: ${errorMessage(cause)}`);
      }
    },
    [repos, actor],
  );

  const openAlerts = useMemo(
    () =>
      alerts
        .filter((a) => a.state !== 'Resolved')
        .sort((a, b) => RANK[a.priority] - RANK[b.priority] || b.raisedAt.localeCompare(a.raisedAt)),
    [alerts],
  );

  const value = useMemo<MonitoringValue>(
    () => ({
      loading,
      historyLoading,
      backend: monitoringBackend,
      error,
      dismissError,
      alertsUnavailable,
      historyUnavailable,
      alerts,
      openAlerts,
      auditLogs,
      resolveAlerts,
      recordAudit,
      subscribeNotes,
      addNote,
    }),
    [
      loading,
      historyLoading,
      error,
      dismissError,
      alertsUnavailable,
      historyUnavailable,
      alerts,
      openAlerts,
      auditLogs,
      resolveAlerts,
      recordAudit,
      subscribeNotes,
      addNote,
    ],
  );

  return <MonitoringContext.Provider value={value}>{children}</MonitoringContext.Provider>;
}

export function useMonitoring(): MonitoringValue {
  const ctx = useContext(MonitoringContext);
  if (!ctx) throw new Error('useMonitoring must be used inside <MonitoringProvider>');
  return ctx;
}
