import { CalendarDays, Clock3, MapPin, Plus, Repeat2, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { EventFrequency, MapEvent, MapItem, Weekday } from '../domain'

export type EventInput = Omit<MapEvent, 'id' | 'createdAt' | 'updatedAt'>

interface EventManagerProps {
  open: boolean
  events: MapEvent[]
  items: MapItem[]
  onCreate: (input: EventInput) => string
  onUpdate: (id: string, patch: Partial<MapEvent>) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const frequencyLabels: Record<EventFrequency, string> = {
  once: 'Einmalig',
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
}

const weekdayLabels: Array<{ value: Weekday; short: string; long: string }> = [
  { value: 'monday', short: 'Mo', long: 'Montag' },
  { value: 'tuesday', short: 'Di', long: 'Dienstag' },
  { value: 'wednesday', short: 'Mi', long: 'Mittwoch' },
  { value: 'thursday', short: 'Do', long: 'Donnerstag' },
  { value: 'friday', short: 'Fr', long: 'Freitag' },
  { value: 'saturday', short: 'Sa', long: 'Samstag' },
  { value: 'sunday', short: 'So', long: 'Sonntag' },
]

function localDateString(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function weekdayForDate(value: string): Weekday {
  const index = new Date(`${value}T12:00:00Z`).getUTCDay()
  return weekdayLabels[(index + 6) % 7]?.value ?? 'monday'
}

function emptyEventDraft(): EventInput {
  const startDate = localDateString()
  return {
    title: 'Neue Veranstaltung',
    description: '',
    location: '',
    relatedItemId: null,
    startDate,
    startTime: '10:00',
    endTime: null,
    recurrence: { frequency: 'once', interval: 1, weekdays: [], monthDays: [], endsOn: null },
    visible: true,
  }
}

function eventToDraft(event: MapEvent): EventInput {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = event
  void _id; void _createdAt; void _updatedAt
  return structuredClone(draft)
}

function recurrenceSummary(event: MapEvent): string {
  const { recurrence } = event
  if (recurrence.frequency === 'once') return 'Einmalig'
  if (recurrence.frequency === 'daily') return recurrence.interval === 1 ? 'Täglich' : `Alle ${recurrence.interval} Tage`
  if (recurrence.frequency === 'weekly') {
    const days = weekdayLabels.filter((day) => recurrence.weekdays.includes(day.value)).map((day) => day.short).join(', ')
    return recurrence.interval === 1 ? `Wöchentlich · ${days}` : `Alle ${recurrence.interval} Wochen · ${days}`
  }
  const days = recurrence.monthDays.map((day) => `${day}.`).join(', ')
  return recurrence.interval === 1 ? `Monatlich · ${days}` : `Alle ${recurrence.interval} Monate · ${days}`
}

function formatEventDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00Z`))
}

export function EventManager({ open, events, items, onCreate, onUpdate, onDelete, onClose }: EventManagerProps) {
  const sortedEvents = useMemo(() => [...events].sort((a, b) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`)), [events])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedEvent = events.find((event) => event.id === selectedId) ?? null
  const [draft, setDraft] = useState<EventInput>(emptyEventDraft)

  useEffect(() => {
    if (!open) return
    const nextId = selectedId && events.some((event) => event.id === selectedId) ? selectedId : sortedEvents[0]?.id ?? null
    setSelectedId(nextId)
    setDraft(nextId ? eventToDraft(events.find((event) => event.id === nextId)!) : emptyEventDraft())
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !selectedEvent) return
    setDraft(eventToDraft(selectedEvent))
  }, [open, selectedEvent?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  const setFrequency = (frequency: EventFrequency) => {
    setDraft((current) => ({
      ...current,
      recurrence: {
        ...current.recurrence,
        frequency,
        weekdays: frequency === 'weekly' && current.recurrence.weekdays.length === 0 ? [weekdayForDate(current.startDate)] : current.recurrence.weekdays,
        monthDays: frequency === 'monthly' && current.recurrence.monthDays.length === 0 ? [Number(current.startDate.slice(-2))] : current.recurrence.monthDays,
      },
    }))
  }

  const toggleWeekday = (weekday: Weekday) => setDraft((current) => {
    const selected = current.recurrence.weekdays.includes(weekday)
    const weekdays = selected ? current.recurrence.weekdays.filter((value) => value !== weekday) : [...current.recurrence.weekdays, weekday]
    return { ...current, recurrence: { ...current.recurrence, weekdays: weekdays.length > 0 ? weekdays : [weekday] } }
  })

  const toggleMonthDay = (day: number) => setDraft((current) => {
    const selected = current.recurrence.monthDays.includes(day)
    const monthDays = selected ? current.recurrence.monthDays.filter((value) => value !== day) : [...current.recurrence.monthDays, day].sort((a, b) => a - b)
    return { ...current, recurrence: { ...current.recurrence, monthDays: monthDays.length > 0 ? monthDays : [day] } }
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const normalized: EventInput = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      location: draft.location.trim(),
      endTime: draft.endTime || null,
      recurrence: {
        ...draft.recurrence,
        weekdays: draft.recurrence.frequency === 'weekly' ? draft.recurrence.weekdays : [],
        monthDays: draft.recurrence.frequency === 'monthly' ? draft.recurrence.monthDays : [],
        endsOn: draft.recurrence.frequency === 'once' ? null : draft.recurrence.endsOn,
      },
    }
    if (!normalized.title) return
    if (selectedEvent) onUpdate(selectedEvent.id, normalized)
    else setSelectedId(onCreate(normalized))
  }

  const createNew = () => {
    setSelectedId(null)
    setDraft(emptyEventDraft())
  }

  const removeSelected = () => {
    if (!selectedEvent) return
    onDelete(selectedEvent.id)
    const next = sortedEvents.find((event) => event.id !== selectedEvent.id) ?? null
    setSelectedId(next?.id ?? null)
    setDraft(next ? eventToDraft(next) : emptyEventDraft())
  }

  const repeatUnit = draft.recurrence.frequency === 'daily' ? 'Tage' : draft.recurrence.frequency === 'weekly' ? 'Wochen' : 'Monate'

  return (
    <div className="modal-backdrop event-manager-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal event-manager" role="dialog" aria-modal="true" aria-labelledby="events-title">
        <header className="event-manager-header">
          <div className="event-manager-heading"><span className="event-manager-icon"><CalendarDays size={22} /></span><div><span className="eyebrow">Zoo-Programm</span><h2 id="events-title">Veranstaltungen</h2><p>Fütterungen, Führungen und weitere Termine planen.</p></div></div>
          <button className="icon-button" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
        </header>

        <div className="event-manager-body">
          <aside className="event-list-pane">
            <div className="event-list-toolbar"><div><strong>{events.length} Termine</strong><span>{events.filter((event) => event.visible).length} veröffentlicht</span></div><button className="button event-add-button" onClick={createNew}><Plus size={15} />Neu</button></div>
            <div className="event-list">
              {sortedEvents.map((event) => (
                <button key={event.id} className={`event-list-card${event.id === selectedId ? ' is-selected' : ''}${event.visible ? '' : ' is-hidden'}`} onClick={() => { setSelectedId(event.id); setDraft(eventToDraft(event)) }}>
                  <span className="event-date-tile"><strong>{event.startDate.slice(-2)}</strong><small>{new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' }).format(new Date(`${event.startDate}T12:00:00Z`))}</small></span>
                  <span className="event-list-copy"><strong>{event.title}</strong><span><Clock3 size={12} />{event.startTime}{event.endTime ? `–${event.endTime}` : ''}</span><small><Repeat2 size={11} />{recurrenceSummary(event)}</small></span>
                </button>
              ))}
              {sortedEvents.length === 0 && <div className="event-empty"><CalendarDays size={28} /><strong>Noch keine Veranstaltungen</strong><span>Erstellen Sie den ersten Termin für Ihre Besucher.</span></div>}
            </div>
          </aside>

          <form className="event-editor" onSubmit={submit}>
            <div className="event-editor-scroll">
              <div className="event-form-title"><div><span className="eyebrow">{selectedEvent ? 'Termin bearbeiten' : 'Neuer Termin'}</span><h3>{draft.title || 'Unbenannte Veranstaltung'}</h3></div><label className="event-visible-toggle"><input type="checkbox" checked={draft.visible} onChange={(event) => setDraft((current) => ({ ...current, visible: event.target.checked }))} /><span>{draft.visible ? 'Sichtbar' : 'Entwurf'}</span></label></div>

              <section className="event-form-section">
                <h4>Allgemein</h4>
                <label className="field"><span>Name</span><input required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Zum Beispiel Pinguinfütterung" /></label>
                <label className="field"><span>Beschreibung</span><textarea rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Was erwartet die Besucher?" /></label>
                <div className="event-form-grid two-columns">
                  <label className="field"><span><MapPin size={13} /> Ort</span><input value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Pinguinanlage" /></label>
                  <label className="field"><span>Kartenpunkt</span><select value={draft.relatedItemId ?? ''} onChange={(event) => setDraft((current) => ({ ...current, relatedItemId: event.target.value || null }))}><option value="">Kein Kartenpunkt</option>{items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                </div>
              </section>

              <section className="event-form-section">
                <h4>Datum und Uhrzeit</h4>
                <div className="event-form-grid three-columns">
                  <label className="field"><span>Datum</span><input required type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
                  <label className="field"><span>Beginn</span><input required type="time" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))} /></label>
                  <label className="field"><span>Ende <small>optional</small></span><input type="time" value={draft.endTime ?? ''} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value || null }))} /></label>
                </div>
                <div className="event-date-preview"><CalendarDays size={15} /><strong>{formatEventDate(draft.startDate)}</strong><span>{draft.startTime}{draft.endTime ? `–${draft.endTime}` : ''} Uhr</span></div>
              </section>

              <section className="event-form-section recurrence-section">
                <h4>Wiederholung</h4>
                <div className="recurrence-segments" aria-label="Wiederholung">{(Object.keys(frequencyLabels) as EventFrequency[]).map((frequency) => <button type="button" key={frequency} className={draft.recurrence.frequency === frequency ? 'is-active' : ''} aria-pressed={draft.recurrence.frequency === frequency} onClick={() => setFrequency(frequency)}>{frequencyLabels[frequency]}</button>)}</div>

                {draft.recurrence.frequency !== 'once' && <div className="recurrence-options">
                  <label className="repeat-interval"><span>Wiederholen alle</span><input type="number" min="1" max="52" value={draft.recurrence.interval} onChange={(event) => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, interval: Math.min(52, Math.max(1, Number(event.target.value) || 1)) } }))} /><strong>{repeatUnit}</strong></label>

                  {draft.recurrence.frequency === 'weekly' && <div className="weekday-picker"><span>An diesen Tagen</span><div>{weekdayLabels.map((weekday) => <button type="button" key={weekday.value} title={weekday.long} aria-pressed={draft.recurrence.weekdays.includes(weekday.value)} className={draft.recurrence.weekdays.includes(weekday.value) ? 'is-active' : ''} onClick={() => toggleWeekday(weekday.value)}>{weekday.short}</button>)}</div></div>}

                  {draft.recurrence.frequency === 'monthly' && <div className="monthday-picker"><span>An diesen Kalendertagen</span><div>{Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <button type="button" key={day} aria-label={`${day}. Tag des Monats`} aria-pressed={draft.recurrence.monthDays.includes(day)} className={draft.recurrence.monthDays.includes(day) ? 'is-active' : ''} onClick={() => toggleMonthDay(day)}>{day}</button>)}</div><small>In kürzeren Monaten wird der letzte verfügbare Tag verwendet.</small></div>}

                  <label className="repeat-end-row"><input type="checkbox" checked={Boolean(draft.recurrence.endsOn)} onChange={(event) => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, endsOn: event.target.checked ? current.startDate : null } }))} /><span><strong>Enddatum festlegen</strong><small>Ohne Enddatum läuft die Wiederholung dauerhaft.</small></span>{draft.recurrence.endsOn && <input type="date" min={draft.startDate} value={draft.recurrence.endsOn} onChange={(event) => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, endsOn: event.target.value } }))} />}</label>
                </div>}
              </section>
            </div>

            <footer className="event-editor-actions">
              {selectedEvent ? <button type="button" className="button danger-ghost" onClick={removeSelected}><Trash2 size={15} />Löschen</button> : <span />}
              <div><button type="button" className="button ghost" onClick={onClose}>Abbrechen</button><button type="submit" className="button primary">{selectedEvent ? 'Änderungen speichern' : 'Veranstaltung erstellen'}</button></div>
            </footer>
          </form>
        </div>
      </section>
    </div>
  )
}
