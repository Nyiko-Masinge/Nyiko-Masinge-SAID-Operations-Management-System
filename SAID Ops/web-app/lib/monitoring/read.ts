import {collection,doc,getDocFromServer,getDocsFromServer,query,where,orderBy,limit} from 'firebase/firestore';
import {getFirebaseAuth,getFirebaseDb} from '../firebase';
import {loadWorkforce} from '../roster/workforce';
import {readCurrentRosterPublication} from '../roster/currentPublication';
import {readSupervisorProgress} from '../roster/progress';
import type {MonitoringSources,OperationalEvent,OperationalNotification} from './model';

const iso=(value:unknown) => { const timestamp=value as {toDate?:()=>Date};if(typeof timestamp?.toDate!=='function')throw new Error('Invalid operational timestamp.');return timestamp.toDate().toISOString(); };
export async function readMonitoring(week:string,historical=false):Promise<MonitoringSources> {
  const auth=getFirebaseAuth(),user=auth.currentUser;if(!user)throw new Error('Sign in to read monitoring.');
  const db=getFirebaseDb();
  const [publication,progress,workforce,locations,eventRecords,notificationRecords]=await Promise.all([
    readCurrentRosterPublication(week,undefined,historical),readSupervisorProgress(week,historical),loadWorkforce(),
    getDocsFromServer(collection(db,'locations')).then(snapshot=>snapshot.docs.map(d=>{const l=d.data();if(typeof l.name!=='string'||(l.active!==undefined&&typeof l.active!=='boolean'))throw new Error('Invalid location.');return {id:d.id,name:l.name,active:l.active??true};})),
    getDocsFromServer(query(collection(db,'operationalEvents'),where('weekStart','==',week),orderBy('occurredAt','desc'),limit(300))),
    getDocsFromServer(query(collection(db,'employees',user.uid,'notifications'),orderBy('createdAt','desc'),limit(100))),
  ]);
  const latest=await getDocFromServer(doc(db,'publishedRosters',week));
  const version=publication.status==='DATA'?publication.version:undefined;
  if(auth.currentUser!==user)throw new Error('Session changed.');
  if(version!==progress.version||((historical||latest.data()?.archived!==true)&&latest.data()?.currentVersion!==version)||(!historical&&latest.data()?.archived===true&&publication.archived!==true))throw new Error('Publication changed. Refresh monitoring.');
  const events:OperationalEvent[]=eventRecords.docs.map(d=>{const e=d.data();if(typeof e.type!=='string'||typeof e.actor?.displayName!=='string'||typeof e.actorProvenance!=='string')throw new Error('Invalid operational event.');return {id:d.id,type:e.type,occurredAt:iso(e.occurredAt),recordedAt:iso(e.recordedAt),actor:e.actor,actorProvenance:e.actorProvenance,weekStart:e.weekStart,publicationVersion:e.publicationVersion,...(e.scheduledWorkId?{scheduledWorkId:e.scheduledWorkId}:{}),...(e.reason?{reason:e.reason}:{})};});
  const notifications:OperationalNotification[]=notificationRecords.docs.map(d=>{const n=d.data();if(typeof n.title!=='string'||typeof n.message!=='string'||typeof n.isRead!=='boolean'||typeof n.category!=='string')throw new Error('Invalid operational notification.');return {id:d.id,title:n.title,message:n.message,category:n.category,createdAt:iso(n.createdAt),isRead:n.isRead,...(n.scheduledWorkId?{scheduledWorkId:n.scheduledWorkId}:{}),...(n.weekStart?{weekStart:n.weekStart}:{})};});
  return {version,...(latest.data()?.archived===true?{archived:true}:{}),items:publication.items,progress:progress.rows,workforce,locations,events,notifications};
}
