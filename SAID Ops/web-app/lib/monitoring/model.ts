import type { CurrentItem } from '../roster/currentPublication';
import type { Execution } from '../roster/progress';
import type { Staff } from '../../components/OpsProvider';
import type { Location } from '../locations';
import { availableForWork, coverageIssue } from '../roster/scheduling';

export type OperationalEvent = {id:string; type:string; occurredAt:string; recordedAt:string; actor:{uid:string;employeeId:string;displayName:string}; actorProvenance:string; weekStart:string; publicationVersion:string; scheduledWorkId?:string; reason?:string};
export type OperationalNotification = {id:string; title:string; message:string; category:string; createdAt:string; isRead:boolean; scheduledWorkId?:string; weekStart?:string};
export type MonitoringSources = {version?:string; archived?:boolean; items:CurrentItem[]; workforce:Staff[]; progress:Execution[]; locations:Location[]; events:OperationalEvent[]; notifications:OperationalNotification[]};
export type Filters = {date:string; area:string; employee:string; status:string};
export type Exception = {id:string; workId:string; type:'UnassignedDuty'|'UnableToComplete'|'Overdue'|'Other'; title:string; details:string; critical:boolean};
export type DutyRow = {work:CurrentItem; area:string; status:Execution['status']; progress:Execution[]; exceptions:Exception[]};
export const facilityDate = (now=new Date()) => new Date(now.getTime()+2*3600_000).toISOString().slice(0,10);
export function weekForDate(date:string) { const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10); }
export function deriveMonitoring(source:MonitoringSources, filters:Filters, now=new Date()) {
  const rows: DutyRow[] = source.items.map(work=>{
    const progress=work.assignedUids.map(uid=>source.progress.find(r=>r.scheduledWorkId===work.id&&r.uid===uid));
    if(progress.some(row=>!row)) throw new Error('Required assigned progress is incomplete.');
    const executions=progress as Execution[];
    const status:Execution['status']=executions.some(r=>r.status==='Unable to Complete')?'Unable to Complete':executions.length&&executions.every(r=>r.status==='Completed')?'Completed':executions.some(r=>r.status==='In Progress')?'In Progress':'Scheduled';
    const exceptions:Exception[]=[];
    const add=(kind:string,type:Exception['type'],details:string,critical=work.isCritical)=>exceptions.push({id:`${kind}:${work.id}`,workId:work.id,type,title:work.title,details,critical});
    const coverage=coverageIssue({id:work.id,title:work.title,isCritical:work.isCritical,required:work.required,staffIds:work.assignedUids},work.requiredSkills??[],work.assignedUids.map(uid=>source.workforce.find(p=>p.uid===uid)?.skills??[]));
    if(!work.assignedUids.length)add('unassigned','UnassignedDuty','Unassigned published duty.');
    else if(work.assignedUids.length<work.required)add('understaffed','UnassignedDuty',`Understaffed: ${work.assignedUids.length}/${work.required} staff.`);
    if(coverage?.missingSkills.length)add('skills','Other',`Required skills missing: ${coverage.missingSkills.join(', ')}.`);
    if(work.isCritical&&coverage)add('critical','Other','Critical coverage gap.');
    for(const row of executions) if(row.status==='Unable to Complete')add(`unable:${row.uid}`,'UnableToComplete',`${row.displayName}: ${row.unableToCompleteReason ?? 'Reason unavailable'}`);
    if(status!=='Completed'&&now.getTime()>Date.parse(`${work.date}T${work.endTime}:00+02:00`))add('overdue','Overdue','Overdue incomplete duty.');
    for(const uid of work.assignedUids){const employee=source.workforce.find(p=>p.uid===uid);if(!employee||employee.operationalMissing)add(`profile:${uid}`,'Other','Assigned operational profile needs administrator review.');else if(employee.status!=='Active'||!employee.availabilityPlan||!availableForWork(employee.availabilityPlan,work))add(`availability:${uid}`,'Other','Assigned employee is now inactive or unavailable for this duty.');}
    return {work,area:source.locations.find(l=>l.id===work.locationId)?.name??work.locationId,status,progress:executions,exceptions};
  }).filter(row=>(!filters.date||row.work.date===filters.date)&&(!filters.area||row.work.locationId===filters.area)&&(!filters.employee||row.work.assignedUids.includes(filters.employee))&&(!filters.status||row.status===filters.status));
  const start=Date.parse(`${filters.date}T00:00:00+02:00`),end=start+86400_000;
  const unavailable=source.workforce.filter(p=>{
    if(p.status==='Unknown'||(p.status==='Active'&&!p.availabilityPlan))throw new Error('Authoritative availability is incomplete.');
    if(p.status!=='Active'||!p.availabilityPlan)return false;
    const a=p.availabilityPlan;
    return ['Unavailable','On Leave','Training'].includes(a.state)&&Date.parse(a.effectiveFrom)<end&&(a.effectiveTo===null||Date.parse(a.effectiveTo)>start);
  }).length;
  const areas=[...new Set(rows.map(r=>r.work.locationId))].map(id=>({id,name:source.locations.find(l=>l.id===id)?.name??id,duties:rows.filter(r=>r.work.locationId===id).length,attention:rows.filter(r=>r.work.locationId===id&&r.exceptions.length).length}));
  return {rows,areas,exceptions:rows.flatMap(r=>r.exceptions),metrics:{scheduled:new Set(rows.flatMap(r=>r.work.assignedUids)).size,unavailable,total:rows.length,completed:rows.filter(r=>r.status==='Completed').length,inProgress:rows.filter(r=>r.status==='In Progress').length,attention:rows.filter(r=>r.exceptions.length).length}};
}
