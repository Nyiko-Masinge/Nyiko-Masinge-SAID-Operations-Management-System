'use client';
import { useEffect, useRef, useState } from 'react';
import { addDays, dateLabel, datesForWeek, weekStartFor } from '../lib/roster/mock';
import { useRosterWeekPreference } from '../lib/roster/useRosterWeekPreference';
import { useAuth } from './AuthProvider';
import { getCoverage, isUncoveredCritical, hasSchedulingConflict, scheduledOnDate } from '../lib/roster/rules';
import { useModalFocus } from './useModalFocus';
import { weekSummary } from '../lib/roster/summary';
import { selectPrintableWeek } from '../lib/roster/print';
import type { PublicationCounts, PublicationResult, RosterActionResult, RosterGenerationResult, ScheduleInput, ScheduledWork } from '../lib/roster/types';
import { Icon, type IconName } from './Icons';
import { useOps } from './OpsProvider';
import { RosterEditor } from './RosterEditor';

const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };

function Pill({ children, tone = 'green' }: { children: React.ReactNode; tone?: string }) {
  return <span className={'pill ' + tone}>{children}</span>;
}

function Action({ icon, children, onClick, primary = false, disabled = false }: { icon: IconName; children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return <button disabled={disabled} className={'action-button ' + (primary ? 'primary' : '')} onClick={onClick}><Icon name={icon}/>{children}</button>;
}

function stateFor(work: ScheduledWork, all: readonly ScheduledWork[]): { text: string; tone: string } {
  if (hasSchedulingConflict(work, all)) return { text: 'Conflict', tone: 'conflict' };
  const coverage = getCoverage(work);
  if (coverage.uncovered) return { text: 'Unassigned', tone: 'unassigned' };
  if (coverage.understaffed) return { text: 'Understaffed', tone: 'unassigned' };
  return { text: 'Assigned', tone: 'assigned' };
}

function failureMessage(result: RosterActionResult, work: readonly ScheduledWork[]): string {
  if (result.ok) return '';
  switch (result.code) {
    case 'ARCHIVED': return 'Archived rosters are read-only. Open History to review them.';
    case 'DUPLICATE': return 'This staff member is already assigned to the selected duty.';
    case 'OVERLAP': {
      const other = work.find(item => item.id === result.conflictingWorkId);
      return `Scheduling conflict with ${other?.title ?? 'another duty'} at the selected time.`;
    }
    case 'UNAVAILABLE': return 'This staff member is unavailable and cannot be assigned.';
    case 'INACTIVE': return 'This staff member is inactive. Assign an active employee.';
    case 'STAFF_NOT_FOUND': return 'Staff member not found.';
    case 'WORK_NOT_FOUND': return 'Scheduled duty not found.';
    case 'ASSIGNMENT_NOT_FOUND': return 'That staff member is not assigned to this duty.';
    case 'INVALID_ID': return 'The roster item needs a valid ID.';
    case 'DUPLICATE_WORK_ID': return 'A roster item with this ID already exists.';
    case 'TITLE_REQUIRED': return 'Enter a work title.';
    case 'INVALID_DATE': return 'Enter a valid roster date.';
    case 'INVALID_INTERVAL': return 'End time must be after a valid start time.';
    case 'INVALID_REQUIRED': return 'Required staff must be a whole number from 1 to 100.';
    case 'AREA_REQUIRED': return 'Select an operational area.';
    case 'TEMPLATE_NOT_FOUND': return 'The selected task template no longer exists.';
    case 'TEMPLATE_INACTIVE': return 'Select an active task template.';
    case 'TEMPLATE_CHANGE_NOT_ALLOWED': return 'The source task template cannot be changed on an existing roster item.';
  }
}

export function RosterScreen() {
  const { staff, duties, scheduledWork, locations, allLocations, locationName, locationsLoading, locationsError, refreshLocations, templatesLoading, templatesError, refreshTemplates, workforceLoading, workforceError, refreshWorkforce, integratedRoster, loadRosterWeek, rosterReadState, createScheduled, editScheduled, removeScheduled, assignScheduled, unassignScheduled, reassignScheduled, copyRoster, generateDuties, publishWeek, publishToStaff, rosterLifecycle } = useOps();
  const {user}=useAuth();
  const {week:weekStart,setWeek:setWeekStart,ready:weekReady}=useRosterWeekPreference(user?.uid,integratedRoster);
  const [day, setDay] = useState(()=>integratedRoster?weekStart:'2026-10-23');
  const [area, setArea] = useState('All Areas');
  const [selected, setSelected] = useState<string>();
  const [replacing, setReplacing] = useState<string>();
  const [editor, setEditor] = useState<{ kind: 'create' } | { kind: 'edit'; id: string }>();
  const [removeId, setRemoveId] = useState<string>();
  const [notice, updateNotice] = useState({ text: '', error: false });
  const setNotice = (text: string, error = false) => updateNotice({ text, error });
  const [assignmentFeedback, setAssignmentFeedback] = useState<{ kind: 'success' | 'error'; message: string }>();
  const [staffQuery, setStaffQuery] = useState('');
  const [publishReview, setPublishReview] = useState<PublicationCounts>();
  const publishing = useRef(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const copying=useRef(false);
  const screenSession=useRef(0);
  useEffect(()=>{screenSession.current++;return()=>{screenSession.current++;};},[weekStart,user?.uid]);
  const confirmRef = useRef<HTMLElement>(null);
  useModalFocus(confirmRef, Boolean(removeId || publishReview), () => { setRemoveId(undefined); setPublishReview(undefined); });
  const lifecycle = rosterLifecycle(weekStart);
  const restoration=integratedRoster?rosterReadState(weekStart):{status:'EMPTY' as const};
  const rosterReady=!integratedRoster||(weekReady&&!restoration.archived&&!templatesLoading&&!templatesError&&!workforceLoading&&!workforceError&&!locationsLoading&&!locationsError&&['EMPTY','DATA'].includes(restoration.status));
  useEffect(()=>{
    if(integratedRoster&&weekReady&&!templatesLoading&&!templatesError&&!workforceLoading&&!workforceError&&!locationsLoading&&!locationsError)void loadRosterWeek(weekStart);
  },[integratedRoster,weekReady,weekStart,loadRosterWeek,templatesLoading,templatesError,workforceLoading,workforceError,locationsLoading,locationsError]);
  useEffect(()=>{
    if(!datesForWeek(weekStart).includes(day))setDay(weekStart);
    setSelected(undefined);setReplacing(undefined);setAssignmentFeedback(undefined);
    setEditor(undefined);setRemoveId(undefined);setPublishReview(undefined);setNotice('');
  },[weekStart,user?.uid]);
  const days = datesForWeek(weekStart);
  const weekly = weekSummary(weekStart, scheduledWork);
  const displayArea = (work: ScheduledWork) => work.locationId ? locationName(work.locationId) : work.area;
  const rosterAreas = ['All Areas', ...new Set(allLocations.map(location => location.name))];
  const printDays = selectPrintableWeek(weekStart, area, scheduledWork.map(work => ({ ...work, area: displayArea(work) })));
  const printableCount = printDays.reduce((total, item) => total + item.work.length, 0);
  const rosterStatus = lifecycle.status === 'Draft' ? 'Draft' : lifecycle.hasUnpublishedChanges ? 'Published - Unpublished changes' : 'Published';
  const filteredStaff = staff.filter(person => `${person.name} ${person.role} ${locationName(person.locationId)}`.toLowerCase().includes(staffQuery.trim().toLowerCase()));
  const dayWork = scheduledOnDate(scheduledWork, day);
  const visible = dayWork.filter(work => area === 'All Areas' || displayArea(work) === area);
  const uncovered = visible.filter(work => getCoverage(work).uncovered);
  const needsCoverage = visible.filter(work => getCoverage(work).uncovered || isUncoveredCritical(work));
  const fullyAssigned = visible.filter(work => getCoverage(work).fullyStaffed).length;
  const conflicts = visible.filter(work => hasSchedulingConflict(work, scheduledWork)).length;
  const minutes = visible.reduce((total, work) => {
    const [startHour, startMinute] = work.startTime.split(':').map(Number);
    const [endHour, endMinute] = work.endTime.split(':').map(Number);
    return total + (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  }, 0);
  const chosen = dayWork.find(work => work.id === selected);
  const removal = scheduledWork.find(work => work.id === removeId);
  const editorWork = editor?.kind === 'edit' ? scheduledWork.find(work => work.id === editor.id) : undefined;

  function changeWeek(offset: number) {
    const next = addDays(weekStart, offset * 7);
    setWeekStart(next);
    setDay(next);
    setSelected(undefined);
    setReplacing(undefined);
    setNotice('');
    setAssignmentFeedback(undefined);
  }

  // Code Attribution — Aaryan Makan (ST10259834), weekly roster printing.
  // This method follows the browser print-dialog API for the current document.
  // MDN contributors (n.d.) 'Window: print() method'.
  // https://developer.mozilla.org/en-US/docs/Web/API/Window/print
  // Accessed: 5 October 2026.
  function printRoster() {
    if (printableCount === 0) {
      setNotice('No roster items are available to print for the selected week and area.', true);
      return;
    }
    window.print();
  }

  async function doPublish(confirmCoverage = false) {
    if (publishing.current) return;
    publishing.current = true; setPublishBusy(true);
    try {
      const result: PublicationResult = integratedRoster ? await publishToStaff(weekStart, confirmCoverage) : publishWeek(weekStart, confirmCoverage);
      if (result.status === 'confirmation_required') {
        setPublishReview(result);
        return;
      }
      setPublishReview(undefined);
      if (result.status === 'published') {
        setNotice(`${result.republished ? 'Updated roster' : 'Roster'} ${integratedRoster ? 'published to staff' : 'published locally for this session'}: ${result.itemCount} duties. ${result.uncoveredCount} unassigned; ${result.understaffedCount} understaffed. ${result.uncoveredCriticalCount} uncovered critical duties. ${result.warnings?.join(' ') ?? ''}`);
        return;
      }
      switch (result.code) {
        case 'INVALID_WEEK': setNotice('Select a valid roster week before publishing.', true); break;
        case 'DUPLICATE_WORK_ID': setNotice(`Roster item ${result.workId} has a duplicate ID. Resolve it before publishing.`, true); break;
        case 'INVALID_WORK': setNotice(`Roster item ${result.workId} is invalid: ${result.validationCode ? failureMessage({ ok: false, code: result.validationCode }, scheduledWork) : 'Review its details.'}`, true); break;
        case 'SCHEDULING_CONFLICT': {
          const pair = result.conflict;
          const names = pair?.staffIds.map(id => staff.find(person => person.id === id)?.name ?? id).join(', ');
          setNotice(pair ? `Publication blocked: ${names} assigned to ${pair.first.title} (${pair.first.startTime}–${pair.first.endTime}) and ${pair.second.title} (${pair.second.startTime}–${pair.second.endTime}) on ${dateLabel(pair.first.date, dateOptions)}. ${result.conflictCount} affected roster items.` : 'Publication blocked by a scheduling conflict. Review this week.', true);
          break;
        }
      }
    } catch (error) {
      setPublishReview(undefined);
      setNotice(error instanceof Error ? error.message : 'Publication failed. Retry before claiming the roster was published.', true);
    } finally { publishing.current = false; setPublishBusy(false); }
  }

  function generationNotice(kind: 'copy' | 'recurring', result: RosterGenerationResult): string {
    if (!result.ok) return failureMessage(result, scheduledWork);
    const label = kind === 'copy' ? 'roster items copied' : 'duties generated';
    const parts = [`${result.created} ${label}`, `${result.skippedDuplicates} existing duties skipped`];
    if (result.unsupported.length) {
      const details = result.unsupported.map(item => `${duties.find(duty => duty.id === item.templateId)?.name ?? item.templateId} (${item.recurrence})`).join(', ');
      parts.push(`${result.unsupported.length} template(s) use an unsupported recurrence pattern: ${details}`);
    }
    if (result.invalid.length) {
      const details = result.invalid.map(item => `${duties.find(duty => duty.id === item.sourceId)?.name ?? scheduledWork.find(work => work.id === item.sourceId)?.title ?? 'Roster item'}: ${failureMessage({ ok: false, code: item.code }, scheduledWork)}`).join(', ');
      parts.push(`${result.invalid.length} invalid item(s) skipped: ${details}`);
    }
    if (result.created === 0 && result.sourceCount === 0) {
      return kind === 'copy' ? 'No roster items exist in the previous week to copy.' : 'No active task templates are available to generate.';
    }
    return `${parts.join('; ')}.`;
  }

  function reportGeneration(kind: 'copy' | 'recurring', result: RosterGenerationResult) {
    setNotice(generationNotice(kind, result), !result.ok || result.invalid.length > 0 || result.unsupported.length > 0);
  }
  async function copyPrevious() {
    if(copying.current)return;
    copying.current=true;setCopyBusy(true);
    const session=screenSession.current;
    try{
      const result=await copyRoster(weekStart);
      if(session===screenSession.current)setNotice(`${generationNotice('copy',result)} Existing target work was kept. Copied assignments will be checked again when publishing.`,!result.ok||(result.ok&&result.invalid.length>0));
    }catch(error){if(session===screenSession.current)setNotice(error instanceof Error?error.message:'Could not copy the previous roster. Your edits were kept.',true);}
    finally{copying.current=false;setCopyBusy(false);}
  }

  function selectWork(id: string) {
    setSelected(id);
    setReplacing(undefined);
    setAssignmentFeedback(undefined);
  }

  function doAssign(staffId: string) {
    setNotice('');
    if (!chosen) { setAssignmentFeedback({ kind: 'error', message: 'Select a scheduled duty first.' }); return; }
    const result = replacing
      ? reassignScheduled(chosen.id, replacing, staffId)
      : assignScheduled(chosen.id, staffId);
    const person = staff.find(item => item.id === staffId);
    if (result.ok) {
      setAssignmentFeedback({ kind: 'success', message: `${person?.name ?? 'Staff member'} ${replacing ? 'reassigned' : 'assigned'} to ${chosen.title}.` });
    } else {
      let message: string;
      switch (result.code) {
        case 'DUPLICATE': message = `${person?.name ?? 'This staff member'} is already assigned to ${chosen.title}.`; break;
        case 'UNAVAILABLE': message = person?.availability === 'On Leave'
          ? `${person.name} is currently on leave and cannot be assigned to ${chosen.title}.`
          : `${person?.name ?? 'This staff member'} is currently unavailable and cannot be assigned to ${chosen.title}.`; break;
        case 'OVERLAP': message = `${person?.name ?? 'This staff member'} cannot be assigned to ${chosen.title} because it overlaps another assignment.`; break;
        default: message = failureMessage(result, scheduledWork);
      }
      setAssignmentFeedback({ kind: 'error', message });
    }
    if (result.ok) setReplacing(undefined);
  }

  function doUnassign(staffId: string) {
    if (!chosen) { setNotice('Select a scheduled duty first.', true); return; }
    setAssignmentFeedback(undefined);
    const result = unassignScheduled(chosen.id, staffId);
    setNotice(result.ok ? 'Staff member unassigned.' : failureMessage(result, scheduledWork), !result.ok);
    if (result.ok && replacing === staffId) setReplacing(undefined);
  }

  function saveSchedule(input: ScheduleInput): string | undefined {
    if (!editor) return 'Open the roster form again.';
    const result = editor.kind === 'create'
      ? createScheduled(input)
      : editScheduled(editor.id, input);
    if (!result.ok) return failureMessage(result, scheduledWork);
    setEditor(undefined);
    setWeekStart(weekStartFor(input.date));
    setDay(input.date);
    setArea('All Areas');
    setSelected(editor.kind === 'edit' ? editor.id : undefined);
    setReplacing(undefined);
    setNotice(editor.kind === 'create' ? 'Roster item added.' : 'Roster item updated.');
    return undefined;
  }

  function confirmRemove() {
    if (!removeId) return;
    const result = removeScheduled(removeId);
    setNotice(result.ok ? 'Roster item removed.' : failureMessage(result, scheduledWork), !result.ok);
    if (result.ok && selected === removeId) { setSelected(undefined); setReplacing(undefined); }
    setRemoveId(undefined);
  }

  const summary: [string, string, IconName][] = [
    ['Total Duties', String(visible.length), 'users'],
    ['Assigned', String(fullyAssigned), 'check'],
    ['Uncovered', String(uncovered.length), 'userPlus'],
    ['Conflicts', String(conflicts), 'alert'],
    ['Est. Total Hours', `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`, 'clock'],
  ];
  return <div className="management roster">
    {restoration.archived&&<p role="status">This roster is archived and read-only. Open <a href="/history">History</a> to review its published duties and saved progress.</p>}
    <div className="toolbar">
      <div className="week-nav">
        <button disabled={!weekReady||publishBusy} aria-label="Previous week" onClick={() => changeWeek(-1)}><Icon name="chevronLeft"/></button>
        <b>{dateLabel(days[0], { day: 'numeric', month: 'short', year: 'numeric' })} – {dateLabel(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}</b>
        <button disabled={!weekReady||publishBusy} aria-label="Next week" onClick={() => changeWeek(1)}><Icon name="chevronRight"/></button>
      </div>
      <select aria-label="Filter by area" value={area} onChange={event => { setArea(event.target.value); setNotice(''); }}>{rosterAreas.map(value => <option key={value}>{value}</option>)}</select>
      <Action disabled={!rosterReady||copyBusy||publishBusy} icon="copy" onClick={() => void copyPrevious()}>{copyBusy?'Loading Previous Roster…':'Copy Previous Roster'}</Action>
      <Action disabled={!rosterReady} icon="repeat" onClick={() => reportGeneration('recurring', generateDuties(weekStart))}>Generate Recurring Duties</Action>
      <Action disabled={!rosterReady} icon="print" onClick={printRoster}>Print Roster</Action>
      <Action disabled={!rosterReady} icon="plus" onClick={() => setEditor({ kind: 'create' })}>Add Roster Item</Action>
      <Action disabled={!rosterReady||publishBusy} icon="publish" primary onClick={() => { void doPublish(); }}>{publishBusy ? 'Publishing…' : 'Publish Roster'}</Action>
    </div>
    {templatesLoading && <p role="status">Loading duty templates…</p>}{templatesError && <p role="alert">{templatesError} <button onClick={()=>void refreshTemplates()}>Retry templates</button></p>}{workforceLoading && <p role="status">Loading provisioned workforce…</p>}
    {workforceError && <p role="alert">{workforceError} <button onClick={()=>{void refreshWorkforce();}}>Retry workforce</button></p>}
    {locationsError && <div className="notice error" role="alert">{locationsError}<button className="action-button" onClick={refreshLocations}>Retry</button></div>}
    {integratedRoster&&!rosterReady&&!restoration.archived&&!workforceError&&!locationsError&&restoration.status!=='ERROR'&&<p role="status">Loading selected roster…</p>}
    {integratedRoster&&restoration.status==='ERROR'&&<p role="alert">{restoration.error} <button onClick={()=>{void loadRosterWeek(weekStart);}}>Retry roster</button></p>}
    {rosterReady&&<div className="notice">Roster status: <b>{rosterStatus}</b></div>}
    {rosterReady&&staff.some(person=>person.publicationFallback&&scheduledWork.some(work=>datesForWeek(weekStart).includes(work.date)&&work.staffIds.includes(person.id)))&&<p role="alert">Some published assignments could not be matched to the current workforce. Their Employee IDs and UIDs remain visible. Review these identities before changing assignments or republishing.</p>}
    {notice.text && <div className="notice" role={notice.error ? "alert" : "status"}>{notice.text}</div>}
    {rosterReady&&<><section className="weekly-review" aria-label="Whole-week roster review"><h2>Whole-week review</h2>
      <div className="weekly-totals"><span>Duties <b>{weekly.itemCount}</b></span><span>Fully staffed <b>{weekly.fullyStaffedCount}</b></span><span>Unassigned <b>{weekly.uncoveredCount}</b></span><span>Understaffed <b>{weekly.understaffedCount}</b></span><span>Uncovered critical <b>{weekly.uncoveredCriticalCount}</b></span><span>Conflicts <b>{weekly.conflictCount}</b></span><span>Positions filled <b>{weekly.filledPositions}/{weekly.requiredPositions}</b></span></div>
      <div className="weekly-days">{weekly.days.map(item => <button key={item.date} className={day===item.date?'active':''} onClick={()=>{setDay(item.date);setSelected(undefined);setReplacing(undefined);setAssignmentFeedback(undefined)}}><b>{dateLabel(item.date,dateOptions)}</b><small>{item.itemCount} duties · {item.uncoveredCount} unassigned · {item.understaffedCount} understaffed · {item.conflictCount} conflicts</small></button>)}</div>
    </section>
    <div className="day-tabs">{days.map(date => <button key={date} className={date === day ? 'active' : ''} onClick={() => { setDay(date); setSelected(undefined); setReplacing(undefined); setAssignmentFeedback(undefined); }}>{dateLabel(date, dateOptions)}</button>)}</div>
    <div className="roster-layout"><section className="roster-main">
      <div className="summary-grid">{summary.map(([label, value, icon]) => <div className="mini-stat" key={label}><Icon name={icon}/><span>{label}<b>{value}</b></span></div>)}</div>
      <div className="table-wrap"><table><thead><tr><th>Time</th><th>Duty / Task</th><th>Area</th><th>Required</th><th>Assigned Staff</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {visible.map(work => {
          const duty = duties.find(item => item.id === work.dutyId);
          const names = work.staffIds.map(id => staff.find(person => person.id === id)?.name).filter(Boolean).join(', ');
          const state = stateFor(work, scheduledWork);
          const coverage = getCoverage(work);
          return <tr tabIndex={0} aria-selected={selected === work.id} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectWork(work.id); } }} className={selected === work.id ? 'selected' : ''} key={work.id} onClick={() => selectWork(work.id)}>
            <td>{work.startTime}</td><td><b>{work.title}</b>{work.isCritical && <Pill tone="high">Critical</Pill>}<small>{work.dutyId ? duty?.recurrence ?? 'Template' : 'Ad-hoc'} · {work.startTime}–{work.endTime}{work.priority ? ` · ${work.priority} priority` : ''}</small></td>
            <td>{displayArea(work)}</td><td>{work.required}</td><td>{names || <span className="danger-text">Unassigned</span>}{coverage.remaining > 0 && <small>{coverage.remaining} more needed</small>}</td>
            <td><Pill tone={state.tone}>{state.text}</Pill></td>
            <td><button className="icon-button" aria-label={`Edit ${work.title}`} onClick={event => { event.stopPropagation(); setEditor({ kind: 'edit', id: work.id }); }}><Icon name="edit"/></button><button className="icon-button" aria-label={`Remove ${work.title}`} onClick={event => { event.stopPropagation(); setRemoveId(work.id); }}><Icon name="x"/></button></td>
          </tr>;
        })}
      </tbody></table></div>
      <div className="legend"><Pill tone="assigned">Fully Staffed</Pill><Pill tone="unassigned">Unassigned</Pill><Pill tone="unassigned">Understaffed</Pill><Pill tone="conflict">Conflict</Pill></div>
    </section><aside className="side-panels">
      <section className="panel"><h3>Uncovered Duties ({needsCoverage.length})</h3>{needsCoverage.map(work => {
        return <button className={'assign-card ' + (selected === work.id ? 'selected' : '')} onClick={() => selectWork(work.id)} key={work.id}><Icon name="alert"/><span><b>{work.title}</b>{isUncoveredCritical(work) && <Pill tone="high">Critical</Pill>}<small>{work.startTime} · {displayArea(work)} · {getCoverage(work).remaining} needed</small></span>Assign</button>;
      })}</section>
      {chosen && <section className="panel"><h3>Assigned Staff · {chosen.title}</h3>
        {chosen.staffIds.length === 0 && <p>No staff assigned.</p>}
        {chosen.staffIds.map(id => {
          const person = staff.find(item => item.id === id);
          return <div className="pool-row" key={id}><span><b>{person?.name ?? id}</b><small>{person?.role ?? 'Staff member'}</small></span><div>
            <button aria-label={`Unassign ${person?.name ?? id}`} onClick={() => doUnassign(id)}>Unassign</button>
            <button aria-label={`Reassign ${person?.name ?? id}`} onClick={() => setReplacing(id)}>Reassign</button>
          </div></div>;
        })}
        {replacing && <p>Select a replacement for {staff.find(item => item.id === replacing)?.name ?? replacing} from the Staff Pool.</p>}
      </section>}
      <section className="panel"><h3>Staff Pool</h3>{assignmentFeedback&&<p className={`assignment-feedback ${assignmentFeedback.kind}`} role={assignmentFeedback.kind==='error'?'alert':'status'}>{assignmentFeedback.message}</p>}<label className="search-label" htmlFor="roster-staff-search">Search staff</label><input id="roster-staff-search" className="search" placeholder="Search by name or role..." value={staffQuery} onChange={event=>setStaffQuery(event.target.value)}/>{filteredStaff.length===0&&<p role="status">No staff match your search.</p>}{filteredStaff.map(person => <div className="pool-row" key={person.id}><span><b>{person.name}</b><small>{person.role} · {person.availability}</small></span><button aria-label={`${replacing ? 'Replace with' : 'Assign'} ${person.name}`} onClick={() => doAssign(person.id)}><Icon name="userPlus"/>{replacing ? 'Replace' : 'Assign'}</button></div>)}</section>
    </aside></div>
    <section className="print-roster" aria-label="Printable weekly roster">
      <div className="print-heading">
        <div><strong>SAID Ops</strong><h1>Weekly Roster</h1></div>
        <p>{dateLabel(days[0], { day: 'numeric', month: 'long', year: 'numeric' })} – {dateLabel(days[6], { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <div className="print-meta"><span>Roster state: <strong>{rosterStatus}</strong></span><span>Area: <strong>{area}</strong></span></div>
        {lifecycle.hasUnpublishedChanges && <p className="print-warning">This roster contains changes made after the last publication.</p>}
      </div>
      {printDays.map(({ date, work }) => <section className="print-day" key={date}>
        <h2>{dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
        {work.length === 0 ? <p className="print-empty-day">No scheduled duties</p> :
          <table><thead><tr><th>Time</th><th>Duty / Task</th><th>Operational Area</th><th>Required Staff</th><th>Assigned Staff</th><th>Staffing / Status</th></tr></thead><tbody>
            {work.map(item => {
              const coverage = getCoverage(item);
              const staffing = coverage.uncovered ? 'Unassigned' : coverage.understaffed ? 'Understaffed' : 'Fully staffed';
              const names = item.staffIds.map(id => staff.find(person => person.id === id)?.name ?? id).join(', ');
              return <tr key={item.id}><td>{item.startTime}–{item.endTime}</td><td>{item.title}</td><td>{item.area}</td><td>{item.required}</td><td>{names || '—'}</td><td>{staffing}{hasSchedulingConflict(item, scheduledWork) ? ' · Conflict' : ''}</td></tr>;
            })}
          </tbody></table>}
      </section>)}
    </section>
    </>}
    {rosterReady&&editor && <RosterEditor key={editor.kind === 'edit' ? editor.id : `create-${day}`} date={day} templates={duties} locations={locations} allLocations={allLocations} work={editorWork} onSave={saveSchedule} onClose={() => setEditor(undefined)}/>}
    {removal && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Confirm roster removal" tabIndex={-1} ref={confirmRef}>
      <h2>Remove Roster Item?</h2>
      <p>Remove {removal.title} on {dateLabel(removal.date, { day: 'numeric', month: 'short', year: 'numeric' })} and its {removal.staffIds.length} staff assignment(s)? {removal.dutyId ? 'The task template remains available.' : 'Other roster items are unaffected.'}</p>
      <button className="action-button primary" onClick={confirmRemove}>Remove Item</button>
      <button className="action-button" onClick={() => setRemoveId(undefined)}>Cancel</button>
    </section></div>}
    {publishReview && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Confirm roster publication" tabIndex={-1} ref={confirmRef}>
      <h2>Publish Roster?</h2>
      <p>{publishReview.uncoveredCount} duties are unassigned and {publishReview.understaffedCount} are understaffed in this week. Publish these {publishReview.itemCount} duties anyway?</p>
      {publishReview.uncoveredCriticalCount > 0 && <p className="danger-text"><b>{publishReview.uncoveredCriticalCount} critical duties remain uncovered (unassigned or understaffed).</b></p>}
      {publishReview.coverageIssues?.map(issue=><p key={issue.workId} className={issue.isCritical?'danger-text':''}>{issue.title}{issue.isCritical?' (Critical)':''}: {issue.assigned}/{issue.required} staff{issue.missingSkills.length?`; missing skills: ${issue.missingSkills.join(', ')}`:''}.</p>)}
      <button className="action-button primary" onClick={() => doPublish(true)}>Publish Anyway</button>
      <button className="action-button" onClick={() => setPublishReview(undefined)}>Cancel</button>
    </section></div>}
  </div>;
}
