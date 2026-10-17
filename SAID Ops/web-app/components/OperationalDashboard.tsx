'use client';
import {useRef,useState} from 'react';
import Link from 'next/link';
import {OperationalMonitoringProvider,useOperationalMonitoring} from './OperationalMonitoringProvider';
import {useAuth} from './AuthProvider';
import {persistArchive} from '../lib/roster/archiveClient';
import {Icon,type IconName} from './Icons';
import {weekForDate,type DutyRow} from '../lib/monitoring/model';

export function MonitoringControls(){
  const {filters,setFilters,refresh,state}=useOperationalMonitoring();
  return <section className="panel monitoring-controls" aria-label="Monitoring filters">
    <label>Date<input aria-label="Monitoring date" type="date" value={filters.date} onInput={e=>{if(e.currentTarget.value)setFilters({...filters,date:e.currentTarget.value});}} onChange={e=>{if(e.target.value)setFilters({...filters,date:e.target.value});}} /></label>
    <label>Area<select aria-label="Monitoring area" value={filters.area} onChange={e=>setFilters({...filters,area:e.target.value})}><option value="">All areas</option>{state.source?.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
    <label>Employee<select aria-label="Monitoring employee" value={filters.employee} onChange={e=>setFilters({...filters,employee:e.target.value})}><option value="">All employees</option>{state.source?.workforce.map(p=><option key={p.uid} value={p.uid}>{p.name} ({p.employeeId})</option>)}</select></label>
    <label>Status<select aria-label="Monitoring status" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">All statuses</option>{['Scheduled','In Progress','Completed','Unable to Complete'].map(s=><option key={s}>{s}</option>)}</select></label>
    <button className="action-button" onClick={refresh}>Refresh monitoring</button>
    <p className="monitoring-refreshed">{state.refreshedAt?`Last refreshed: ${new Date(state.refreshedAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})}`:'Awaiting refresh'}</p>
  </section>;
}
export function MonitoringState(){const {state,view}=useOperationalMonitoring();return state.status==='LOADING'?<p role="status">Loading operational data…</p>:state.status==='ERROR'?<p role="alert">Could not load all required operational sources. Refresh to retry.</p>:!view?.rows.length?<p>No published duties match this selection.</p>:null;}
function DutyDetail({row,close}:{row:DutyRow;close:()=>void}){
  return <section className="panel monitoring-detail" aria-label="Published duty detail"><button className="action-button" onClick={close}>Close detail</button><h2>{row.work.title}</h2><p>{row.work.date} · {row.work.startTime}–{row.work.endTime} · {row.area} · {row.status}{row.work.isCritical?' · Critical':''}</p><p>{row.work.description}</p><p>Staffing: {row.work.assignedUids.length}/{row.work.required}</p>{row.work.requirements?.length?<ul>{row.work.requirements.map(r=><li key={r}>{r}</li>)}</ul>:null}<ul>{row.progress.map(p=><li key={p.uid}>{p.displayName} ({p.employeeId}): {p.status}{p.unableToCompleteReason?` · ${p.unableToCompleteReason}`:''}{p.updatedAt?` · ${new Date(p.updatedAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})}`:''}</li>)}</ul>{row.exceptions.map(e=><p key={e.id} className="monitoring-exception">{e.details}</p>)}</section>;
}
export function OperationalDashboard({alertsOnly=false}:{alertsOnly?:boolean}){
  const {state,view,filters}=useOperationalMonitoring(),[selected,setSelected]=useState('');
  const ready=state.status==='DATA'||state.status==='EMPTY';
  const metrics=view?.metrics;
  const stats:[IconName,string,number|undefined,string][]=[['users','Staff Scheduled',metrics?.scheduled,'Unique assigned staff'],['users','Staff Unavailable',metrics?.unavailable,'Active workforce · selected date'],['clipboard','Total Duties',metrics?.total,'Published occurrences'],['check','Completed',metrics?.completed,'All assigned staff completed'],['clock','In Progress',metrics?.inProgress,'Published duties underway'],['alert','Attention Required',metrics?.attention,'Duties with operational exceptions']];
  const row=view?.rows.find(r=>r.work.id===selected);
  return <div className="dashboard operational-monitoring"><MonitoringControls />
    {!alertsOnly&&<section className="stat-grid">{stats.map(([icon,label,value,detail])=><article className="stat-card" key={label}><i><Icon name={icon} size={30}/></i><h3>{label}</h3><strong>{ready&&value!==undefined?value:'—'}</strong><p>{detail}</p></article>)}</section>}
    <MonitoringState />
    {ready&&view&&<>
      <section className="content-grid"><article className="panel"><div className="panel-title"><h2>Operational Alerts</h2><Link href="/roster">Review roster ›</Link></div>{!view.exceptions.length?<p>No operational exceptions in this selection.</p>:view.exceptions.map(e=><button className={'monitoring-alert '+(e.critical?'critical':'')} key={e.id} onClick={()=>setSelected(e.workId)}><b>{e.title}{e.critical?' · Critical':''}</b><span>{e.details}</span></button>)}</article>
      {!alertsOnly&&<article className="panel"><div className="panel-title"><h2>Area Status</h2></div>{view.areas.length?view.areas.map(a=><div className="monitoring-area" key={a.id}><b>{a.name}</b><span>{a.duties} duties · {a.attention} need attention</span></div>):<p>No published work in this selection.</p>}</article>}</section>
      {!alertsOnly&&<section className="panel"><div className="panel-title"><h2>Activity · {filters.date}</h2></div><div style={{overflowX:'auto'}}><table><thead><tr><th>Duty</th><th>Time</th><th>Area</th><th>Staff</th><th>Status</th><th>Attention</th></tr></thead><tbody>{view.rows.map(r=><tr key={r.work.id}><td><button className="action-button" onClick={()=>setSelected(r.work.id)}>{r.work.title}</button></td><td>{r.work.startTime}–{r.work.endTime}</td><td>{r.area}</td><td>{r.progress.map(p=>p.displayName).join(', ')||'Unassigned'}</td><td>{r.status}</td><td>{r.exceptions.length?'Attention required':'—'}</td></tr>)}</tbody></table></div></section>}
      {row&&<DutyDetail row={row} close={()=>setSelected('')}/>}
      {alertsOnly&&<section className="panel"><div className="panel-title"><h2>Persistent notifications</h2></div>{state.source?.notifications.filter(n=>!n.weekStart||n.weekStart===weekForDate(filters.date)).map(n=><div className="monitoring-area" key={n.id}><b>{n.title}{n.isRead?'':' · Unread'}</b><span>{n.message}</span></div>)}</section>}
    </>}
  </div>;
}
export function OperationalHistory(){const {refresh}=useOperationalMonitoring();return <OperationalMonitoringProvider historical><HistoricalRoster onArchived={refresh}/></OperationalMonitoringProvider>;}
function HistoricalRoster({onArchived}:{onArchived:()=>void}){
  const {state,view,filters,refresh}=useOperationalMonitoring(),{user}=useAuth();
  const [search,setSearch]=useState(''),[selected,setSelected]=useState(''),[reason,setReason]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const owner=useRef(state.owner);owner.current=state.owner;
  const ready=state.status==='DATA'||state.status==='EMPTY',source=ready?state.source:undefined;
  const rows=view?.rows.filter(row=>`${row.work.title} ${row.work.description}`.toLowerCase().includes(search.trim().toLowerCase()))??[];
  const detail=rows.find(row=>row.work.id===selected);
  async function archive(){
    if(!user||!source?.version||source.archived||saving)return;
    const captured=state.owner;setSaving(true);setError('');
    try{await persistArchive(user,weekForDate(filters.date),source.version,reason);if(owner.current===captured){refresh();onArchived();}}
    catch(e){if(owner.current===captured)setError(e instanceof Error?e.message:'Archive failed.');}
    finally{if(owner.current===captured)setSaving(false);}
  }
  return <div className="operational-monitoring"><MonitoringControls/><MonitoringState/>{source&&<>
    <section className="panel"><h2>Historical published roster</h2><p>Week {weekForDate(filters.date)} · {source.archived?'Archived · Read-only':'Published · Read-only history'} · {source.version??'No publication'}</p>
      <label>Search duty<input aria-label="Search historical duties" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      {rows.length?<div style={{overflowX:'auto'}}><table><thead><tr><th>Duty</th><th>Date / time</th><th>Area</th><th>Staff</th><th>Status</th></tr></thead><tbody>{rows.map(row=><tr key={row.work.id}><td><button className="action-button" onClick={()=>setSelected(row.work.id)}>{row.work.title}</button></td><td>{row.work.date} · {row.work.startTime}–{row.work.endTime}</td><td>{row.area}</td><td>{row.progress.map(p=>p.displayName).join(', ')||'Unassigned'}</td><td>{row.status}</td></tr>)}</tbody></table></div>:<p>No historical duties match this selection.</p>}
      {source.version&&!source.archived&&<div><p>Archive removes this week from active views and permanently stops editing, republication and progress actions. The publication and existing progress remain readable.</p><label>Archive reason (optional)<input aria-label="Archive reason" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="action-button" disabled={saving} onClick={()=>void archive()}>{saving?'Archiving…':'Archive this roster'}</button></div>}
      {error&&<p role="alert">{error}</p>}
    </section>{detail&&<DutyDetail row={detail} close={()=>setSelected('')}/>}
    <section className="panel"><h2>Trusted operational history</h2><p>Latest 300 events for the selected week. Older immutable versions remain retained for authorized supervisor reads.</p>{source.events.length?<div style={{overflowX:'auto'}}><table><thead><tr><th>Occurred</th><th>Event</th><th>Actor</th><th>Work</th><th>Reason</th></tr></thead><tbody>{source.events.map(e=><tr key={e.id}><td>{new Date(e.occurredAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})}</td><td>{e.type}</td><td>{e.actor.displayName} · {e.actorProvenance}</td><td>{e.scheduledWorkId??e.weekStart}</td><td>{e.reason??'—'}</td></tr>)}</tbody></table></div>:<p>No recorded operational events for this week.</p>}</section>
  </>}</div>;
}
