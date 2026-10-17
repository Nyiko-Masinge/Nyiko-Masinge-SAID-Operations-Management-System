'use client';
import Link from 'next/link';
import { liveMonitoringEnabled } from '../lib/monitoring/backend';
import { OperationalDashboard } from './OperationalDashboard';
import { useState } from 'react';
import { useSupervisorProgress } from '../lib/roster/useSupervisorProgress';
import { firestoreRosterEnabled } from '../lib/roster/backend';
import { duties as demoActivity } from '../data/operations';
import { timeAgo } from '../data/monitoring/model';
import type { AlertType } from '../data/monitoring/model';
import { ALERT_ICON } from './AlertsHistory';
import { Icon, IconName } from './Icons';
import { useMonitoring } from './MonitoringProvider';
import { useOps } from './OpsProvider';

const ALERT_TONE: Record<AlertType, string> = {
  UnassignedDuty: 'danger',
  Conflict: 'warning',
  Overdue: 'orange',
  UnableToComplete: 'info',
  Equipment: 'info',
  Other: 'info',
};
const areaIcons: IconName[] = ['intake', 'theatre', 'wards', 'pharmacy', 'kennel'];

/** Marks values that come from fixture data or a feed that is not connected yet. */
const DemoTag = ({ why }: { why: string }) => (
  <small title={why} style={{ fontStyle: 'italic', fontWeight: 400, marginLeft: 8, opacity: 0.8 }}>
    Demo data
  </small>
);

/*
 * Where each value on this screen comes from:
 *   Attention Required, Operational Alerts, area "Attention"  -> monitoring alerts (mode labelled in AppShell)
 *   Staff Scheduled, Staff Unavailable, Total Duties, area duty counts -> the shared roster in OpsProvider
 *   Completed / In Progress -> authenticated FR-9 reads for the selected published week in Firestore roster mode; otherwise "—".
 *   Today's Activity        -> fixture (data/operations.ts) with hard-coded statuses. Tagged "Demo data".
 *   Area names              -> WS1 shared operational areas; counts remain session/demo values.
 */
function currentMonday() {
  const date = new Date(); date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}
export function Dashboard() {
  if(liveMonitoringEnabled) return <OperationalDashboard />;
  return DemoDashboard();
}
function DemoDashboard() {
  const [progressWeek, setProgressWeek] = useState(currentMonday);
  const selectProgressWeek = (value: string) => {
    const date = new Date(value + 'T12:00:00');
    if (!Number.isNaN(date.getTime()) && date.getDay() === 1) setProgressWeek(value);
  };
  const progress = useSupervisorProgress(progressWeek);
  const progressAvailable = firestoreRosterEnabled && progress.state.status === 'DATA';
  const { openAlerts, loading, alertsUnavailable } = useMonitoring();
  const { staff, scheduledWork, locations, locationsLoading, locationsError, refreshLocations } = useOps();

  const urgent = openAlerts.filter((a) => a.priority === 'High').length;
  const scheduled = new Set(scheduledWork.flatMap((work) => work.staffIds)).size;
  const unavailable = staff.filter((s) => s.availability === 'Unavailable' || s.availability === 'On Leave').length;

  const rosterUnavailable = locationsLoading || Boolean(locationsError);
  const stats: [IconName, string, string, string, string, string][] = [
    ['users', 'Staff Scheduled', rosterUnavailable ? '—' : String(scheduled), 'View Staff', '/staff', 'blue'],
    ['users', 'Staff Unavailable', rosterUnavailable ? '—' : String(unavailable), 'View Unavailability', '/staff', 'purple'],
    ['clipboard', 'Total Duties', rosterUnavailable ? '—' : String(scheduledWork.length), 'View Roster', '/roster', 'blue'],
    ['check', 'Completed', progressAvailable ? String(progress.state.rows.filter(row => row.status === 'Completed').length) : '—', progressAvailable ? 'Published staff assignments · selected week' : 'Awaiting progress data', '', 'green'],
    ['clock', 'In Progress', progressAvailable ? String(progress.state.rows.filter(row => row.status === 'In Progress').length) : '—', progressAvailable ? 'Published staff assignments · selected week' : 'Awaiting progress data', '', 'orange'],
    ['alert', 'Attention Required', loading || alertsUnavailable ? '—' : String(urgent), alertsUnavailable ? 'Alerts unavailable' : 'High priority', '', 'red'],
  ];

  return (
    <div className="dashboard">
      <section className="stat-grid">
        {stats.map(([icon, label, value, detail, href, tone]) => (
          <article className={'stat-card ' + tone} key={label}>
            <i>
              <Icon name={icon} size={34} />
            </i>
            <h3>{label}{['Staff Scheduled', 'Staff Unavailable', 'Total Duties'].includes(label) && <DemoTag why="Local roster/workforce values; live operational persistence is not connected." />}</h3>
            <strong>{value}</strong>
            {href ? (
              <Link href={href}>
                {detail}
                <span>›</span>
              </Link>
            ) : (
              <p>{detail}</p>
            )}
          </article>
        ))}
      </section>
      {firestoreRosterEnabled && <section className="panel" aria-label="Published task progress">
        <div className="panel-title"><h2>Published task progress</h2></div>
        <div className="progress-header">
          <div className="progress-controls">
            <div className="progress-week-field">
              <label htmlFor="progress-week">Week starting</label>
              <input id="progress-week" type="date" aria-describedby="progress-week-hint" value={progressWeek} onInput={event => selectProgressWeek(event.currentTarget.value)} onChange={event => selectProgressWeek(event.target.value)} />
            </div>
            <button type="button" className="action-button progress-refresh" onClick={progress.refresh}>Refresh progress</button>
          </div>
          <p id="progress-week-hint" className="progress-week-hint">Select a Monday.</p>
          <div className="progress-helper">
            <strong>Current publication</strong>
            <p>One row per assigned staff member.<br />Refresh to retrieve the latest saved task progress.</p>
          </div>
        </div>
        {progress.state.status === 'LOADING' && <p>Loading published task progress…</p>}
        {progress.state.status === 'ERROR' && <p role="alert">Could not load task progress. Check your access and connection, then refresh progress.</p>}
        {progress.state.status === 'EMPTY' && <p>No assigned published work for this week.</p>}
        {progress.state.status === 'DATA' && <div style={{overflowX:'auto'}}><table><thead><tr><th>Duty</th><th>Staff</th><th>Status</th><th>Unable reason</th><th>Last saved</th></tr></thead><tbody>
          {progress.state.rows.map(row => <tr key={row.scheduledWorkId + ':' + row.uid}><td>{row.title}</td><td>{row.displayName} ({row.employeeId})</td><td>{row.status}</td><td>{row.unableToCompleteReason ?? '—'}</td><td>{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : 'Not started'}</td></tr>)}
        </tbody></table></div>}
      </section>}
      <section className="content-grid">
        <article className="panel alerts-panel">
          <div className="panel-title">
            <h2>Operational Alerts</h2>
            <Link href="/alerts">View All Alerts　›</Link>
          </div>
          {loading && <p>Loading alerts…</p>}
          {!loading && alertsUnavailable && <p>Alerts could not be loaded, so this list may be incomplete. See the warning at the top of the page.</p>}
          {!loading && !alertsUnavailable && openAlerts.length === 0 && <p>No open alerts in the local roster.</p>}
          {openAlerts.slice(0, 4).map((a) => (
            <Link href="/alerts" className="alert-row" key={a.id}>
              <i className={ALERT_TONE[a.type]}>
                <Icon name={ALERT_ICON[a.type]} size={25} />
              </i>
              <span>
                <b>{a.title}</b>
                <small>{a.details}</small>
              </span>
              <em className={a.priority.toLowerCase()}>
                {a.priority}
                <small>{timeAgo(a.raisedAt)}</small>
              </em>
              <strong>›</strong>
            </Link>
          ))}
        </article>
        <article className="panel activity">
          <div className="panel-title">
            <h2>
              Today&apos;s Activity <DemoTag why="Fixture schedule with hard-coded progress statuses. Real progress needs task-status events that are not connected yet." />
            </h2>
            <Link href="/roster">View Full Schedule　›</Link>
          </div>
          {demoActivity.map((d) => (
            <Link href="/roster" className="activity-row" key={d.title}>
              <span className={'timeline ' + d.status.replace(' ', '').toLowerCase()}>
                <i />
              </span>
              <time>{d.time}</time>
              <span className="activity-copy">
                <b>{d.title}</b>
                <small>{d.location}</small>
              </span>
              <em className={d.status.replace(' ', '').toLowerCase()}>{d.status}</em>
            </Link>
          ))}
        </article>
        <article className="panel areas">
          <div className="panel-title">
            <h2>
              Operational Area Status <DemoTag why="Names come from shared operational areas; duty counts and attention are local monitoring values." />
            </h2>
            <Link href="/roster">View All Areas　›</Link>
          </div>
          <div className="area-grid">
            {locationsLoading && <p>Loading operational areas…</p>}
            {locationsError && <p role="alert">{locationsError} <button onClick={() => void refreshLocations()}>Retry operational areas</button></p>}
            {locations.map((a, i) => {
              const attention = openAlerts.some((alert) => alert.area === a.name);
              const dutyCount = scheduledWork.filter(work => work.locationId ? work.locationId === a.id : work.area === a.name).length;
              return (
                <div className={'area ' + (loading || alertsUnavailable ? '' : attention ? 'attention' : 'good')} key={a.name}>
                  <i>
                    <Icon name={areaIcons[i % areaIcons.length]} size={25} />
                  </i>
                  <b>{a.name}</b>
                  <span>{rosterUnavailable ? '—' : dutyCount} Duties</span>
                  <small>● {loading || alertsUnavailable ? 'Unknown' : attention ? 'Attention' : 'On Track'}</small>
                </div>
              );
            })}
          </div>
        </article>
        <article className="panel quick">
          <div className="panel-title">
            <h2>Quick Actions</h2>
          </div>
          <div className="quick-grid">
            <Link href="/roster">
              <Icon name="calendar" />
              <span>Create Roster</span>
            </Link>
            <Link href="/duties">
              <Icon name="clipboard" />
              <span>Add Duty</span>
            </Link>
            <Link href="/staff">
              <Icon name="userPlus" />
              <span>Assign Staff</span>
            </Link>
            <Link href="/staff">
              <Icon name="users" />
              <span>Resolve Conflicts</span>
            </Link>
            <Link href="/alerts">
              <Icon name="alert" />
              <span>
                View Alerts {!alertsUnavailable && <b>{openAlerts.length}</b>}
              </span>
            </Link>
            <Link href="/history">
              <Icon name="report" />
              <span>Generate Report</span>
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
