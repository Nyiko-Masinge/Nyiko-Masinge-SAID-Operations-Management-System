'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { friendlyAuthError, useAuth } from '../components/AuthProvider';

type IconName = 'roster' | 'staff' | 'alerts' | 'operations' | 'mail' | 'lock' | 'eye' | 'eyeOff' | 'signin' | 'sso' | 'shield';
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    roster: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M7 11h10M8 15h3"/></>,
    staff: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-1.5a7 7 0 0 1 14 0V21M18 9a3 3 0 0 1 1.5 5.6M19 16.5a5.5 5.5 0 0 1 2 4.2"/></>,
    alerts: <><path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4"/></>,
    operations: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><circle cx="4" cy="8" r="1.5"/><circle cx="10" cy="2" r="1.5"/><circle cx="16" cy="11" r="1.5"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
    eye: <><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
    eyeOff: <><path d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.2 3.7M6.2 6.3A17 17 0 0 0 2.5 12S6 18 12 18a9.8 9.8 0 0 0 3.5-.7"/><circle cx="12" cy="12" r="2.5"/></>,
    signin: <><rect x="4" y="3" width="12" height="18" rx="2"/><path d="M11 12h10M18 8l4 4-4 4"/></>,
    sso: <><path d="m12 3 7 3v5c0 4.7-3 8-7 10-4-2-7-5.3-7-10V6l7-3Z"/><path d="M10 12h5M13 10l2 2-2 2"/></>,
    shield: <><path d="m12 3 8 3v5c0 5.2-3.4 8.9-8 10-4.6-1.1-8-4.8-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const capabilities: { icon: IconName; label: React.ReactNode }[] = [
  { icon: 'roster', label: <>Roster<br />Management</> }, { icon: 'staff', label: <>Staff<br />Administration</> },
  { icon: 'alerts', label: <>Alerts &amp;<br />Notifications</> }, { icon: 'operations', label: <>Operations<br />Overview</> },
];

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(''); const [password, setPassword] = useState('');
  const { status, accessError, signIn, resetPassword } = useAuth(); const [busy, setBusy] = useState(false);
  useEffect(() => { if (status === 'signedIn') router.replace('/dashboard'); }, [status, router]);
  useEffect(() => { if (accessError) setBusy(false); }, [accessError]);
  const [remember, setRemember] = useState(false); const [showPassword, setShowPassword] = useState(false); const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('');
    if (identifier.includes('@')) { setMessage('Sign in with your Employee ID, not an email address.'); return; }
    if (!password) { setMessage('Enter your password.'); return; }
    setBusy(true);
    try { await signIn(identifier, password, remember); } catch (error) { setMessage(friendlyAuthError(error)); setBusy(false); }
  }
  async function forgotPassword() {
    try { await resetPassword(identifier); } catch (error) { setMessage(friendlyAuthError(error)); }
  }
  return <main className="login-page">
    <div className="login-shell">
      <section className="login-intro">
        <div className="brand-lockup"><img src="/said_logo.png" alt="SAID Ops logo" /><div><strong>SAID <em>Ops</em></strong><small>SUPERVISOR OPERATIONS SYSTEM</small></div></div>
        <div className="intro-copy"><i /><h1>Manage. Plan. Monitor.</h1><p>Manage rosters, staff, alerts, and operations across every shift, every day.</p></div>
        <div className="capabilities">{capabilities.map(({ icon, label }) => <div key={icon}><Icon name={icon} size={31} /><b>{label}</b></div>)}</div>
      </section>
      <section className="login-card-wrap"><div className="system-status"><span /><Icon name="shield" size={22} /><div><small>System Status</small><b>All Systems Operational</b></div></div>
        <form className="login-card" onSubmit={submit} noValidate><img src="/said_logo.png" className="login-logo" alt="SAID Ops" /><h2>Welcome Back, Supervisor</h2><p>Sign in to access the SAID Ops dashboard</p>
          <label>Employee ID<div className="field-wrap"><Icon name="mail" /><input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Enter your Employee ID" autoComplete="username" /></div></label>
          <label>Password<div className="password-wrap field-wrap"><Icon name="lock" /><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}><Icon name={showPassword ? 'eyeOff' : 'eye'} /></button></div></label>
          <div className="login-options"><label className="check"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember me</label><button type="button" className="text-link" onClick={forgotPassword}>Forgot Password?</button></div>
          {(message || accessError) && <p className="form-message" role="alert">{message || accessError}</p>}<button className="sign-in" type="submit" disabled={busy}><Icon name="signin" /><span>Sign In</span><span>→</span></button><div className="or"><span />OR<span /></div><button className="sso" type="button" onClick={() => setMessage('Single Sign-On is not connected in this prototype.')}><Icon name="sso" /><span>Sign In with SSO</span></button><p className="secure"><Icon name="lock" size={16} />Secure access. All actions are monitored and logged.</p>
        </form>
      </section>
      <footer className="login-footer">© 2026 SAID Ops <span /> Secured Veterinary Operations Management</footer>
    </div>
  </main>;
}
