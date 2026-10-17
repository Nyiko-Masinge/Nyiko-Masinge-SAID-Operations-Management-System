'use client';
import { useEffect, useState } from 'react';
import { useMonitoring } from './MonitoringProvider';
import { formatDateTime } from '../data/monitoring/model';
import type { NoteEntityType, OperationalNote } from '../data/monitoring/model';

/**
 * Drop this into any screen that has one selected roster, duty or alert, so authorised
 * users can add context that stays attached to that record (FR-14). For example, in
 * AlertsHistory.tsx's alert details panel: <NotesPanel entityType="alert" entityId={current.id} />
 */
export function NotesPanel({ entityType, entityId }: { entityType: NoteEntityType; entityId: string }) {
  const { subscribeNotes, addNote } = useMonitoring();
  const [notes, setNotes] = useState<OperationalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedKey, setLoadedKey] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotes([]);
    setLoadError(null);
    const unsubscribe = subscribeNotes(
      entityType,
      entityId,
      (list) => {
        if (cancelled) return;
        setNotes(list);
        setLoadError(null);
        setLoadedKey(`${entityType}:${entityId}`);
        setLoading(false);
      },
      () => { if (!cancelled) { setLoadError('Error loading notes. Please try again later.'); setLoadedKey(`${entityType}:${entityId}`); setLoading(false); } },
    );
    return () => { cancelled = true; unsubscribe(); };
  }, [entityType, entityId, subscribeNotes]);

  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setSaveError(null);
    try {
      await addNote({ entityType, entityId, text: value });
      setText('');
    } catch (cause) {
      // The text is kept so nothing the user typed is lost, and the failure is stated.
      setSaveError(`Your note was not saved. ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="notes-panel">
      <h3>Operational Notes</h3>
      {(loading || loadedKey !== `${entityType}:${entityId}`) && <p>Loading notes...</p>}
      {!loading && loadedKey === `${entityType}:${entityId}` && loadError && <p role="alert">{loadError}</p>}
      {!loading && loadedKey === `${entityType}:${entityId}` && !loadError && notes.length === 0 && <p>No notes yet.</p>}
      {!loading && loadedKey === `${entityType}:${entityId}` && notes.map((n) => (
        <div className="note" key={n.id}>
          <b>{n.author.name}</b> <small>{formatDateTime(n.createdAt)}</small>
          <p>{n.text}</p>
        </div>
      ))}
      <div className="search-field">
        <input
          placeholder="Add a note..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
      </div>
      {saveError && <p role="alert">{saveError}</p>}
      <button className="action-button" disabled={sending || !text.trim()} onClick={() => void submit()}>
        Add Note
      </button>
    </div>
  );
}
