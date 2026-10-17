'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useModalFocus } from './useModalFocus';
import { useMonitoring } from './MonitoringProvider';
import { formatDate, formatWeekday } from '../data/monitoring/model';
import { monitoringUnavailableReason } from '../lib/dataSource';
import { useAuth } from './AuthProvider';
import { employeeFullName, employeeInitials } from '../lib/employee';
import { Icon, IconName } from './Icons';

const nav: [string, string, IconName][] = [
  ['Dashboard', '/dashboard', 'home'], ['Roster', '/roster', 'calendar'],
  ['Duties', '/duties', 'clipboard'], ['Staff', '/staff', 'users'],
  ['Locations', '/locations', 'mapPin'], ['Alerts', '/alerts', 'alert'], ['History', '/history', 'history'],
];

export function AppShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [compact, setCompact] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  useModalFocus(sidebarRef, drawer, () => setDrawer(false));
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1024px)');
    const update = () => { setCompact(media.matches); if (!media.matches) setDrawer(false); };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const { status, employee, signOut } = useAuth();
  const { openAlerts, backend, error, dismissError, alertsUnavailable, loading } = useMonitoring();
  const [today, setToday] = useState('');
  useEffect(() => setToday(new Date().toISOString()), []);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (status === 'signedOut') router.replace('/');
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, [status, router]);

  if (status !== 'signedIn' || !employee) return null;
  const supervisor = { name: employeeFullName(employee), initials: employeeInitials(employee), role: 'Supervisor' };
  const close = () => setDrawer(false);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('said-ops-theme', next); } catch { /* Theme still works for this session. */ }
    setTheme(next);
  };
  const logout = async () => { close(); await signOut(); router.push('/'); };
  const link = (label: string, href: string, icon: IconName) =>
    <Link href={href} onClick={close} className={path === href ? 'active' : ''} key={href}>
      <i><Icon name={icon} /></i><span>{label}</span>{label === 'Alerts' && !loading && !alertsUnavailable && openAlerts.length > 0 && <b className="nav-count">{openAlerts.length}</b>}
    </Link>;

  return <main className={'app-shell ' + (collapsed ? 'collapsed ' : '') + (drawer ? 'drawer-open' : '')}>
    <div className="drawer-backdrop" onClick={close} />
    <aside className="sidebar" ref={sidebarRef} inert={compact && !drawer} role={drawer ? 'dialog' : undefined} aria-modal={drawer ? true : undefined} aria-label={drawer ? 'Supervisor navigation' : undefined} tabIndex={drawer ? -1 : undefined}>
      <button className="drawer-close" onClick={close} aria-label="Close navigation"><Icon name="x" /></button>
      <div className="side-brand"><img src="/said_logo.png" alt="SAID Ops" /><div><b>SAID <em>Ops</em></b><small>SUPERVISOR<br />OPERATIONS SYSTEM</small></div></div>
      <nav>{nav.map(([a, b, c]) => link(a, b, c))}</nav>
      <div className="side-bottom"><div className="profile"><div className="avatar">{supervisor.initials}</div><span>{supervisor.name}<small>{supervisor.role}<b /></small></span></div>{link('Settings', '/settings', 'settings')}<button onClick={logout}><i><Icon name="logout" /></i><span>Log Out</span></button></div>
    </aside>
    <section className="workspace">
      <header>
        <button className="menu-button" onClick={() => { if (innerWidth <= 1024) setDrawer(true); else setCollapsed(!collapsed); }} aria-label="Open navigation" aria-expanded={compact ? drawer : !collapsed}><Icon name="menu" size={28} /></button>
        <div className="header-title"><h1>{title}</h1><p>{subtitle}</p></div>
        <div className="header-tools">
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`} title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`}>
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span><span className="theme-label">{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
          </button>
          <span className="date"><Icon name="calendar" size={25} /><b>{today && formatDate(today)}<small>{today && formatWeekday(today)}</small></b></span>
          <Link href="/alerts" onClick={close} className="notification" aria-label="View alerts"><Icon name="bell" size={27} />{!loading && !alertsUnavailable && openAlerts.length > 0 && <b>{openAlerts.length}</b>}</Link>
          <div className="top-avatar">{supervisor.initials}</div>
        </div>
      </header>
      {backend === 'memory' && !monitoringUnavailableReason && <div className="notice" role="status">Demo mode: alerts, history and notes use local session data and reset on reload. Integrated locations, workforce, duty templates, roster publication and task progress may use Firestore.</div>}
      {error && <div className="notice" role="alert">⚠ {error} {backend==='memory'&&<button className="action-button" onClick={dismissError} aria-label="Dismiss warning">Dismiss</button>}</div>}
      {children}
      <footer className="app-footer"><Icon name="check" /> Secured Connection <span /> {backend === 'firestore' ? 'Published operational data · refresh to update' : 'Local demo monitoring'} <b>SAID Ops v1.0.0 &nbsp; | &nbsp; © 2026 SAID Ops</b></footer>
    </section>
  </main>;
}
