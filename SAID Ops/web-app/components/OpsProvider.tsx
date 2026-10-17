'use client';
import { createContext, Fragment, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getAllLocations, type Location } from '../lib/locations';
import { useAuth } from './AuthProvider';
import { createMockRoster } from '../lib/roster/mock';
import { copyPreviousRoster, copyPublishedRoster, generateRecurringDuties } from '../lib/roster/generation';
import { getPublishedRoster, getRosterLifecycle, publishRoster, workSignature } from '../lib/roster/publication';
import { assignToWork, createScheduledWork, editScheduledWork, reassignOnWork, removeScheduledWork, unassignFromWork } from '../lib/roster/operations';
import { validateTemplate, type TemplateResult } from '../lib/roster/templates';
import { firestoreRosterEnabled } from '../lib/roster/backend';
import { loadWorkforce, mapWorkforce } from '../lib/roster/workforce';
import { loadTemplates, mapTemplate, templateFields } from '../lib/planning/templates';
import { persistWorkforce, persistTemplate } from '../lib/planning/client';
import type { Availability, WorkforceFields } from '../lib/planning/model';
import { persistPublication, publicationPayload } from '../lib/roster/publishClient';
import { mapPublicationItem, readCurrentRosterPublication, restoreRosterItems } from '../lib/roster/currentPublication';
import { cloneWork } from '../lib/roster/snapshot';
import { addDays, datesForWeek, weekStartFor } from '../lib/roster/mock';
import type { DutyTemplate, PublicationResult, PublishedRoster, PublishedRosters, RosterActionResult, RosterGenerationResult, RosterLifecycle, RosterMutationResult, ScheduleInput, ScheduledWork } from '../lib/roster/types';
export type Staff={id:string;employeeId?:string;uid?:string;name:string;role:string;locationId:string;status:'Active'|'Inactive'|'Unknown';availability:'Available'|'On Duty'|'On Leave'|'Training'|'Unavailable'|'Unknown';availabilityPlan?:Availability;workload:number;email:string;phone:string;skills:string[];skillsKnown?:boolean;operationalMissing?:boolean;revision?:number;publicationFallback?:boolean};
export type Duty=DutyTemplate;
export type Assignment={id:string;dutyId:string;day:string;staffIds:string[];status:'Assigned'|'Unassigned'|'Conflict'|'Upcoming'};
const seedStaffSource=[{id:'SAID-VA-1024',name:'Sarah Jenkins',role:'Veterinary Assistant',locationName:'Intake Ward A',status:'Active',availability:'Available',workload:65,email:'sarah.jenkins@saidops.demo',phone:'071 234 5678',skills:['Animal Handling','Intake Procedures','Infection Control','Theatre Support']},{id:'EMP-0008',name:'Lindiwe Mokoena',role:'Nurse',locationName:'Ward B',status:'Active',availability:'Unavailable',workload:48,email:'lindiwe.m@saidops.demo',phone:'072 341 8902',skills:['Ward Care','Patient Records','First Aid']},{id:'EMP-0014',name:'Marco Radebe',role:'Theatre Technician',locationName:'Theatre 1',status:'Active',availability:'Available',workload:72,email:'marco.r@saidops.demo',phone:'073 882 4411',skills:['Theatre Support','Equipment Checks','Sterilisation']},{id:'EMP-0003',name:'Thabo Dlamini',role:'Animal Care Assistant',locationName:'Ward A & C',status:'Active',availability:'Available',workload:55,email:'thabo.d@saidops.demo',phone:'074 443 1129',skills:['Animal Handling','Kennel Care','Infection Control']},{id:'EMP-0017',name:'Sipho Ndlovu',role:'Driver',locationName:'Outreach',status:'Active',availability:'Training',workload:30,email:'sipho.n@saidops.demo',phone:'071 700 1020',skills:['Outreach Support','Vehicle Checks']},{id:'EMP-0021',name:'Lebogang Gama',role:'Veterinary Nurse',locationName:'Kennel Block',status:'Active',availability:'On Leave',workload:0,email:'lebogang.g@saidops.demo',phone:'071 330 8891',skills:['Kennel Care','Animal Handling']}];
const seedDuties:Duty[]=([['Admissions & Triage','Receive and triage new patients','Intake','07:00','60 min',2,'Daily','High'],['General Ward AM Round','Morning ward checks and care','Ward B','08:30','90 min',1,'Daily','Medium'],['Theatre Preparation','Prepare theatre for procedures','Theatre 1','09:30','60 min',2,'Daily','High'],['Treatment Sterilisation','Sterilise instruments and equipment','Ward A & C','13:00','60 min',2,'Daily','High'],['Oxygen Check','Check oxygen levels and equipment','General Wards','11:30','30 min',1,'Daily','Medium'],['Pharmacy Stock Take','Check and record pharmacy stock','Pharmacy','14:30','45 min',1,'Daily','High'],['Equipment Check','Check and record equipment status','All Areas','15:30','45 min',1,'Daily','Medium'],['Kennel Cleaning','Clean and disinfect kennel areas','Kennel Block','16:30','60 min',1,'Daily','Low'],['Inventory & Stock Check','General stock levels check','Break Room 2','16:30','30 min',1,'Mon, Wed, Fri','Low'],['Outreach Preparation','Prepare mobile unit and supplies','Outreach','18:30','60 min',1,'Tue, Thu','Medium'],['Night Ward Check','Evening ward and care check','General Wards','19:30','45 min',1,'Daily','Medium'],['Closing & Handover','Close day and handover to night team','All Areas','20:30','30 min',1,'Daily','Medium']] as [string,string,string,string,string,number,string,Duty["priority"]][]).map((d,i)=>({id:`d${i+1}`,name:d[0],description:d[1],area:d[2],time:d[3],duration:d[4],required:d[5] as number,recurrence:d[6],priority:d[7] as Duty['priority'],isCritical:['Admissions & Triage','Oxygen Check'].includes(d[0]),status:'Active' as const,requirements:['Area prepared and checked','Required equipment available','Complete operational handover']}));
type Ops={workforceLoading:boolean;workforceError:string|null;refreshWorkforce:()=>Promise<void>;integratedRoster:boolean;publishToStaff:(weekStart:string,confirmCoverage?:boolean)=>Promise<PublicationResult>;locations:Location[];allLocations:Location[];locationsLoading:boolean;locationsError:string|null;refreshLocations:()=>Promise<void>;locationName:(id:string)=>string;assignments:Assignment[];staff:Staff[];duties:Duty[];scheduledWork:ScheduledWork[];addStaff:(s:Omit<Staff,'id'>)=>void;updateStaff:(id:string,p:Partial<Staff>)=>void;addDuty:(d:Omit<Duty,'id'>)=>TemplateResult;updateDuty:(id:string,p:Partial<Duty>)=>TemplateResult;duplicateDuty:(id:string)=>TemplateResult;createScheduled:(input:ScheduleInput)=>RosterActionResult;editScheduled:(id:string,input:ScheduleInput)=>RosterActionResult;removeScheduled:(id:string)=>RosterActionResult;assignScheduled:(workId:string,staffId:string)=>RosterActionResult;unassignScheduled:(workId:string,staffId:string)=>RosterActionResult;reassignScheduled:(workId:string,currentStaffId:string,replacementStaffId:string)=>RosterActionResult;copyRoster:(weekStart:string)=>RosterGenerationResult;generateDuties:(weekStart:string)=>RosterGenerationResult;publishWeek:(weekStart:string,confirmCoverage?:boolean)=>PublicationResult;rosterLifecycle:(weekStart:string)=>RosterLifecycle;publishedRoster:(weekStart:string)=>PublishedRoster|undefined;assign:(assignmentId:string,staffId:string)=>string|undefined};
export type RosterReadState = {status:'LOADING'|'ERROR'|'EMPTY'|'DATA';error?:string;version?:string;archived?:boolean};
type RestoringOps = Omit<Ops,'updateStaff'|'addDuty'|'updateDuty'|'duplicateDuty'|'copyRoster'> & {
  copyRoster:(week:string)=>RosterGenerationResult|Promise<RosterGenerationResult>;
  updateStaff:(id:string,p:Partial<Staff>)=>Promise<void>|void;
  addDuty:(d:Omit<Duty,'id'>)=>TemplateResult|Promise<TemplateResult>;
  updateDuty:(id:string,p:Partial<Duty>)=>TemplateResult|Promise<TemplateResult>;
  duplicateDuty:(id:string)=>TemplateResult|Promise<TemplateResult>;
  templatesLoading:boolean;templatesError:string|null;refreshTemplates:()=>Promise<void>;
  planningSaving:boolean;sessionKey:string;
  loadRosterWeek:(week:string)=>Promise<void>;rosterReadState:(week:string)=>RosterReadState;
};
const C=createContext<RestoringOps|null>(null); export function useOps(){const c=useContext(C);if(!c)throw Error('OpsProvider missing');return c;}
export function OpsProvider({children}:{children:ReactNode}){
  const { status, user } = useAuth();
  const uid = user?.uid;
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const locations = useMemo(() => allLocations.filter(location => location.active !== false), [allLocations]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState<string|null>(null);
  const locationRequest = useRef(0);
  const seeded = useRef(false);
  const sessionOwner = useRef<string|undefined>(undefined);
  const[staff,setStaff]=useState<Staff[]>([]);
  const [workforceLoading,setWorkforceLoading]=useState(firestoreRosterEnabled);
  const [workforceError,setWorkforceError]=useState<string|null>(null);
  const workforceRequest=useRef(0);
  const publishing=useRef(false);
  const refreshWorkforce=useCallback(async()=>{
    if(!firestoreRosterEnabled||status!=='signedIn'||!uid)return;
    const request=++workforceRequest.current;
    setWorkforceLoading(true);
    try{
      const people=await loadWorkforce();
      if(request!==workforceRequest.current)return;
      setStaff(previous=>people.concat(previous.filter(person=>person.publicationFallback&&!people.some(row=>row.uid===person.uid))));
      setWorkforceError(null);
    }catch(error){if(request===workforceRequest.current)setWorkforceError(error instanceof Error?error.message:'Could not load workforce. Retry before scheduling.');}
    finally{if(request===workforceRequest.current)setWorkforceLoading(false);}
  },[status,uid]);
  useEffect(()=>{
    setWorkforceError(null);
    setWorkforceLoading(firestoreRosterEnabled&&status==='loading');
    if(firestoreRosterEnabled&&status==='signedIn'&&uid)void refreshWorkforce();
    return()=>{workforceRequest.current++;};
  },[status,uid,refreshWorkforce]);
  const[duties,setDuties]=useState<Duty[]>([]);
  const dutiesRef=useRef(duties);
  const [templatesLoading,setTemplatesLoading]=useState(firestoreRosterEnabled);
  const [templatesError,setTemplatesError]=useState<string|null>(null);
  const templatesRequest=useRef(0);
  const [planningSaving,setPlanningSaving]=useState(false);
  const planningLock=useRef<symbol|null>(null);
  const refreshTemplates=useCallback(async()=>{
    if(!firestoreRosterEnabled||status!=='signedIn'||!uid)return;
    const request=++templatesRequest.current;
    setTemplatesLoading(true);
    try{
      const templates=await loadTemplates();
      if(request!==templatesRequest.current)return;
      const next=templates.concat(dutiesRef.current.filter(item=>item.publicationFallback&&!templates.some(row=>row.id===item.id)));
      dutiesRef.current=next;setDuties(next);setTemplatesError(null);
    }catch(error){if(request===templatesRequest.current)setTemplatesError(error instanceof Error?error.message:'Could not load duty templates. Retry.');}
    finally{if(request===templatesRequest.current)setTemplatesLoading(false);}
  },[status,uid]);
  const[scheduledWork,setScheduledWork]=useState<ScheduledWork[]>([]);
  const scheduledRef=useRef(scheduledWork);
  const[publishedRosters,setPublishedRosters]=useState<PublishedRosters>({});
  const publishedRef=useRef<PublishedRosters>(publishedRosters);
  const staffRef=useRef(staff);staffRef.current=staff;
  const locationsRef=useRef(allLocations);locationsRef.current=allLocations;
  const [rosterReads,setRosterReads]=useState<Record<string,RosterReadState>>({});
  const rosterGeneration=useRef(0);
  const rosterRequests=useRef(new Map<string,number>());
  const localWeeks=useRef(new Set<string>());
  const seedIfNeeded=useCallback((fetched:Location[])=>{
    if(seeded.current)return;
    const resolve=(name:string)=>fetched.find(location=>location.name.toLowerCase()===name.toLowerCase())?.id ?? '';
    // These remain session demo records. Unresolved names never become selectable locations.
    const nextStaff=seedStaffSource.map(({locationName,...person})=>({...person,locationId:resolve(locationName)})) as Staff[];
    const nextDuties=seedDuties.map(duty=>({...duty,locationId:resolve(duty.area)}));
    const nextWork=firestoreRosterEnabled?[]:createMockRoster(nextDuties);
    if(!firestoreRosterEnabled)setStaff(nextStaff);
    if(!firestoreRosterEnabled){dutiesRef.current=nextDuties;setDuties(nextDuties);}
    scheduledRef.current=nextWork;setScheduledWork(nextWork);
    seeded.current=true;
  },[]);
  // Exposed so screens that change locations (add/rename/retire) can make Staff & Duties
  // pickers see the change immediately instead of needing a full page reload. On failure the
  // previously loaded locations are kept as-is -- a refresh error should never blank out
  // records that already loaded successfully.
  const refreshLocations=useCallback(async()=>{
    if(status!=='signedIn'||!uid)return;
    const request=++locationRequest.current;
    setLocationsLoading(true);
    try{
      const fetched=await getAllLocations();
      if(request!==locationRequest.current)return;
      setAllLocations(fetched);
      setLocationsError(null);
      seedIfNeeded(fetched);
    }catch{
      if(request===locationRequest.current)setLocationsError('Could not load operational areas from Firestore. Check your connection and try again.');
    }finally{
      if(request===locationRequest.current)setLocationsLoading(false);
    }
  },[status,uid,seedIfNeeded]);

  useEffect(()=>{
    // Only browser-owned demo state is cleared; Firestore locations are never mutated.
    sessionOwner.current=status==='signedIn'?uid:undefined;
    planningLock.current=null;setPlanningSaving(false);
    templatesRequest.current++;
    setTemplatesError(null);setTemplatesLoading(firestoreRosterEnabled&&status!=='signedOut');
    seeded.current=false;
    setStaff([]);
    dutiesRef.current=[];setDuties([]);
    scheduledRef.current=[];setScheduledWork([]);
    publishedRef.current={};setPublishedRosters({});
    rosterGeneration.current++;rosterRequests.current.clear();localWeeks.current.clear();setRosterReads({});
    nextWorkId.current=0;
    setAllLocations([]);
    if(status==='signedIn'&&uid){void refreshLocations();void refreshTemplates();}
    else{
      setAllLocations([]);
      setLocationsError(null);
      setLocationsLoading(status==='loading');
    }
    // Ignore an old session's request after logout, a UID change, or unmount.
    return()=>{locationRequest.current++;templatesRequest.current++;rosterGeneration.current++;};
  },[status,uid,refreshLocations,refreshTemplates]);

  const locationName=useCallback((id:string)=>allLocations.find(l=>l.id===id)?.name ?? (id || 'Unassigned Location'),[allLocations]);
  // Do not expose the previous owner's values even on the render before effects reset.
  const sessionReady=status==='signedIn'&&Boolean(uid)&&sessionOwner.current===uid;

  const loadRosterWeek=useCallback(async(week:string)=>{
    if(!firestoreRosterEnabled||!sessionReady||workforceLoading||workforceError||templatesLoading||templatesError||locationsLoading||locationsError)return;
    // A local mutation, including removing every item, wins until provider/session reset.
    if(localWeeks.current.has(week))return;
    const generation=rosterGeneration.current,owner=uid;
    const request=(rosterRequests.current.get(week)??0)+1;rosterRequests.current.set(week,request);
    const active=()=>generation===rosterGeneration.current&&sessionOwner.current===owner&&rosterRequests.current.get(week)===request;
    setRosterReads(current=>({...current,[week]:{status:'LOADING'}}));
    try{
      const publication=await readCurrentRosterPublication(week);
      if(!active()||localWeeks.current.has(week))return;
      const restored=restoreRosterItems(publication.items,staffRef.current,locationsRef.current,dutiesRef.current);
      const dates=new Set(datesForWeek(week));
      const otherWeeks=scheduledRef.current.filter(work=>!dates.has(work.date));
      if(restored.scheduled.some(work=>otherWeeks.some(other=>other.id===work.id)))throw new Error('Roster identity belongs to another loaded week.');
      const nextWork=[...otherWeeks,...restored.scheduled];
      scheduledRef.current=nextWork;setScheduledWork(nextWork);
      staffRef.current=restored.staff;setStaff(restored.staff);
      dutiesRef.current=restored.duties;setDuties(restored.duties);
      const nextPublished={...publishedRef.current};
      if(publication.status==='DATA')nextPublished[week]={weekStart:week,scheduledWork:restored.scheduled.map(cloneWork)};
      else delete nextPublished[week];
      publishedRef.current=nextPublished;setPublishedRosters(nextPublished);
      setRosterReads(current=>({...current,[week]:publication.status==='DATA'?{status:'DATA',version:publication.version}:{status:'EMPTY',archived:publication.archived}}));
    }catch{
      if(active()&&!localWeeks.current.has(week))setRosterReads(current=>({...current,[week]:{status:'ERROR',error:'Could not restore this roster. Check your connection and access, then retry.'}}));
    }
  },[sessionReady,uid,workforceLoading,workforceError,templatesLoading,templatesError,locationsLoading,locationsError]);
  const rosterReadState=(week:string):RosterReadState=>!firestoreRosterEnabled?{status:'EMPTY'}:
    sessionReady?(rosterReads[week]??(localWeeks.current.has(week)?{status:publishedRef.current[week]?'DATA':'EMPTY'}:{status:'LOADING'})):{status:'LOADING'};
  const markChangedWeeks=(before:readonly ScheduledWork[],after:readonly ScheduledWork[])=>{
    const old=new Map(before.map(work=>[work.id,work]));
    const next=new Map(after.map(work=>[work.id,work]));
    const changed=new Set<string>();
    for(const work of [...before,...after]){
      if(JSON.stringify(old.get(work.id))!==JSON.stringify(next.get(work.id)))changed.add(weekStartFor(work.date));
    }
    for(const week of changed)localWeeks.current.add(week);
    if(changed.size)setRosterReads(current=>{
      const updated={...current};for(const week of changed)updated[week]={status:publishedRef.current[week]?'DATA':'EMPTY'};return updated;
    });
  };

  // Compatibility view only: WS2 ScheduledWork is the sole mutable scheduling authority.
  const assignments=useMemo<Assignment[]>(()=>scheduledWork.filter(work=>work.dutyId).map(work=>({id:work.id,dutyId:work.dutyId!,day:work.date,staffIds:work.staffIds,status:work.staffIds.length?'Assigned':'Unassigned'})),[scheduledWork]);
  const nextWorkId=useRef(0);
  const nextScheduledId=()=>`sw-${Date.now()}-${++nextWorkId.current}`;
  const addStaff=(s:Omit<Staff,'id'>)=>{
    if(firestoreRosterEnabled)throw new Error('Staff accounts require administrator provisioning.');
    setStaff(x=>[...x,{...s,id:`EMP-${String(x.length+30).padStart(4,'0')}`}]);
  };
  const savePlanning=async<T,>(save:()=>Promise<T>,apply:(result:T)=>void):Promise<void>=>{
    if(!sessionReady||!user)throw new Error('Sign in as a supervisor before saving.');
    if(planningLock.current)throw new Error('A planning record is already saving.');
    const owner=uid,generation=rosterGeneration.current,lock=Symbol();
    planningLock.current=lock;setPlanningSaving(true);
    try{
      const result=await save();
      if(sessionOwner.current!==owner||rosterGeneration.current!==generation)throw new Error('Session changed while saving. Reload planning records for this account.');
      apply(result);
    }finally{if(planningLock.current===lock){planningLock.current=null;setPlanningSaving(false);}}
  };
  const updateStaff=(id:string,p:Partial<Staff>):Promise<void>|void=>{
    if(!firestoreRosterEnabled){setStaff(x=>x.map(v=>v.id===id?{...v,...p}:v));return;}
    const person=staffRef.current.find(row=>row.id===id);
    if(!person?.uid||person.publicationFallback)return Promise.reject(new Error('Employee requires trusted provisioning repair.'));
    const fields:Partial<WorkforceFields>={};
    if(p.role!==undefined)fields.jobCategory=p.role;
    if(p.locationId!==undefined)fields.locationId=p.locationId;
    if(p.status!==undefined){if(p.status==='Unknown')return Promise.reject(new Error('Choose active or inactive.'));fields.active=p.status==='Active';}
    if(p.availabilityPlan!==undefined)fields.availability=p.availabilityPlan;
    if(p.skills!==undefined)fields.skills=p.skills;
    // A form carries the revision it opened with; refresh must not silently bless stale input.
    return savePlanning(()=>persistWorkforce(user!,person.uid!,p.revision??person.revision??0,fields),data=>{
      const saved=mapWorkforce(person.uid!,data);
      workforceRequest.current++;setWorkforceLoading(false);
      setStaff(rows=>rows.map(row=>row.id===id?saved:row));
    });
  };
  const nextDutyId=()=>`d-${crypto.randomUUID()}`;
  const commitDuty=(candidate:Duty, editingId?:string):TemplateResult|Promise<TemplateResult>=>{
    const existing=editingId?dutiesRef.current.find(item=>item.id===editingId):undefined;
    const location=allLocations.find(item=>candidate.locationId?item.id===candidate.locationId:item.name===candidate.area);
    const unchangedHistorical=existing && existing.locationId===location?.id;
    if(!location || (location.active===false && !unchangedHistorical))return {ok:false,code:'AREA_REQUIRED'};
    candidate={...candidate,locationId:location.id,area:location.name};
    const result=validateTemplate(candidate,dutiesRef.current,editingId);
    if(!result.ok)return result;
    if(firestoreRosterEnabled){
      if(existing?.publicationFallback)return {ok:false,code:'INVALID_ID'};
      return savePlanning(()=>persistTemplate(user!,candidate.id,editingId?(candidate.revision??existing?.revision??0):0,!editingId,templateFields(candidate)),data=>{
        const saved={...mapTemplate(candidate.id,data),area:location.name};
        templatesRequest.current++;setTemplatesLoading(false);
        const next=editingId?dutiesRef.current.map(item=>item.id===editingId?saved:item):[...dutiesRef.current,saved];
        dutiesRef.current=next;setDuties(next);
      }).then(()=>({ok:true} as TemplateResult)).catch(error=>({ok:false,code:'SAVE_FAILED',message:error instanceof Error?error.message:'Template save failed.'}));
    }
    const next=editingId?dutiesRef.current.map(item=>item.id===editingId?candidate:item):[...dutiesRef.current,candidate];
    dutiesRef.current=next;setDuties(next);
    return {ok:true};
  };
  const addDuty=(d:Omit<Duty,'id'>):TemplateResult|Promise<TemplateResult>=>commitDuty({...d,id:nextDutyId()});
  const updateDuty=(id:string,p:Partial<Duty>):TemplateResult|Promise<TemplateResult>=>{
    const existing=dutiesRef.current.find(item=>item.id===id);
    return existing?commitDuty({...existing,...p,id},id):{ok:false,code:'INVALID_ID'};
  };
  const duplicateDuty=(id:string):TemplateResult|Promise<TemplateResult>=>{
    const existing=dutiesRef.current.find(item=>item.id===id);
    return existing?commitDuty({...existing,id:nextDutyId(),name:`${existing.name} (Copy)`}):{ok:false,code:'INVALID_ID'};
  };
  const commit=(result:RosterMutationResult):RosterActionResult=>{
    if(!result.ok)return result;
    if([...scheduledRef.current,...result.scheduled].some(work=>rosterReads[weekStartFor(work.date)]?.archived&&JSON.stringify(scheduledRef.current.find(row=>row.id===work.id))!==JSON.stringify(result.scheduled.find(row=>row.id===work.id))))return {ok:false,code:'ARCHIVED'};
    markChangedWeeks(scheduledRef.current,result.scheduled);
    scheduledRef.current=result.scheduled;
    setScheduledWork(result.scheduled);
    return {ok:true};
  };
  const scheduleLocation=(input:ScheduleInput,existing?:ScheduledWork):ScheduleInput|undefined=>{
    const location=allLocations.find(item=>input.locationId?item.id===input.locationId:item.name===input.area);
    if(!location || (location.active===false && location.id!==existing?.locationId))return undefined;
    return {...input,locationId:location.id,area:location.name};
  };
  const createScheduled=(input:ScheduleInput):RosterActionResult=>{
    const resolved=scheduleLocation(input);
    return resolved?commit(createScheduledWork(nextScheduledId(),resolved,scheduledRef.current,duties)):{ok:false,code:'AREA_REQUIRED'};
  };
  const editScheduled=(id:string,input:ScheduleInput):RosterActionResult=>{
    const existing=scheduledRef.current.find(work=>work.id===id);
    if(!existing)return {ok:false,code:'WORK_NOT_FOUND'};
    const resolved=scheduleLocation(input,existing);
    return resolved?commit(editScheduledWork(id,resolved,scheduledRef.current,duties)):{ok:false,code:'AREA_REQUIRED'};
  };
  const removeScheduled=(id:string)=>commit(removeScheduledWork(id,scheduledRef.current));
  const assignScheduled=(workId:string,staffId:string)=>commit(assignToWork(workId,staffId,scheduledRef.current,staff));
  const unassignScheduled=(workId:string,staffId:string)=>commit(unassignFromWork(workId,staffId,scheduledRef.current));
  const reassignScheduled=(workId:string,currentStaffId:string,replacementStaffId:string)=>commit(reassignOnWork(workId,currentStaffId,replacementStaffId,scheduledRef.current,staff));
  const commitGeneration=(result:RosterGenerationResult):RosterGenerationResult=>{
    if(result.ok && result.created>0){
      const existingIds=new Set(scheduledRef.current.map(work=>work.id));
      result.scheduled=result.scheduled.filter(work=>{
        if(existingIds.has(work.id))return true;
        const location=locations.find(item=>work.locationId?item.id===work.locationId:item.name===work.area);
        if(location){work.locationId=location.id;work.area=location.name;return true;}
        result.created--;
        result.invalid.push({sourceId:work.dutyId??work.id,code:'AREA_REQUIRED'});
        return false;
      });
      markChangedWeeks(scheduledRef.current,result.scheduled);
      scheduledRef.current=result.scheduled;setScheduledWork(result.scheduled);
    }
    return result;
  };
  const copying=useRef(false);
  const copyRoster=(weekStart:string):RosterGenerationResult|Promise<RosterGenerationResult>=>{
    if(rosterReads[weekStart]?.archived)return {ok:false,code:'ARCHIVED'};
    if(!firestoreRosterEnabled)return commitGeneration(copyPreviousRoster(weekStart,scheduledRef.current,duties,nextScheduledId));
    return (async()=>{
      if(!sessionReady||!user||workforceLoading||workforceError||templatesLoading||templatesError||locationsLoading||locationsError)
        throw new Error('Load workforce, templates and locations before copying a roster.');
      if(copying.current)throw new Error('A roster copy is already loading.');
      copying.current=true;
      const owner=uid,generation=rosterGeneration.current;
      try{
        const source=await readCurrentRosterPublication(addDays(weekStart,-7));
        if(sessionOwner.current!==owner||rosterGeneration.current!==generation)throw new Error('Session changed while copying. Reload the roster for this account.');
        const restored=restoreRosterItems(source.items,staffRef.current,locationsRef.current,dutiesRef.current);
        // Never replace the source week or target edits, including edits made during the read.
        const result=copyPublishedRoster(weekStart,scheduledRef.current,restored.scheduled,restored.duties,nextScheduledId);
        if(result.ok&&result.created){staffRef.current=restored.staff;setStaff(restored.staff);dutiesRef.current=restored.duties;setDuties(restored.duties);}
        return commitGeneration(result);
      }catch(error){
        throw new Error(error instanceof Error&&error.message.startsWith('Session changed')?error.message:'Could not copy the previous published roster. Check your connection and access, then retry. Your target edits were kept.');
      }finally{copying.current=false;}
    })();
  };
  const generateDuties=(weekStart:string):RosterGenerationResult=>rosterReads[weekStart]?.archived?{ok:false,code:'ARCHIVED'}:commitGeneration(generateRecurringDuties(weekStart,scheduledRef.current,duties,nextScheduledId));
  const publishWeek=(weekStart:string,confirmCoverage=false):PublicationResult=>{
    if(firestoreRosterEnabled)throw new Error('Integrated publication must use the trusted publisher.');
    const result=publishRoster(weekStart,scheduledRef.current,duties,publishedRef.current,confirmCoverage);
    if(result.status==='published'){
      const next={...publishedRef.current,[weekStart]:result.snapshot};
      publishedRef.current=next;
      setPublishedRosters(next);
    }
    return result;
  };
  const publishToStaff=async(weekStart:string,confirmCoverage=false):Promise<PublicationResult>=>{
    if(rosterReads[weekStart]?.archived)throw new Error('Archived rosters are read-only. Open History to review them.');
    if(!firestoreRosterEnabled)return publishWeek(weekStart,confirmCoverage);
    if(publishing.current)throw new Error('A publication is already being saved.');
    if(status!=='signedIn'||!user||sessionOwner.current!==uid)throw new Error('Sign in as a supervisor before publishing.');
    if(workforceLoading||workforceError)throw new Error('Load the provisioned workforce before publishing.');
    const result=publishRoster(weekStart,scheduledRef.current,dutiesRef.current,publishedRef.current,confirmCoverage,staffRef.current);
    if(result.status!=='published')return result;
    const owner=uid,generation=rosterGeneration.current;
    const payload=publicationPayload(result.snapshot,staff,dutiesRef.current,confirmCoverage);
    publishing.current=true;
    try{
      const saved=await persistPublication(user,payload);
      if(sessionOwner.current!==owner||rosterGeneration.current!==generation)throw new Error('The session changed while publishing. Reload the roster for the current account.');
      if(saved?.items){
        const authoritative=restoreRosterItems(saved.items.map(item=>mapPublicationItem(String(item.scheduledWorkId),item,weekStart)),staffRef.current,locationsRef.current,dutiesRef.current).scheduled;
        const submitted=new Map(result.snapshot.scheduledWork.map(item=>[item.id,item]));
        const canonical=new Map(authoritative.map(item=>[item.id,item]));
        const reconciled=scheduledRef.current.map(item=>submitted.has(item.id)&&workSignature(item)===workSignature(submitted.get(item.id)!)?cloneWork(canonical.get(item.id)!):item);
        scheduledRef.current=reconciled;setScheduledWork(reconciled);
        result.snapshot={weekStart,scheduledWork:authoritative.map(cloneWork)};
        result.warnings=saved.warnings;result.coverageIssues=saved.coverageIssues;
        result.uncoveredCriticalCount=authoritative.filter(item=>item.isCritical&&new Set(item.staffIds).size<item.required).length;
      }
      const next={...publishedRef.current,[weekStart]:result.snapshot};
      publishedRef.current=next;setPublishedRosters(next);
      if(!getRosterLifecycle(weekStart,scheduledRef.current,next).hasUnpublishedChanges)localWeeks.current.delete(weekStart);
      setRosterReads(current=>({...current,[weekStart]:{status:'DATA'}}));
      return result;
    }catch(error){
      if(sessionOwner.current===owner&&rosterGeneration.current===generation&&error instanceof Error&&'code' in error&&error.code==='COVERAGE_CONFIRMATION_REQUIRED'&&'coverageIssues' in error){
        return {...result,status:'confirmation_required',coverageIssues:error.coverageIssues as NonNullable<PublicationResult['coverageIssues']>};
      }
      throw error;
    }finally{publishing.current=false;}
  };
  const rosterLifecycle=(weekStart:string):RosterLifecycle=>sessionReady?getRosterLifecycle(weekStart,scheduledWork,publishedRosters):{status:'Draft',hasUnpublishedChanges:false};
  const publishedRoster=(weekStart:string)=>sessionReady?getPublishedRoster(weekStart,publishedRef.current):undefined;
  // Preserve the existing alert prototype caller while roster UI uses typed results.
  const assign=(assignmentId:string,staffId:string)=>{
    const result=assignScheduled(assignmentId,staffId);
    return result.ok?undefined:result.code==='UNAVAILABLE'||result.code==='STAFF_NOT_FOUND'?'This staff member is unavailable and cannot be assigned.':`Assignment rejected: ${result.code}.`;
  };
  return <C.Provider value={{sessionKey:sessionReady?`${uid}:${rosterGeneration.current}`:'authorizing',planningSaving,templatesLoading,templatesError,refreshTemplates,loadRosterWeek,rosterReadState,workforceLoading,workforceError,refreshWorkforce,integratedRoster:firestoreRosterEnabled,publishToStaff,locations,allLocations,locationsLoading,locationsError,refreshLocations,locationName,assignments:sessionReady?assignments:[],staff:sessionReady?staff:[],duties:sessionReady?duties:[],scheduledWork:sessionReady?scheduledWork:[],addStaff,updateStaff,addDuty,updateDuty,duplicateDuty,createScheduled,editScheduled,removeScheduled,assignScheduled,unassignScheduled,reassignScheduled,copyRoster,generateDuties,publishWeek,rosterLifecycle,publishedRoster,assign}}><Fragment key={sessionReady?`${uid}:${rosterGeneration.current}`:'authorizing'}>{children}</Fragment></C.Provider>;
}
