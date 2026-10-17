import { useCallback, useEffect, useState } from 'react';
import { mockWeekStarts } from './mock';
import { validWeek } from './week';
import { currentWeek, readWeekPreference, saveWeekPreference } from './weekPreference';

export function useRosterWeekPreference(uid: string | undefined, integrated: boolean) {
  const fallback = integrated ? currentWeek() : mockWeekStarts[0];
  // Read after mount so server markup and the first browser render agree.
  const [selection,setSelection] = useState({owner:'',week:fallback});
  useEffect(()=>{
    if(!integrated)return;
    let week=currentWeek();
    try { if(uid)week=readWeekPreference(uid,window.localStorage,week); } catch { /* Storage may be disabled. */ }
    setSelection({owner:uid??'',week});
  },[uid,integrated]);
  const ready=!integrated||Boolean(uid&&selection.owner===uid);
  const week=ready?selection.week:fallback;
  const setWeek=useCallback((value:string)=>{
    if(!validWeek(value)||(integrated&&!uid))return;
    setSelection({owner:uid??'',week:value});
    if(integrated&&uid){try{saveWeekPreference(uid,value,window.localStorage);}catch{/* Keep in-session selection. */}}
  },[uid,integrated]);
  return {week,setWeek,ready};
}
