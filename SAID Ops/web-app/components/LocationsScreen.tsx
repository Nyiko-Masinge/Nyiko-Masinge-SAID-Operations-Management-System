'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useModalFocus } from './useModalFocus';
import { Icon } from './Icons';
import { createLocation, getAllLocations, Location, renameLocation, setLocationActive } from '../lib/locations';
import { isFirebaseConfigured } from '../lib/firebase';
import { useOps } from './OpsProvider';

// Real Firestore-backed CRUD (unlike StaffScreen/DutiesScreen/RosterScreen, which still run
// on OpsProvider's in-memory prototype data). This is FR-3: locations are supervisor-managed
// data that both apps read from the same `locations` collection, not hardcoded strings.
// Deliberately does not reuse OpsProvider's Button/Pill/Modal/Notice — those aren't exported
// from ManagementScreens.tsx. Reuses the same class names so it looks identical; if the team
// pulls those into a shared file later, this can switch to importing them.

function Button({ icon, children, onClick, primary = false, disabled = false }:
  { icon: 'plus' | 'edit' | 'check' | 'x'; children: React.ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean }) {
  return <button className={'action-button ' + (primary ? 'primary' : '')} disabled={disabled} onClick={onClick}><Icon name={icon} />{children}</button>;
}
function Pill({ children, tone = 'green' }: { children: React.ReactNode; tone?: string }) {
  return <span className={'pill ' + tone}>{children}</span>;
}
function Notice({ text }: { text: string }) {
  return text ? <div className="notice">{text}</div> : null;
}
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useModalFocus(ref, true, onClose);
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}><button className="close" aria-label={`Close ${title}`} onClick={onClose}><Icon name="x" /></button><h2>{title}</h2>{children}</section></div>;
}

function LocationForm({ location, onSave, onCancel }: { location?: Location; onSave: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(location?.name ?? '');
  return (
    <form className="form-grid" onSubmit={(e: FormEvent) => { e.preventDefault(); if (name.trim()) onSave(name); }}>
      <label>Location / area name
        <input autoFocus onChange={(e) => setName(e.target.value)} placeholder="e.g. Reception" required value={name} />
      </label>
      <button className="action-button primary" type="submit"><Icon name="check" />{location ? 'Save Changes' : 'Add Location'}</button>
      <button className="action-button" onClick={onCancel} type="button">Cancel</button>
    </form>
  );
}

export function LocationsScreen() {
  // Staff & Duties read locations through OpsProvider, not from this screen's own state, so
  // any successful change here has to also tell OpsProvider to refetch -- otherwise those
  // pickers would keep showing stale data until a full page reload.
  const { refreshLocations: refreshSharedLocations } = useOps();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<'All' | 'Active' | 'Retired'>('All');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<'add' | Location | null>(null);
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    if (!isFirebaseConfigured()) { setLoadError('Firebase is not configured. Copy .env.example to .env.local and add the project values.'); setLoading(false); return; }
    setLoading(true);
    try {
      setLocations(await getAllLocations());
      setLoadError('');
    } catch {
      setLoadError('Could not load locations from Firestore. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  const filtered = locations.filter((l) =>
    (tab === 'All' || (tab === 'Active' ? l.active : !l.active)) &&
    l.name.toLowerCase().includes(query.toLowerCase()));

  async function handleSave(name: string) {
    try {
      if (modal && modal !== 'add') await renameLocation(modal.id, name);
      else await createLocation(name);
      setModal(null);
      setNotice(modal && modal !== 'add' ? 'Location updated.' : 'Location added.');
      await Promise.all([refresh(), refreshSharedLocations()]);
    } catch {
      setNotice('That change could not be saved. Please try again.');
    }
  }

  async function toggleActive(location: Location) {
    setBusyId(location.id);
    try {
      await setLocationActive(location.id, !location.active);
      setNotice(location.active ? `${location.name} retired.` : `${location.name} reactivated.`);
      await Promise.all([refresh(), refreshSharedLocations()]);
    } catch {
      setNotice('That change could not be saved. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="management"><Notice text="Loading locations…" /></div>;

  return (
    <div className="management">
      <div className="tabs">
        {(['All', 'Active', 'Retired'] as const).map((t) =>
          <button className={tab === t ? 'active' : ''} key={t} onClick={() => setTab(t)}>{t} Locations</button>)}
        <span />
        <Button disabled={!isFirebaseConfigured()} icon="plus" onClick={() => setModal('add')} primary>Add Location</Button>
      </div>
      <div className="filters">
        <div className="search-field"><Icon name="search" /><input onChange={(e) => setQuery(e.target.value)} placeholder="Search locations..." value={query} /></div>
      </div>
      <Notice text={loadError || notice} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Location / Area</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((l) =>
              <tr key={l.id}>
                <td><b>{l.name}</b></td>
                <td><Pill tone={l.active ? 'green' : 'inactive'}>{l.active ? 'Active' : 'Retired'}</Pill></td>
                <td>
                  <button className="icon-button" aria-label={`Edit ${l.name}`} onClick={() => setModal(l)}><Icon name="edit" /></button>
                  <button className="icon-button" aria-label={`${l.active ? 'Retire' : 'Reactivate'} ${l.name}`} disabled={busyId === l.id} onClick={() => toggleActive(l)}><Icon name={l.active ? 'x' : 'check'} /></button>
                </td>
              </tr>)}
            {filtered.length === 0 && <tr><td colSpan={3}>No locations found.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal onClose={() => setModal(null)} title={modal === 'add' ? 'Add Location' : 'Edit Location'}>
          <LocationForm location={modal === 'add' ? undefined : modal} onCancel={() => setModal(null)} onSave={handleSave} />
        </Modal>
      )}
    </div>
  );
}
