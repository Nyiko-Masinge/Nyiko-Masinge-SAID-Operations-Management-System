'use strict';
const {createHash} = require('node:crypto');
const key = value => createHash('sha256').update(value).digest('hex');
const compact = work => work ? {scheduledWorkId:work.scheduledWorkId,title:String(work.title).slice(0,200),date:work.date,startTime:work.startTime,endTime:work.endTime,locationId:work.locationId,requiredStaff:work.requiredStaff,isCritical:work.isCritical,assignedUids:work.assignedUids} : null;
const signature = work => JSON.stringify(work ? {...work, assignedUids:[...work.assignedUids].sort()} : null);
function publicationJobs(eventId,event,before,after,supervisors) {
  const previous=new Map(before.map(w=>[w.scheduledWorkId,w])), next=new Map(after.map(w=>[w.scheduledWorkId,w]));
  const jobs=[];
  for(const workId of new Set([...previous.keys(),...next.keys()])) {
    const a=previous.get(workId),b=next.get(workId);
    if(signature(a)===signature(b)) continue;
    const recipients=[...new Set([...(a?.assignedUids ?? []),...(b?.assignedUids ?? [])])];
    if(recipients.length) jobs.push({id:key(`${eventId}:work:${workId}`),data:{eventId,category:'Roster',issuedBy:event.actor,createdAt:event.occurredAt,weekStart:event.weekStart,publicationVersion:event.publicationVersion,scheduledWorkId:workId,before:compact(a),after:compact(b),recipients}});
    if(b?.isCritical && new Set(b.assignedUids).size<b.requiredStaff && supervisors.length) jobs.push({id:key(`${eventId}:critical:${workId}`),data:{eventId,category:'CriticalDuty',issuedBy:event.actor,createdAt:event.occurredAt,weekStart:event.weekStart,publicationVersion:event.publicationVersion,scheduledWorkId:workId,before:null,after:compact(b),recipients:supervisors,criticalGap:true}});
  }
  return jobs;
}
async function createOnce(ref,data) {try{await ref.create(data);}catch(error){if(error.code!==6&&error.code!=='already-exists')throw error;}}
async function supervisorUids(db) {
  const [employees,roles]=await Promise.all([db.collection('employees').get(),db.collection('roles').get()]);
  const ids=new Set(roles.docs.filter(d=>d.data().name==='Supervisor/Administrator'&&(d.data().id===undefined||d.data().id===d.id)).map(d=>d.id));
  return employees.docs.filter(d=>ids.has(d.data().roleId)&&d.data().active===true).map(d=>d.id);
}
async function queueNotifications(db,eventId,event) {
  if(!['RosterPublished','RosterRepublished','TaskUnableToComplete'].includes(event.type))return;
  const supervisors=await supervisorUids(db);
  let jobs;
  if(event.type==='TaskUnableToComplete'){
    const item=await db.doc(`publishedRosters/${event.weekStart}/versions/${event.publicationVersion}/items/${event.scheduledWorkId}`).get();
    if(!item.exists)throw Error('Missing immutable work for committed event.');
    jobs=[{id:key(`${eventId}:unable`),data:{eventId,category:'TaskUpdate',issuedBy:event.actor,createdAt:event.occurredAt,weekStart:event.weekStart,publicationVersion:event.publicationVersion,scheduledWorkId:event.scheduledWorkId,after:compact(item.data()),before:null,reason:String(event.reason??'').slice(0,2000),recipients:supervisors,unable:true}}];
  }else{
    const root=db.collection(`publishedRosters/${event.weekStart}/versions`);
    const [before,after]=await Promise.all([event.previousPublicationVersion?root.doc(event.previousPublicationVersion).collection('items').get():Promise.resolve({docs:[]}),root.doc(event.publicationVersion).collection('items').get()]);
    jobs=publicationJobs(eventId,event,before.docs.map(d=>d.data()),after.docs.map(d=>d.data()),supervisors);
  }
  for(let i=0;i<jobs.length;i+=10)await Promise.all(jobs.slice(i,i+10).map(job=>createOnce(db.doc(`notificationJobs/${job.id}`),job.data)));
}
function notificationFor(job,uid) {
  const work=job.after??job.before;
  const added=job.after?.assignedUids.includes(uid),removed=job.before?.assignedUids.includes(uid)&&!added;
  const title=job.criticalGap?'Critical coverage gap':job.unable?'Unable to Complete':removed?'Assignment removed':job.before?'Roster assignment changed':'Roster published';
  const change=removed?'Your assignment was removed':job.before?'Your assigned duty changed':'You have a published assignment';
  return {eventId:job.eventId,category:job.category,title,message:(job.criticalGap?`${work.title}: ${work.assignedUids.length}/${work.requiredStaff} staff assigned.`:job.unable?`${work.title}: ${job.reason}`:`${change}: ${work.title}, ${work.date} ${work.startTime}-${work.endTime}, area ${work.locationId}. Issued by ${job.issuedBy.displayName}.`).slice(0,2400),
    createdAt:job.createdAt,effectiveAt:`${work.date}T${work.startTime}:00+02:00`,weekStart:job.weekStart,publicationVersion:job.publicationVersion,scheduledWorkId:job.scheduledWorkId,issuedBy:job.issuedBy,isRead:false};
}
async function deliverJob(db,jobId,job) {
  for(let i=0;i<job.recipients.length;i+=20)await Promise.all(job.recipients.slice(i,i+20).map(uid=>createOnce(db.doc(`employees/${uid}/notifications/${jobId}`),notificationFor(job,uid))));
}
module.exports={publicationJobs,notificationFor,queueNotifications,deliverJob,key};
