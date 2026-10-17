import type { User } from 'firebase/auth';
import { getFirebaseAuth } from '../firebase';
export async function persistArchive(user: User, weekStart: string, version: string, reason: string) {
  if (getFirebaseAuth().currentUser !== user) throw new Error('Session changed.');
  const token = await user.getIdToken();
  if (getFirebaseAuth().currentUser !== user) throw new Error('Session changed.');
  const response = await fetch('/api/rosters/archive', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ weekStart, version, reason }) });
  if (getFirebaseAuth().currentUser !== user) throw new Error('Session changed.');
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Archive failed.');
  if (body.archived !== true || body.version !== version || body.weekStart !== weekStart) throw new Error('Invalid archive response. Refresh history.');
}
