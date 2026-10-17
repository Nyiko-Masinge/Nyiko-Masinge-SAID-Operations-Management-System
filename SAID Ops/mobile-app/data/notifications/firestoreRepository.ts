import { collection, doc, getDocsFromServer, onSnapshot, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { requestedNotificationBackend } from './backend';
import type { AppNotification, Unsubscribe } from './model';
import type { NotificationRepository } from './repository';

function requireDb(uid: string) {
  if (requestedNotificationBackend(process.env.EXPO_PUBLIC_MONITORING_BACKEND) !== 'firestore') throw new Error('Live notifications are disabled in demo mode.');
  if (!db || !auth?.currentUser || auth.currentUser.uid !== uid) throw new Error('Sign in to use your live notifications.');
  return db;
}
export function decodeNotification(id: string, uid: string, data: Record<string, unknown>): AppNotification {
  const timestamp = data.createdAt as {toDate?: () => Date} | undefined;
  if (typeof data.title !== 'string' || typeof data.message !== 'string' || typeof data.category !== 'string' ||
      typeof data.eventId !== 'string' || typeof data.isRead !== 'boolean' || typeof timestamp?.toDate !== 'function') throw new Error('Invalid notification record.');
  return { id, recipientId: uid, category: data.category as AppNotification['category'], title:data.title, message:data.message,
    createdAt:timestamp.toDate().toISOString(), isRead:data.isRead, deliveryStatus:'Sent',
    ...(typeof data.scheduledWorkId === 'string' ? {relatedDutyId:data.scheduledWorkId} : {}) };
}
export class FirestoreNotificationRepository implements NotificationRepository {
  subscribe(uid: string, cb: (notifications: AppNotification[]) => void, onError: (error: Error) => void): Unsubscribe {
    const database=requireDb(uid);
    return onSnapshot(query(collection(database,'employees',uid,'notifications'),orderBy('createdAt','desc')), snapshot => {
      if (auth?.currentUser?.uid !== uid) { cb([]); onError(new Error('Session changed.')); return; }
      try { cb(snapshot.docs.map(d=>decodeNotification(d.id,uid,d.data()))); } catch { cb([]); onError(new Error('Unable to load notifications.')); }
    }, error=>{cb([]);onError(error);});
  }
  async markRead(id: string, uid: string): Promise<void> {
    if (!id || id.includes('/')) throw new Error('Invalid notification identity.');
    await updateDoc(doc(requireDb(uid),'employees',uid,'notifications',id),{isRead:true});
  }
  async markAllRead(uid: string): Promise<void> {
    const database=requireDb(uid), snapshot=await getDocsFromServer(collection(database,'employees',uid,'notifications'));
    const unread=snapshot.docs.filter(d=>d.data().isRead===false);
    for(let index=0;index<unread.length;index+=400) {
      requireDb(uid);
      const batch=writeBatch(database);unread.slice(index,index+400).forEach(d=>batch.update(d.ref,{isRead:true}));await batch.commit();
    }
  }
}
export const createFirestoreNotificationRepository = (): NotificationRepository => new FirestoreNotificationRepository();
