import type { Metadata } from 'next';
import './globals.css';
import './theme.css';
import './print.css';
import { AuthProvider } from '../components/AuthProvider';
import { MonitoringProvider } from '../components/MonitoringProvider';
import { OpsProvider } from '../components/OpsProvider';

export const metadata: Metadata = {
  title: 'SAID Ops | Supervisor Operations System',
  description: 'SAID Ops supervisor prototype',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.theme=localStorage.getItem('said-ops-theme')==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}" }} /></head><body><AuthProvider><OpsProvider><MonitoringProvider>{children}</MonitoringProvider></OpsProvider></AuthProvider></body></html>;
}
