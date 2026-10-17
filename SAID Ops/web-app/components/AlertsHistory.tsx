'use client';
import Link from 'next/link';
import { liveMonitoringEnabled } from '../lib/monitoring/backend';
import { OperationalDashboard, OperationalHistory } from './OperationalDashboard';
import { ReactNode, useMemo, useState } from 'react';
import { Icon, IconName } from './Icons';
import { useOps } from './OpsProvider';
import { useMonitoring } from './MonitoringProvider';
import { NotesPanel } from './NotesPanel';
import { toMonitoringRoster } from '../data/monitoring/rosterInput';
import { suggestStaff } from '../data/monitoring/detect';
import { ALERT_TAB, AUDIT_TAB, formatDate, formatDateTime, formatTime } from '../data/monitoring/model';
import type { Alert, AlertType, AuditLog } from '../data/monitoring/model';

export const ALERT_ICON: Record<AlertType, IconName> = {
  Conflict: 'alert',
  UnassignedDuty: 'users',
  UnableToComplete: 'clipboard',
  Overdue: 'clock',
  Equipment: 'info',
  Other: 'info',
};

const ALERT_TABS = ['All Alerts', 'Conflicts', 'Unassigned Duties', 'Unable to Complete', 'Overdue', 'Other'];
const HISTORY_TABS = ['All Activity', 'Roster Changes', 'Duty Changes', 'Staff Changes', 'Alert Resolutions', 'System Events'];

const Pill = ({ children, tone }: { children: ReactNode; tone: string }) => <span className={'pill ' + tone}>{children}</span>;

/** Detected staffing alerts carry the assignment they are about in their key ("staffing:<assignmentId>"). */
const assignmentIdOf = (a: Alert): string | undefined => (a.key.startsWith('staffing:') ? a.key.slice('staffing:'.length) : undefined);

export function AlertsScreen() {
  if(liveMonitoringEnabled) return <OperationalDashboard alertsOnly />;
  return DemoAlertsScreen();
}
function DemoAlertsScreen() {
  const { staff, duties: templates, scheduledWork, locationName, assignScheduled } = useOps();
  const { alerts, openAlerts, resolveAlerts, alertsUnavailable, loading } = useMonitoring();
  const [tab, setTab] = useState('All Alerts');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState('');
  const [resolution, setResolution] = useState('');
  const [note, setNote] = useState('');

  const roster = useMemo(() => toMonitoringRoster(staff, templates, scheduledWork, locationName), [staff, templates, scheduledWork, locationName]);
  const { duties, assignments } = roster;

  const list = useMemo(
    () =>
      openAlerts.filter(
        (a) => (tab === 'All Alerts' || ALERT_TAB[a.type] === tab) && `${a.title} ${a.details}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [openAlerts, tab, q],
  );
  const current = list.find((a) => a.id === selected) ?? list[0];

  const currentAssignment = current ? assignmentIdOf(current) : undefined;
  const suggestion = currentAssignment ? suggestStaff(roster, currentAssignment)[0] : undefined;

  const count = (t: AlertType) => openAlerts.filter((a) => a.type === t).length;
  const today = formatDate(new Date().toISOString());
  const resolvedToday = alerts.filter((a) => a.resolvedAt && formatDate(a.resolvedAt) === today).length;
  const stats: [string, number, IconName][] = [
    ['Conflicts', count('Conflict'), 'alert'],
    ['Unassigned Duties', count('UnassignedDuty'), 'users'],
    ['Unable to Complete', count('UnableToComplete'), 'clipboard'],
    ['Overdue Items', count('Overdue'), 'clock'],
    ['Resolved Today', resolvedToday, 'check'],
  ];

  const select = (id: string) => {
    setSelected(id);
    setResolution('');
  };

  // Fixes the roster gap itself. The alert then clears on its own when the roster is re-checked.
  const assignSuggested = async (a: Alert) => {
    const assignmentId = assignmentIdOf(a);
    const person = assignmentId ? suggestStaff(roster, assignmentId)[0] : undefined;
    if (!assignmentId || !person) {
      setNote('No available staff without a clash for this duty. Assign someone from the Roster instead.');
      return;
    }
    const result = assignScheduled(assignmentId, person.id);
    if (!result.ok) {
      setNote(`Assignment was not saved: ${result.code}.`);
      return;
    }
    const duty = duties.find((d) => d.id === a.dutyId);
    const before = assignments.find((x) => x.id === assignmentId)?.staffIds.length ?? 0;
    const missing = (duty?.required ?? 1) - before - 1;
    // No manual recordAudit here: MonitoringProvider watches assignments directly and logs
    // this automatically (as DutyAssigned/DutyReassigned), so every screen that changes an
    // assignment gets the same History entry without each one having to call recordAudit itself.
    setNote(`Assigned ${person.name} to ${duty?.name ?? 'the duty'}. ${missing > 0 ? `${missing} more staff still needed.` : 'The alert clears automatically.'}`);
  };

  const resolve = async (ids: string[], text = '') => {
    try {
      await resolveAlerts(ids, text.trim() || undefined);
      setResolution('');
      setNote(`${ids.length === 1 ? 'Alert' : `${ids.length} alerts`} resolved and recorded in History.`);
    } catch (cause) {
      // resolveAlerts says exactly which step failed, so show that rather than a generic error.
      setNote(cause instanceof Error ? cause.message : 'Resolving failed.');
    }
  };

  const resolveAll = async () => {
    if (list.length === 0) return;
    const ok = window.confirm(`Resolve ${list.length} alert${list.length === 1 ? '' : 's'} without changing the roster? Each one will be recorded in History.`);
    if (ok) await resolve(list.map((a) => a.id));
  };

  return (
    <div className="management">
      <div className="tabs">
        {ALERT_TABS.map((t) => (
          <button className={tab === t ? 'active' : ''} onClick={() => setTab(t)} key={t}>
            {t}
          </button>
        ))}
        <span />
        <button className="action-button" onClick={() => setNote('Alerts update automatically whenever the roster changes.')}>
          <Icon name="repeat" />
          Refresh
        </button>
        <button className="action-button primary" onClick={() => void resolveAll()}>
          <Icon name="check" />
          Resolve All ({list.length})
        </button>
      </div>
      {note && <div className="notice">{note}</div>}
      <div className="filters">
        <div className="search-field">
          <Icon name="search" />
          <input placeholder="Search alerts..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button
          onClick={() => {
            setQ('');
            setTab('All Alerts');
          }}
        >
          Clear Filters
        </button>
      </div>
      <div className="summary-grid">
        {stats.map(([label, value, icon]) => (
          <div className="mini-stat" key={label}>
            <Icon name={icon} />
            <span>
              {label}
              <b>{value}</b>
            </span>
          </div>
        ))}
      </div>
      <div className="split-screen">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Alert</th>
                <th>Details</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Raised</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6}>Loading alerts…</td>
                </tr>
              )}
              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={6}>{alertsUnavailable ? 'Alerts could not be loaded, so this list may be incomplete. See the warning at the top of the page.' : 'No open alerts match these filters.'}</td>
                </tr>
              )}
              {list.map((a) => (
                <tr className={a.id === current?.id ? 'selected' : ''} onClick={() => select(a.id)} key={a.id}>
                  <td>
                    <b>
                      <Icon name={ALERT_ICON[a.type]} /> {a.title}
                    </b>
                    <small>{a.details}</small>
                  </td>
                  <td>{a.area}</td>
                  <td>
                    <Pill tone={a.priority.toLowerCase()}>{a.priority}</Pill>
                  </td>
                  <td>
                    <Pill tone="unassigned">{a.state}</Pill>
                  </td>
                  <td>{formatDateTime(a.raisedAt)}</td>
                  <td>
                    <button
                      className="action-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (a.type === 'UnassignedDuty') void assignSuggested(a);
                        else void resolve([a.id], a.id === current?.id ? resolution : '');
                      }}
                    >
                      {a.type === 'UnassignedDuty' ? 'Assign' : 'Resolve'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {current && (
          <aside className="details panel">
            <h3>Alert Details</h3>
            <Icon name={ALERT_ICON[current.type]} size={45} />
            <h2>{current.title}</h2>
            <Pill tone={current.priority.toLowerCase()}>{current.priority} Priority</Pill>
            <h3>Details</h3>
            <p>{current.details}</p>
            <dl>
              <dt>Area / Unit</dt>
              <dd>{current.area}</dd>
              <dt>Raised</dt>
              <dd>{formatDateTime(current.raisedAt)}</dd>
              <dt>Status</dt>
              <dd>{current.state}</dd>
              <dt>Source</dt>
              <dd>{current.origin === 'Detected' ? 'Detected from the roster' : 'Reported during operations'}</dd>
            </dl>
            <h3>Suggested Actions</h3>
            {current.type === 'UnassignedDuty' && (
              <p>{suggestion ? `${suggestion.name} is available and has no clash.` : 'No available staff without a clash.'}</p>
            )}
            {current.type === 'UnassignedDuty' ? (
              <button className="action-button" onClick={() => void assignSuggested(current)}>
                <Icon name="userPlus" />
                Assign Suggested Staff
              </button>
            ) : (
              <Link className="action-button" href="/roster">
                <Icon name="userPlus" />
                Reassign Staff
              </Link>
            )}
            <div className="search-field">
              <input placeholder="Resolution note (optional)" value={resolution} onChange={(e) => setResolution(e.target.value)} />
            </div>
            <button className="action-button" onClick={() => void resolve([current.id], resolution)}>
              <Icon name="clock" />
              Review & Resolve
            </button>
            <NotesPanel entityType="alert" entityId={current.id} />
          </aside>
        )}
      </div>
    </div>
  );
}

const changeText = (l: AuditLog): string => {
  const keys = Object.keys({ ...l.before, ...l.after });
  if (keys.length === 0) return 'No field changes recorded.';
  return keys.map((k) => `${k}: ${String(l.before?.[k] ?? '—')} → ${String(l.after?.[k] ?? '—')}`).join(', ');
};

export function HistoryScreen() {
  if(liveMonitoringEnabled) return <OperationalHistory />;
  return DemoHistoryScreen();
}
function DemoHistoryScreen() {
  const { auditLogs, historyUnavailable, historyLoading } = useMonitoring();
  const [tab, setTab] = useState('All Activity');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [note, setNote] = useState('');

  const rows = useMemo(
    () =>
      auditLogs.filter(
        (r) =>
          (tab === 'All Activity' || AUDIT_TAB[r.category] === tab) &&
          `${r.summary} ${r.details} ${r.area} ${r.actor.name} ${r.reference}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [auditLogs, tab, q],
  );
  const row = rows.find((r) => r.id === selectedId) ?? rows[0];

  const now = Date.now();
  const day = 86_400_000;
  const today = formatDate(new Date(now).toISOString());
  const inLast = (l: AuditLog, days: number) => now - new Date(l.timestamp).getTime() < days * day;
  const summary = {
    today: auditLogs.filter((l) => formatDate(l.timestamp) === today).length,
    week: auditLogs.filter((l) => inLast(l, 7)).length,
    month: auditLogs.filter((l) => inLast(l, 30)).length,
  };

  const exportHistory = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }));
    a.download = 'said-ops-history.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
    setNote(`${rows.length} history entries exported as JSON.`);
  };

  return (
    <div className="management">
      <div className="tabs">
        {HISTORY_TABS.map((t) => (
          <button onClick={() => setTab(t)} className={tab === t ? 'active' : ''} key={t}>
            {t}
          </button>
        ))}
        <span />
        <button className="action-button" onClick={exportHistory}>
          <Icon name="download" />
          Export History
        </button>
      </div>
      {note && <div className="notice">{note}</div>}
      <div className="filters">
        <div className="search-field">
          <Icon name="search" />
          <input placeholder="Search activity..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button
          onClick={() => {
            setQ('');
            setTab('All Activity');
          }}
        >
          Clear Filters
        </button>
      </div>
      <div className="split-screen">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
                <th>Area / Unit</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading && (
                <tr>
                  <td colSpan={6}>Loading history…</td>
                </tr>
              )}
              {!historyLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6}>{historyUnavailable ? 'History could not be loaded. See the warning at the top of the page.' : 'No activity matches these filters.'}</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr className={r.id === row?.id ? 'selected' : ''} onClick={() => setSelectedId(r.id)} key={r.id}>
                  <td>
                    {formatDate(r.timestamp)}
                    <small>{formatTime(r.timestamp)}</small>
                  </td>
                  <td>
                    <b>{r.actor.name}</b>
                    <small>{r.actor.role}</small>
                  </td>
                  <td>
                    <Pill tone="upcoming">{r.summary}</Pill>
                  </td>
                  <td>{r.details}</td>
                  <td>{r.area}</td>
                  <td>{r.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="details panel">
          <h3>Activity Details</h3>
          <Icon name="history" size={42} />
          {row ? (
            <>
              <h2>{row.summary}</h2>
              <p>
                {formatDateTime(row.timestamp)} by {row.actor.name}
              </p>
              <h3>Description</h3>
              <p>{row.details}</p>
              <dl>
                <dt>Area / Unit</dt>
                <dd>{row.area}</dd>
                <dt>Reference</dt>
                <dd>{row.reference}</dd>
              </dl>
              <h3>Change</h3>
              <p>{changeText(row)}</p>
            </>
          ) : (
            <p>Select an entry to see what changed.</p>
          )}
          <h3>Activity Summary</h3>
          <p>
            Today: {summary.today} &nbsp; Last 7 Days: {summary.week} &nbsp; Last 30 Days: {summary.month}
          </p>
        </aside>
      </div>
    </div>
  );
}
