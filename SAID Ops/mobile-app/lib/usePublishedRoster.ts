import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeTaskProgress } from './taskProgress';
import { useAuth } from '../components/AuthProvider';
import { firestoreRosterEnabled, readCurrentPublication, type PublicationRead } from './publishedRoster';

export type PublicationState = {status:'LOADING'|'ERROR'|'EMPTY'|'DATA';tasks:PublicationRead['tasks'];version?:string;error?:string;owner:string;archived?:boolean};
export function usePublishedRoster(week:string,historical=false) {
  const {status,employee,user}=useAuth();
  const owner=status==='signedIn'&&employee&&user?`${user.uid}:${week}:${historical}`:'';
  const generation=useRef(0);
  const [state,setState]=useState<PublicationState>({status:'LOADING',tasks:[],owner:''});
  const [reload,setReload]=useState(0);
  const retry=useCallback(()=>setReload(value=>value+1),[]);
  useEffect(()=>{
    const request=++generation.current;
    if(!firestoreRosterEnabled||!owner){setState({status:'EMPTY',tasks:[],owner});return;}
    setState({status:'LOADING',tasks:[],owner});
    void readCurrentPublication(week,user!.uid,undefined,undefined,historical).then(async result=>({...result,tasks:await mergeTaskProgress(result.tasks,user!.uid)})).then(result=>{
      if(request===generation.current)setState({...result,owner});
    }).catch(()=>{
      if(request===generation.current)setState({status:'ERROR',tasks:[],owner,error:'Could not load the roster and task progress. Check your connection and refresh the roster.'});
    });
    return()=>{generation.current++;};
  },[owner,week,reload,historical]);
  return {state:state.owner===owner?state:{status:'LOADING' as const,tasks:[],owner},retry};
}
