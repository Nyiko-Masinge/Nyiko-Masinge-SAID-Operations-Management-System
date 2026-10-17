'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useModalFocus } from './useModalFocus';
import { endTime } from '../lib/roster/mock';
import type { DutyTemplate, ScheduleInput, ScheduledWork } from '../lib/roster/types';
import { Icon } from './Icons';
import type { Location } from '../lib/locations';

function fromTemplate(template: DutyTemplate, date: string): ScheduleInput {
  return {
    dutyId: template.id,
    title: template.name,
    description: template.description,
    date,
    startTime: template.time,
    endTime: endTime(template.time, template.duration),
    area: template.area,
    locationId: template.locationId,
    required: template.required,
  };
}

function adHoc(date: string, locations: readonly Location[]): ScheduleInput {
  return { title: '', description: '', date, startTime: '08:00', endTime: '09:00', area: locations[0]?.name ?? '', locationId: locations[0]?.id ?? '', required: 1 };
}

type Props = {
  date: string;
  templates: readonly DutyTemplate[];
  locations: readonly Location[];
  allLocations: readonly Location[];
  work?: ScheduledWork;
  onSave: (input: ScheduleInput) => string | undefined;
  onClose: () => void;
};

export function RosterEditor({ date, templates, locations, allLocations, work, onSave, onClose }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const startTimeInputRef = useRef<HTMLInputElement>(null);
  const endTimeInputRef = useRef<HTMLInputElement>(null);
  useModalFocus(dialogRef, true, onClose);
  const activeTemplates = templates.filter(template => template.status === 'Active' && locations.some(location => location.id === template.locationId));
  const firstTemplate = activeTemplates[0];
  const [source, setSource] = useState<'template' | 'adhoc'>(work ? (work.dutyId ? 'template' : 'adhoc') : (firstTemplate ? 'template' : 'adhoc'));
  const [draft, setDraft] = useState<ScheduleInput>(() => work
    ? { dutyId: work.dutyId, title: work.title, description: work.description, date: work.date,
      startTime: work.startTime, endTime: work.endTime, area: work.area, locationId: work.locationId, required: work.required }
    : firstTemplate ? fromTemplate(firstTemplate, date) : adHoc(date, locations));
  const [error, setError] = useState('');
  const update = (part: Partial<ScheduleInput>) => { setDraft(current => ({ ...current, ...part })); setError(''); };
  const openPicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === 'function') {
      try { input.showPicker(); } catch { input.focus(); }
    }
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const selectedSource = work ? (work.dutyId ? 'template' : 'adhoc') : values.get('source');
    const locationId = String(values.get('locationId') ?? draft.locationId ?? '');
    const location = allLocations.find(item => item.id === locationId);
    const input: ScheduleInput = {
      dutyId: selectedSource === 'template' ? String(values.get('dutyId') ?? draft.dutyId ?? '') : undefined,
      title: String(values.get('title') ?? ''),
      description: String(values.get('description') ?? ''),
      date: String(values.get('date') ?? ''),
      startTime: String(values.get('startTime') ?? ''),
      endTime: String(values.get('endTime') ?? ''),
      area: location?.name ?? draft.area,
      locationId,
      required: Number(values.get('required')),
    };
    const failure = onSave(input);
    if (failure) { setDraft(input); setError(failure); }
  }

  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label={work ? 'Edit roster item' : 'Add roster item'} tabIndex={-1} ref={dialogRef}>
    <button className="close" aria-label="Close roster form" onClick={onClose}><Icon name="x"/></button>
    <h2>{work ? 'Edit Roster Item' : 'Add Roster Item'}</h2>
    <form className="form-grid" onSubmit={submit}>
      {!work && <label>Source
        <select name="source" value={source} onChange={event => {
          const next = event.target.value as 'template' | 'adhoc';
          setSource(next);
          setDraft(next === 'template' && firstTemplate ? fromTemplate(firstTemplate, draft.date) : adHoc(draft.date, locations));
          setError('');
        }}>
          {firstTemplate && <option value="template">Active task template</option>}
          <option value="adhoc">Ad-hoc operational work</option>
        </select>
      </label>}
      {!work && source === 'template' && <label>Task template
        <select name="dutyId" value={draft.dutyId ?? ''} onChange={event => {
          const template = activeTemplates.find(item => item.id === event.target.value);
          if (template) { setDraft(fromTemplate(template, draft.date)); setError(''); }
        }}>
          {activeTemplates.map(template => <option value={template.id} key={template.id}>{template.name}</option>)}
        </select>
      </label>}
      <label>Work title
        <input name="title" value={draft.title} readOnly={Boolean(work?.dutyId)} onChange={event => update({ title: event.target.value })} placeholder="Operational work title"/>
      </label>
      <label>Description
        <input name="description" value={draft.description} readOnly={Boolean(work?.dutyId)} onChange={event => update({ description: event.target.value })}/>
      </label>
      <label>Date<div className="picker-field"><input ref={dateInputRef} name="date" type="date" value={draft.date} onInput={event => update({ date: event.currentTarget.value })} onChange={event => update({ date: event.target.value })}/><button type="button" className="icon-button" aria-label="Choose date" onClick={() => openPicker(dateInputRef.current)}><Icon name="calendar"/></button></div></label>
      <label>Start time<div className="picker-field"><input ref={startTimeInputRef} name="startTime" type="time" value={draft.startTime} onInput={event => update({ startTime: event.currentTarget.value })} onChange={event => update({ startTime: event.target.value })}/><button type="button" className="icon-button" aria-label="Choose start time" onClick={() => openPicker(startTimeInputRef.current)}><Icon name="clock"/></button></div></label>
      <label>End time<div className="picker-field"><input ref={endTimeInputRef} name="endTime" type="time" value={draft.endTime} onInput={event => update({ endTime: event.currentTarget.value })} onChange={event => update({ endTime: event.target.value })}/><button type="button" className="icon-button" aria-label="Choose end time" onClick={() => openPicker(endTimeInputRef.current)}><Icon name="clock"/></button></div></label>
      <label>Area
        <select name="locationId" value={draft.locationId ?? ''} onChange={event => {
          const location = locations.find(item => item.id === event.target.value);
          update({ locationId: event.target.value, area: location?.name ?? '' });
        }}>
          {draft.locationId && !locations.some(item => item.id === draft.locationId) && <option disabled value={draft.locationId}>{allLocations.find(item => item.id === draft.locationId)?.name ?? draft.area} (unavailable for new assignments)</option>}
          {!draft.locationId && <option disabled value="">Select an operational area</option>}
          {locations.map(location => <option value={location.id} key={location.id}>{location.name}</option>)}
        </select>
      </label>
      <label>Required staff<input name="required" type="number" value={draft.required} onChange={event => update({ required: Number(event.target.value) })}/></label>
      {error && <div className="notice" role="alert">{error}</div>}
      <button className="action-button primary" type="submit"><Icon name="check"/>{work ? 'Save Changes' : 'Add to Roster'}</button>
      <button className="action-button" type="button" onClick={onClose}>Cancel</button>
    </form>
  </section></div>;
}
