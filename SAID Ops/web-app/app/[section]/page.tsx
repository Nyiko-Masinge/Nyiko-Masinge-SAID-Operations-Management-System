import { AppShell } from '../../components/AppShell';

const labels: Record<string, string> = { roster: 'Roster', duties: 'Duties', staff: 'Staff', alerts: 'Alerts & Exceptions', history: 'History', settings: 'Settings' };
export default async function TemporaryPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params; const title = labels[section] ?? 'Operations';
  return <AppShell title={title} subtitle="Supervisor operations workspace"><section className="temporary panel"><i>◌</i><h2>{title}</h2><p>Scheduled for the next implementation batch.</p><span>This frontend prototype keeps this route available while the full screen is being built.</span></section></AppShell>;
}
