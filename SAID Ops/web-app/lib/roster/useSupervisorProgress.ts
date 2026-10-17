'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { firestoreRosterEnabled } from './backend';
import { readSupervisorProgress, type ExecutionRead } from './progress';

export function useSupervisorProgress(week: string) {
  const {status, user, role} = useAuth();
  const owner = status === 'signedIn' && role?.name === 'Supervisor/Administrator' && user ? `${user.uid}:${week}` : '';
  const generation = useRef(0);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<Omit<ExecutionRead, 'status'> & {status: 'DATA' | 'EMPTY' | 'LOADING' | 'ERROR'; owner: string}>(
    {status: 'EMPTY', rows: [], owner: ''});
  useEffect(() => {
    const request = ++generation.current;
    if (!owner || !firestoreRosterEnabled) {setState({status: 'EMPTY', rows: [], owner}); return;}
    setState({status: 'LOADING', rows: [], owner});
    void readSupervisorProgress(week).then(result => {
      if (request === generation.current) setState({...result, owner});
    }).catch(() => {
      if (request === generation.current) setState({status: 'ERROR', rows: [], owner});
    });
    return () => {generation.current++;};
  }, [owner, week, reload]);
  return {state: state.owner === owner ? state : {status: 'LOADING' as const, rows: [], owner}, refresh: () => setReload(value => value + 1)};
}
