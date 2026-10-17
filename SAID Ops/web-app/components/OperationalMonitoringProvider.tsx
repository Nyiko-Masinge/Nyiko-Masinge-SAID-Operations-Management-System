'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {useAuth} from './AuthProvider';
import {MonitoringContext,type MonitoringValue} from './MonitoringProvider';
import {readMonitoring} from '../lib/monitoring/read';
import {deriveMonitoring,facilityDate,weekForDate,type Filters,type MonitoringSources} from '../lib/monitoring/model';
import type {Alert} from '../data/monitoring/model';

type State={owner:string;status:'LOADING'|'ERROR'|'EMPTY'|'DATA';source?:MonitoringSources;refreshedAt?:string};
type OperationalValue={state:State;filters:Filters;setFilters:(value:Filters)=>void;refresh:()=>void;view?:ReturnType<typeof deriveMonitoring>};
const OperationalContext=createContext<OperationalValue|null>(null);
export function OperationalMonitoringProvider({children,historical=false}:{children:ReactNode;historical?:boolean}) {
  const {user,status,role}=useAuth();
  const [filters,setFilters]=useState<Filters>({date:facilityDate(),area:'',employee:'',status:''});
  const week=weekForDate(filters.date),owner=status==='signedIn'&&role?.name==='Supervisor/Administrator'&&user?`${user.uid}:${week}:${historical}`:'';
  const [reload,setReload]=useState(0),[state,setState]=useState<State>({owner:'',status:'LOADING'}),generation=useRef(0);
  useEffect(()=>{
    const request=++generation.current;setState({owner,status:'LOADING'});
    if(owner)void readMonitoring(week,historical).then(source=>{if(request===generation.current)setState({owner,status:source.items.length?'DATA':'EMPTY',source,refreshedAt:new Date().toISOString()});}).catch(()=>{if(request===generation.current)setState({owner,status:'ERROR'});});
    return()=>{generation.current++;};
  },[owner,week,reload,historical]);
  const visible=state.owner===owner&&owner?state:{owner,status:'LOADING' as const};
  let view:ReturnType<typeof deriveMonitoring>|undefined,failed=false;
  try{if(visible.source)view=deriveMonitoring(visible.source,filters);}catch{failed=true;}
  const finalState:State=failed?{owner,status:'ERROR'}:visible;
  const alerts:Alert[]=view?.exceptions.map(e=>({id:e.id,key:e.id,type:e.type,origin:'Detected',priority:e.critical?'High':'Medium',state:'Open',title:e.title,details:e.details,area:view!.rows.find(r=>r.work.id===e.workId)?.area??'',dutyId:e.workId,raisedAt:visible.refreshedAt??''}))??[];
  const reject=async():Promise<never>=>{throw new Error('Change the published roster or staff task progress to resolve this condition.');};
  const legacy:MonitoringValue={backend:'firestore',loading:finalState.status==='LOADING',historyLoading:finalState.status==='LOADING',error:finalState.status==='ERROR'?'Operational monitoring could not load all required sources. Refresh to retry.':null,dismissError:()=>{},alertsUnavailable:finalState.status==='ERROR',historyUnavailable:finalState.status==='ERROR',alerts,openAlerts:alerts,auditLogs:[],resolveAlerts:reject,recordAudit:reject,subscribeNotes:(_type,_id,_cb,error)=>{error?.(new Error('Operational notes are deferred.'));return()=>{};},addNote:reject};
  return <MonitoringContext.Provider value={legacy}><OperationalContext.Provider value={{state:finalState,filters,setFilters,refresh:()=>setReload(n=>n+1),view:failed?undefined:view}}>{children}</OperationalContext.Provider></MonitoringContext.Provider>;
}
export function useOperationalMonitoring(){const value=useContext(OperationalContext);if(!value)throw new Error('Operational monitoring provider is required.');return value;}
