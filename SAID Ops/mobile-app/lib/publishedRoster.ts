import { collection, doc, getDocFromServer as getDoc, getDocsFromServer as getDocs, query, where } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import type { DemoShift } from '../types/tasks';
import type { RosterWeek } from '../types/roster';

export const firestoreRosterEnabled = process.env.EXPO_PUBLIC_ROSTER_BACKEND === 'firestore';
export type PublicationRead = {status:'EMPTY'|'DATA';version?:string;tasks:DemoShift[];archived?:boolean};
export type PublicationReader = {
  metadata:(week:string)=>Promise<Record<string,unknown>|undefined>;
  assigned:(week:string,version:string,uid:string)=>Promise<{id:string;data:Record<string,unknown>}[]>;
};
const firestoreReader:PublicationReader = {
  metadata:async week=>{const snapshot=await getDoc(doc(getFirebaseDb(),'publishedRosters',week));return snapshot.exists()?snapshot.data():undefined;},
  assigned:async(week,version,uid)=>{
    const items=collection(getFirebaseDb(),'publishedRosters',week,'versions',version,'items');
    const snapshot=await getDocs(query(items,where('assignedUids','array-contains',uid)));
    return snapshot.docs.map(item=>({id:item.id,data:item.data()}));
  },
};
export function localDate(date:Date):string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function weekFor(date=new Date()):string {
  const value=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  value.setDate(value.getDate()-((value.getDay()+6)%7));return localDate(value);
}
export function shiftWeek(week:string,days:number):string {
  const value=new Date(week+'T12:00:00');value.setDate(value.getDate()+days);return localDate(value);
}
const validDate=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const validTime=(value:unknown):value is string=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
function mapItem(id:string,data:Record<string,unknown>,week:string,version:string,uid:string):DemoShift {
  if(data.scheduledWorkId!==id||data.weekStart!==week||!validDate(data.date)||data.date<week||data.date>shiftWeek(week,6)||
      !validTime(data.startTime)||!validTime(data.endTime)||data.startTime>=data.endTime||
      typeof data.title!=='string'||!data.title.trim()||typeof data.description!=='string'||
      typeof data.locationId!=='string'||!data.locationId||typeof data.isCritical!=='boolean'||
      !Array.isArray(data.assignedUids)||!data.assignedUids.includes(uid)||!Array.isArray(data.team)) throw new Error('Published roster contains an invalid item. Contact your supervisor.');
  if(data.priority!==undefined&&!['High','Medium','Low'].includes(String(data.priority)))throw new Error('Invalid published priority.');
  const team=data.team.map(value=>{
    if(!value||typeof value!=='object'||typeof value.employeeId!=='string'||typeof value.displayName!=='string'||typeof value.jobCategory!=='string')throw new Error('Invalid published team projection.');
    // Copy only the approved projection, never spread profile fields into task state.
    return {employeeId:value.employeeId,displayName:value.displayName,jobCategory:value.jobCategory,...(typeof value.isPrimary==='boolean'?{isPrimary:value.isPrimary}:{})};
  });
  const minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
  return {id,scheduledWorkId:id,publicationVersion:version,weekStart:week,title:data.title,description:data.description,
    shiftDate:data.date,startTime:data.startTime,endTime:data.endTime,locationId:data.locationId,isCritical:data.isCritical,
    status:'Scheduled',team,taskId:id,priority:data.priority==='High'?'High':'Normal',dueBy:data.endTime,
    estimatedDuration:`${minutes(data.endTime)-minutes(data.startTime)} min`,checklist:[],isLive:false};
}
export async function readCurrentPublication(week:string,uid:string,reader:PublicationReader=firestoreReader,enabled=firestoreRosterEnabled,historical=false):Promise<PublicationRead> {
  if(!enabled)return {status:'EMPTY',tasks:[]}; // Fixture mode performs zero publication reads.
  if(!uid||!validDate(week)||weekFor(new Date(week+'T12:00:00'))!==week)throw new Error('A signed-in staff identity and valid Monday are required.');
  // Retry one pointer change. Never return old-version items after observing a republish.
  for(let attempt=0;attempt<2;attempt++){
    const metadata=await reader.metadata(week);
    if(!metadata)return {status:'EMPTY',tasks:[]};
    const version=metadata.currentVersion;
    if(metadata.weekStart!==week||typeof version!=='string'||!version||version.includes('/'))throw new Error('Invalid current publication metadata.');
    if(metadata.archived===true&&!historical)return {status:'EMPTY',tasks:[],archived:true};
    let rows;
    try{rows=await reader.assigned(week,version,uid);}
    catch(error){
      const latest=await reader.metadata(week);
      if(latest?.currentVersion!==version&&attempt===0)continue;
      throw error;
    }
    const latest=await reader.metadata(week);
    if(latest?.currentVersion!==version){if(attempt===0)continue;throw new Error('Roster changed while loading. Sync again.');}
    if(latest.archived===true&&!historical)return {status:'EMPTY',tasks:[],archived:true};
    const tasks=rows.map(row=>mapItem(row.id,row.data,week,version,uid)).sort((a,b)=>a.shiftDate.localeCompare(b.shiftDate)||a.startTime.localeCompare(b.startTime)||a.id.localeCompare(b.id));
    return {status:tasks.length?'DATA':'EMPTY',version,tasks:tasks.map(task=>({...task,...(latest.archived===true?{archived:true}:{})})),...(latest.archived===true?{archived:true}:{})};
  }
  throw new Error('Roster changed while loading. Sync again.');
}
export function rosterWeek(week:string,tasks:readonly DemoShift[]):RosterWeek {
  const days=Array.from({length:7},(_,index)=>{
    const date=shiftWeek(week,index),value=new Date(date+'T12:00:00');
    const duties=tasks.filter(task=>task.shiftDate===date).map(task=>({id:task.id,scheduledWorkId:task.scheduledWorkId,title:task.title,shiftDate:date,startTime:task.startTime,endTime:task.endTime,locationId:task.locationId,status:task.status}));
    return {id:date,date:String(value.getDate()),day:value.toLocaleDateString('en-ZA',{weekday:'short'}),shiftDate:date,duties,isDayOff:!duties.length};
  });
  return {id:week,range:`${week} – ${shiftWeek(week,6)}`,days};
}
