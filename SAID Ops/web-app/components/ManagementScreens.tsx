'use client';
import { FormEvent, useRef, useState } from 'react';
import { useModalFocus } from './useModalFocus';
import type { TemplateResult } from '../lib/roster/templates';
import { availabilityStates, type Availability } from '../lib/planning/model';
import { recurrenceOptions } from '../lib/roster/generation';
import { Duty, Staff, useOps } from './OpsProvider';
import { Icon, IconName } from './Icons';
import type { Location } from '../lib/locations';
const Button = ({ icon, children, onClick, primary = false, disabled = false }: {
    icon: IconName;
    children: React.ReactNode;
    onClick?: () => void;
    primary?: boolean;
    disabled?: boolean;
}) => <button className={'action-button ' + (primary ? 'primary' : '')} onClick={onClick} disabled={disabled}><Icon name={icon}/>{children}</button>;
const Pill = ({ children, tone = 'green' }: {
    children: React.ReactNode;
    tone?: string;
}) => <span className={'pill ' + tone}>{children}</span>;
function Notice({ text, error = false }: {
    text: string;
    error?: boolean;
}) { return text ? <div className="notice" role={error ? "alert" : "status"}>{text}</div> : null; }
function Modal({ title, children, onClose, containFocus = true }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    containFocus?: boolean;
}) { const ref = useRef<HTMLElement>(null); useModalFocus(ref, true, onClose, containFocus); return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}><button className="close" aria-label={`Close ${title}`} onClick={onClose}><Icon name="x"/></button><h2>{title}</h2>{children}</section></div>; }
function templateMessage(result: TemplateResult): string { if (result.ok)
    return ''; if (result.code === 'SAVE_FAILED')
    return result.message ?? 'Template save failed. Reload and retry.'; const messages: Record<Exclude<TemplateResult, {
    ok: true;
}>['code'], string> = { INVALID_ID: 'Task template not found.', DUPLICATE_ID: 'A task template with this ID already exists.', NAME_REQUIRED: 'Enter a duty name.', AREA_REQUIRED: 'Select an area.', INVALID_TIME: 'Enter a valid default time.', INVALID_DURATION: 'Enter a positive duration in minutes that ends before midnight.', INVALID_REQUIRED: 'Required staff must be at least one.', UNSUPPORTED_RECURRENCE: 'Unsupported recurrence. Select Daily, Mon, Wed, Fri, or Tue, Thu.', INVALID_PRIORITY: 'Select a valid priority.', INVALID_STATUS: 'Select a valid status.', INVALID_CRITICAL: 'Choose whether this is a critical duty.', SAVE_FAILED: 'Template save failed.' }; return messages[result.code]; }
function LocationSelect({ value, onChange, locations, includeAll = false, label }: {
    value: string;
    onChange: (v: string) => void;
    locations: Location[];
    includeAll?: boolean;
    label?: string;
}) { const { locationName } = useOps(); return <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{includeAll ? <option value="">All Areas</option> : <option value="" disabled>Select a location</option>}{value && !locations.some(l => l.id === value) && <option disabled value={value}>{locationName(value)} (unavailable for new assignments)</option>}{locations.length === 0 && <option disabled value="">No locations yet</option>}{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>; }
function LocationsErrorBanner({ error, onRetry }: {
    error: string | null;
    onRetry: () => void;
}) { return error ? <div className="notice error"><Icon name="alert"/>{error}<button className="action-button" onClick={onRetry}>Retry</button></div> : null; }
function Select({ value, onChange, options, label }: {
    value: string;
    onChange: (v: string) => void;
    options: readonly string[];
    label?: string;
}) { return <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{options.map(x => <option key={x}>{x}</option>)}</select>; }
export { RosterScreen } from './RosterScreen';
export function DutyForm({ duty, locations, onSave }: {
    duty?: Duty;
    locations: Location[];
    onSave: (v: Omit<Duty, 'id'>) => TemplateResult | Promise<TemplateResult>;
}) { const [d, setD] = useState<Omit<Duty, 'id'>>(duty ?? { name: '', description: '', area: locations[0]?.name ?? '', locationId: locations[0]?.id ?? '', time: '08:00', duration: '60 min', required: 1, recurrence: 'Daily', priority: 'Medium', isCritical: false, status: 'Active', requiredSkills: [], requirements: ['Area prepared and checked'] }); const [error, setError] = useState(''), [saving, setSaving] = useState(false), [skills, setSkills] = useState((d.requiredSkills ?? []).join(', ')), [checklist, setChecklist] = useState(d.requirements.join(', ')); const lock = useRef(false); return <form className="form-grid" onSubmit={async (e: FormEvent) => { e.preventDefault(); if (lock.current)
    return; lock.current = true; setSaving(true); setError(''); try {
    setError(templateMessage(await onSave({ ...d, requiredSkills: labels(skills), requirements: labels(checklist) })));
}
catch (error) {
    setError(error instanceof Error ? error.message : 'Template save failed.');
}
finally {
    lock.current = false;
    setSaving(false);
} }}><label>Duty name<input required value={d.name} onChange={e => setD({ ...d, name: e.target.value })}/></label><label>Description<input value={d.description} onChange={e => setD({ ...d, description: e.target.value })}/></label><label>Location<LocationSelect value={d.locationId ?? ''} onChange={locationId => setD({ ...d, locationId, area: locations.find(location => location.id === locationId)?.name ?? '' })} locations={locations}/></label><label>Default time<input value={d.time} onChange={e => setD({ ...d, time: e.target.value })}/></label><label>Duration<input value={d.duration} onChange={e => setD({ ...d, duration: e.target.value })}/></label><label>Required staff<input type="number" min="1" value={d.required} onChange={e => setD({ ...d, required: +e.target.value })}/></label><label>Recurrence<select value={d.recurrence} onChange={e => setD({ ...d, recurrence: e.target.value })}>{recurrenceOptions.map(value => <option key={value}>{value}</option>)}</select></label><label>Priority<Select value={d.priority} onChange={priority => setD({ ...d, priority: priority as Duty['priority'] })} options={['High', 'Medium', 'Low']}/></label><div className="critical-field"><label className="critical-control"><input name="isCritical" type="checkbox" checked={d.isCritical} onChange={e => setD({ ...d, isCritical: e.target.checked })} aria-describedby="critical-duty-help"/>Critical duty</label><small id="critical-duty-help">Critical duties require explicit coverage monitoring.</small></div><label>Status<Select value={d.status} onChange={status => setD({ ...d, status: status as Duty['status'] })} options={['Active', 'Inactive']}/></label><label>Required skills<input value={skills} onChange={e => setSkills(e.target.value)}/><small>Comma-separated labels, at most 32; each at most 80 characters.</small></label><label>Requirements / checklist<input value={checklist} onChange={e => setChecklist(e.target.value)}/><small>Instructions are separate from required skills.</small></label><div className="notice" role="alert" hidden={!error}>{error}</div><button className="action-button primary" type="submit" disabled={saving}><Icon name="check"/>{saving ? 'Saving…' : 'Save Template'}</button></form>; }
export function DutiesScreen() { const { duties: allDuties, templatesLoading, templatesError, refreshTemplates, planningSaving, integratedRoster, addDuty, updateDuty, duplicateDuty, locations, locationName, locationsError, refreshLocations } = useOps(); const duties = allDuties.filter(d => !d.publicationFallback); const [tab, setTab] = useState('All Duties'), [query, setQuery] = useState(''), [locationId, setLocationId] = useState(''), [selected, setSelected] = useState(duties[2]?.id), [modal, setModal] = useState<'create' | 'edit' | null>(null), [notice, updateNotice] = useState({ text: '', error: false }); const setNotice = (text: string, error = false) => updateNotice({ text, error }); const filtered = duties.filter(d => (tab === 'All Duties' || (tab === 'Active Duties' ? d.status === 'Active' : d.status === 'Inactive')) && (locationId === '' || d.locationId === locationId) && d.name.toLowerCase().includes(query.toLowerCase())); const duty = duties.find(x => x.id === selected) ?? duties[0]; return <div className="management"><div className="tabs">{['All Duties', 'Active Duties', 'Inactive Duties'].map(t => <button onClick={() => setTab(t)} className={tab === t ? 'active' : ''} key={t}>{t}</button>)}<span /><Button icon="upload" onClick={() => setNotice('Import is unavailable in this prototype.')} disabled>Import Duties</Button><Button icon="download" onClick={() => { const blob = new Blob([JSON.stringify(duties, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'said-ops-duties.json'; a.click(); setNotice('Duties exported as JSON.'); }}>Export Duties</Button><Button icon="plus" primary disabled={templatesLoading || Boolean(templatesError) || planningSaving} onClick={() => setModal('create')}>Create Duty Template</Button></div><div className="filters"><div className="search-field"><Icon name="search"/><input value={query} onChange={e => setQuery(e.target.value)} aria-label="Search duty templates" placeholder="Search duties..."/></div><LocationSelect label="Filter by area" value={locationId} onChange={setLocationId} locations={locations} includeAll/><button onClick={() => { setQuery(''); setLocationId(''); }}>Clear Filters</button></div><LocationsErrorBanner error={locationsError} onRetry={refreshLocations}/><PlanningRead loading={templatesLoading} error={templatesError} empty={!duties.length} label="duty templates" retry={refreshTemplates}/>{planningSaving && <Notice text="Saving planning record…"/>}<Notice text={notice.text} error={notice.error}/>{!templatesLoading && !templatesError && <div className="split-screen"><div className="table-wrap"><table><thead><tr><th>Duty / Task</th><th>Area</th><th>Default Time</th><th>Duration</th><th>Required Staff</th><th>Recurrence</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(d => <tr tabIndex={0} aria-selected={d.id === selected} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    setSelected(d.id);
} }} className={d.id === selected ? 'selected' : ''} onClick={() => setSelected(d.id)} key={d.id}><td><b>{d.name}</b>{d.isCritical && <Pill tone="high">Critical</Pill>}<small>{d.description}</small></td><td>{d.locationId ? locationName(d.locationId) : d.area}</td><td>{d.time}</td><td>{d.duration}</td><td>{d.required}</td><td>{d.recurrence}</td><td><Pill tone={d.priority.toLowerCase()}>{d.priority}</Pill></td><td><Pill tone={d.status.toLowerCase()}>{d.status}</Pill></td><td><button className="icon-button" disabled={planningSaving} aria-label={`Edit ${d.name}`} onClick={e => { e.stopPropagation(); setSelected(d.id); setModal('edit'); }}><Icon name="edit"/></button></td></tr>)}</tbody></table><div className="pagination">Showing {filtered.length} duties</div></div>{duty && <aside className="details panel"><h3>Duty Template Details</h3><h2>{duty?.name}</h2><Pill tone={duty?.status.toLowerCase()}>{duty?.status}</Pill><dl><dt>Area</dt><dd>{duty?.locationId ? locationName(duty.locationId) : duty?.area}</dd><dt>Default Time</dt><dd>{duty?.time}</dd><dt>Duration</dt><dd>{duty?.duration}</dd><dt>Required Staff</dt><dd>{duty?.required}</dd><dt>Recurrence</dt><dd>{duty?.recurrence}</dd><dt>Critical duty</dt><dd>{duty?.isCritical ? 'Yes' : 'No'}</dd></dl><h3>Description</h3><p>{duty?.description}</p><h3>Required skills</h3><p>{(duty?.requiredSkills ?? []).join(', ') || 'None required'}</p><h3>Requirements / checklist</h3>{duty?.requirements.map(x => <p className="requirement" key={x}><Icon name="check"/>{x}</p>)}<Button icon="copy" disabled={planningSaving} onClick={async () => { if (!duty)
    return; const result = await duplicateDuty(duty.id); setNotice(result.ok ? (integratedRoster ? 'Template duplicated and saved to Firestore.' : 'Template duplicated in this local session.') : templateMessage(result), !result.ok); }}>Duplicate Template</Button><Button icon={duty?.status === 'Active' ? 'x' : 'check'} disabled={planningSaving} onClick={async () => { if (!duty)
    return; const result = await updateDuty(duty.id, { status: duty.status === 'Active' ? 'Inactive' : 'Active' }); setNotice(result.ok ? `Duty ${duty.status === 'Active' ? 'deactivated' : 'activated'}.` : templateMessage(result), !result.ok); }}>{duty?.status === 'Active' ? 'Deactivate' : 'Activate'}</Button></aside>}</div>}{modal && <Modal containFocus title={modal === 'create' ? 'Create Duty Template' : 'Edit Duty Template'} onClose={() => setModal(null)}><DutyForm duty={modal === 'edit' ? duty : undefined} locations={locations} onSave={async (v) => { const result = await (modal === 'edit' && duty ? updateDuty(duty.id, v) : addDuty(v)); if (result.ok) {
    setModal(null);
    setNotice(`Duty template ${modal === 'edit' ? 'updated' : 'created'} ${integratedRoster ? 'and saved to Firestore' : 'in this local session'}.`);
} return result; }}/></Modal>}</div>; }
const labels = (value: string) => value.split(',').map(x => x.trim()).filter(Boolean);
function PlanningRead({ loading, error, empty, label, retry }: {
    loading: boolean;
    error: string | null;
    empty: boolean;
    label: string;
    retry: () => Promise<void>;
}) { return loading ? <Notice text={`Loading ${label}…`}/> : error ? <div className="notice" role="alert">{error}<button onClick={() => void retry()}>Retry {label}</button></div> : empty ? <Notice text={`No ${label} yet.`}/> : null; }
export function localAvailabilityTime(instant: string) { return new Date(Date.parse(instant) + 7200000).toISOString().slice(0, 16); }
export function utcAvailabilityTime(local: string) { return new Date(local + ':00+02:00').toISOString(); }
export function StaffForm({ person, locations, integrated = false, onSave }: {
    person?: Staff;
    locations: Location[];
    integrated?: boolean;
    onSave: (s: Omit<Staff, 'id'>) => Promise<void> | void;
}) {
    const [s, setS] = useState<Omit<Staff, 'id'>>(person ? { ...person, role: person.role === 'Not provisioned' ? '' : person.role } : { name: '', role: 'Veterinary Assistant', locationId: locations[0]?.id ?? '', status: 'Active', availability: 'Available', workload: 20, email: '', phone: '', skills: ['Animal Handling'] });
    const [skills, setSkills] = useState(s.skills.join(', ')), [normal, setNormal] = useState<Availability['normalState']>(person?.availabilityPlan?.normalState ?? 'Available'), [state, setState] = useState<Availability['state'] | ''>(person?.availabilityPlan?.state ?? (s.availability === 'Unknown' ? '' : s.availability)), [from, setFrom] = useState(person?.availabilityPlan ? localAvailabilityTime(person.availabilityPlan.effectiveFrom) : ''), [to, setTo] = useState(person?.availabilityPlan?.effectiveTo ? localAvailabilityTime(person.availabilityPlan.effectiveTo) : '');
    const [error, setError] = useState(''), [saving, setSaving] = useState(false);
    const lock = useRef(false);
    return <form className="form-grid" onSubmit={async (e: FormEvent) => { e.preventDefault(); if (lock.current)
        return; lock.current = true; setSaving(true); setError(''); try {
        if (integrated && (!from || !state || s.status === 'Unknown' || !s.locationId || !s.role.trim()))
            throw Error('Choose status, location and dated availability explicitly.');
        const availabilityPlan = from ? { normalState: normal, state: state as Availability['state'], effectiveFrom: utcAvailabilityTime(from), effectiveTo: to ? utcAvailabilityTime(to) : null } : undefined;
        await onSave({ ...s, skills: labels(skills), availability: state as Staff['availability'], ...(availabilityPlan ? { availabilityPlan } : {}) });
    }
    catch (error) {
        setError(error instanceof Error ? error.message : 'Staff save failed.');
    }
    finally {
        lock.current = false;
        setSaving(false);
    } }}>
    {person?.operationalMissing && <Notice text="Some operational fields are not provisioned. Review and initialize them explicitly when saving."/>}
    <label>Full name<input required readOnly={integrated} value={s.name} onChange={e => setS({ ...s, name: e.target.value })}/></label>
    <label>Operational role<input required maxLength={120} value={s.role} onChange={e => setS({ ...s, role: e.target.value })}/><small>Job category; authorization role is administrator-managed.</small></label>
    <label>Primary location<LocationSelect value={s.locationId} onChange={locationId => setS({ ...s, locationId })} locations={locations}/></label>
    <label>Status<Select value={s.status} onChange={status => setS({ ...s, status: status as Staff['status'] })} options={s.status === 'Unknown' ? ['Unknown', 'Active', 'Inactive'] : ['Active', 'Inactive']}/></label>
    <label>Normal availability<Select value={normal} onChange={v => setNormal(v as Availability['normalState'])} options={['Available', 'On Duty']}/></label>
    <label>Availability during effective window<Select value={state} onChange={v => setState(v as Availability['state'])} options={state ? availabilityStates : ['', ...availabilityStates]}/></label>
    <label>Effective from (Johannesburg)<input type="datetime-local" required={integrated} value={from} onChange={e => setFrom(e.target.value)}/></label>
    <label>Effective to (Johannesburg)<input type="datetime-local" value={to} onChange={e => setTo(e.target.value)}/><small>Exclusive end; blank means ongoing. Normal availability applies outside this window.</small></label>
    {!integrated && <label>Workload %<input type="number" min="0" max="100" value={s.workload} onChange={e => setS({ ...s, workload: +e.target.value })}/></label>}
    <label>Work email<input type="email" readOnly={integrated} value={s.email} onChange={e => setS({ ...s, email: e.target.value })}/></label>
    <label>Work phone<input readOnly={integrated} value={s.phone} onChange={e => setS({ ...s, phone: e.target.value })}/></label>
    <label>Skills<input value={skills} onChange={e => setSkills(e.target.value)}/><small>Comma-separated labels, at most 32. Saving an empty list explicitly records no skills.</small></label>
    <Notice text={error} error/><button className="action-button primary" type="submit" disabled={saving}><Icon name="check"/>{saving ? 'Saving…' : 'Save Staff Member'}</button>
  </form>;
}
export function StaffScreen() { const { staff: allStaff, workforceLoading, workforceError, refreshWorkforce, planningSaving, integratedRoster, addStaff, updateStaff, locations, locationName, locationsError, refreshLocations } = useOps(); const staff = allStaff.filter(s => !s.publicationFallback); const [tab, setTab] = useState('All Staff'), [query, setQuery] = useState(''), [locationId, setLocationId] = useState(''), [role, setRole] = useState('All Roles'), [selected, setSelected] = useState(staff[0]?.id), [detailTab, setDetailTab] = useState('Profile'), [modal, setModal] = useState<'add' | 'edit' | null>(null), [notice, setNotice] = useState(''); const filtered = staff.filter(s => (tab === 'All Staff' || (tab === 'Active' ? s.status === 'Active' : tab === 'On Duty' ? s.availability === 'On Duty' : tab === 'On Leave' ? s.availability === 'On Leave' : s.availability === 'Training')) && (locationId === '' || s.locationId === locationId) && (role === 'All Roles' || s.role === role) && `${s.name} ${s.role} ${s.employeeId ?? s.id}`.toLowerCase().includes(query.trim().toLowerCase())); const person = staff.find(s => s.id === selected) ?? staff[0]; return <div className="management"><div className="tabs">{['All Staff', 'Active', 'On Duty', 'On Leave', 'Training'].map(t => <button onClick={() => setTab(t)} className={tab === t ? 'active' : ''} key={t}>{t}</button>)}<span /><Button icon="userPlus" primary disabled={integratedRoster || workforceLoading || Boolean(workforceError)} onClick={() => setModal('add')}>{integratedRoster ? 'Add Staff — administrator setup' : 'Add Staff (local demo)'}</Button></div><div className="filters"><div className="search-field"><Icon name="search"/><input value={query} onChange={e => setQuery(e.target.value)} aria-label="Search staff" placeholder="Search staff..."/></div><LocationSelect label="Filter by area" value={locationId} onChange={setLocationId} locations={locations} includeAll/><Select label="Filter staff by role" value={role} onChange={setRole} options={['All Roles', ...Array.from(new Set(staff.map(person => person.role)))]}/><button onClick={() => { setQuery(''); setLocationId(''); setRole('All Roles'); }}>Clear Filters</button></div><LocationsErrorBanner error={locationsError} onRetry={refreshLocations}/><PlanningRead loading={workforceLoading} error={workforceError} empty={!staff.length} label="workforce" retry={refreshWorkforce}/>{integratedRoster && <Notice text="Staff accounts require administrator provisioning. Operational edits are saved to Firestore."/>}{planningSaving && <Notice text="Saving planning record…"/>}<Notice text={notice}/>{!workforceLoading && !workforceError && <div className="split-screen"><div className="table-wrap"><table><thead><tr><th>Staff Member</th><th>Role</th><th>Area / Unit</th><th>Status</th><th>Availability</th><th>Workload</th><th>Actions</th></tr></thead><tbody>{filtered.map(s => <tr tabIndex={0} aria-selected={s.id === selected} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    setSelected(s.id);
} }} className={s.id === selected ? 'selected' : ''} onClick={() => setSelected(s.id)} key={s.id}><td><b>{s.name}</b><small>{s.id}</small></td><td>{s.role}</td><td>{locationName(s.locationId)}</td><td><Pill tone={s.status.toLowerCase()}>{s.status === 'Unknown' ? 'Not provisioned' : s.status}</Pill></td><td><Pill tone={s.availability.toLowerCase().replace(' ', '')}>{s.availability === 'Unknown' ? 'Not provisioned' : s.availability}</Pill></td><td>{integratedRoster ? '—' : <div className="workload"><b>{s.workload}%</b><span><i style={{ width: `${s.workload}%` }}/></span></div>}</td><td><button className="icon-button" disabled={planningSaving} aria-label={`Edit ${s.name}`} onClick={() => { setSelected(s.id); setModal('edit'); }}><Icon name="edit"/></button><button className="icon-button" aria-label={`More actions for ${s.name}`} onClick={() => setNotice('Additional staff actions are prototype-only.')}><Icon name="more"/></button></td></tr>)}</tbody></table><div className="pagination">Showing {filtered.length} staff</div></div>{person && <aside className="details panel staff-details"><div className="staff-title"><div className="avatar large">{person?.name.split(' ').map(x => x[0]).join('')}</div><div><h2>{person?.name}</h2><p>{person?.role}</p><Pill tone={person?.status.toLowerCase()}>{person?.status === 'Unknown' ? 'Not provisioned' : person?.status}</Pill></div></div><div className="detail-tabs">{['Profile', 'Availability', 'Skills'].map(t => <button className={detailTab === t ? 'active' : ''} onClick={() => setDetailTab(t)} key={t}>{t}</button>)}</div>{detailTab === 'Profile' && <dl><dt>Staff ID</dt><dd>{person?.id}</dd><dt>Operational Role</dt><dd>{person?.role}</dd><dt>Primary Area</dt><dd>{person ? locationName(person.locationId) : ''}</dd><dt>Work Email</dt><dd>{person?.email}</dd><dt>Work Phone</dt><dd>{person?.phone}</dd></dl>}{detailTab === 'Availability' && <div><h3>Current Availability</h3><p><Pill tone={person?.availability.toLowerCase().replace(' ', '')}>{person?.availability === 'Unknown' ? 'Not provisioned' : person?.availability}</Pill></p>{person?.availabilityPlan && <dl><dt>Normal state</dt><dd>{person.availabilityPlan.normalState}</dd><dt>Window state</dt><dd>{person.availabilityPlan.state}</dd><dt>From (Johannesburg)</dt><dd>{localAvailabilityTime(person.availabilityPlan.effectiveFrom).replace('T', ' ')}</dd><dt>Until (exclusive)</dt><dd>{person.availabilityPlan.effectiveTo ? localAvailabilityTime(person.availabilityPlan.effectiveTo).replace('T', ' ') : 'Ongoing'}</dd></dl>}<Button icon="edit" disabled={planningSaving} onClick={() => setModal('edit')}>Edit availability</Button><p className="availability-note">Availability uses the saved effective window. Leave approval remains unavailable.</p></div>}{detailTab === 'Skills' && <div><h3>Skills</h3>{person?.skillsKnown === false && <p>Skills not provisioned.</p>}{person?.skills.map(x => <p className="requirement" key={x}><Icon name="check"/>{x}</p>)}{!integratedRoster && <h3>Current Workload (local demo)</h3>}{!integratedRoster && <div className="workload large-workload"><b>{person?.workload}%</b><span><i style={{ width: `${person?.workload}%` }}/></span></div>}</div>}</aside>}</div>}{modal && <Modal title={modal === 'add' ? 'Add Staff' : 'Edit Staff'} onClose={() => setModal(null)}><StaffForm person={modal === 'edit' ? person : undefined} locations={locations} integrated={integratedRoster} onSave={async (s) => { if (modal === 'edit' && person)
    await updateStaff(person.id, s);
else
    addStaff(s); setModal(null); setNotice(integratedRoster ? 'Staff operational fields saved to Firestore.' : `Staff member ${modal === 'edit' ? 'updated' : 'added'} in this local session roster pool. Nothing was saved to Firestore.`); }}/></Modal>}</div>; }
