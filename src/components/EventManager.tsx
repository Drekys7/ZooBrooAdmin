import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Clock3, Copy, List, MapPin, Plus, Repeat2, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { eventLifecycleStatus, eventOccursOnDate, nextEventOccurrence, type EventFrequency, type EventLifecycleStatus, type MapEvent, type MapItem, type Weekday } from '../domain'
import { ConfirmDialog } from './ConfirmDialog'

export type EventInput = Omit<MapEvent, 'id' | 'createdAt' | 'updatedAt'>

interface EventManagerProps {
  open: boolean
  events: MapEvent[]
  items: MapItem[]
  onCreate: (input: EventInput) => string
  onUpdate: (id: string, patch: Partial<MapEvent>) => void
  onDelete: (id: string) => void
  onDeletePast: (ids: string[]) => void
  onPreview: (event: MapEvent) => void
  onClose: () => void
  now?: Date
}

const filterLabels: Record<EventLifecycleStatus, string> = {
  upcoming: 'Bevorstehend',
  draft: 'Entwürfe',
  past: 'Vergangen',
}

const emptyFilterCopy: Record<EventLifecycleStatus, { title: string; description: string }> = {
  upcoming: { title: 'Keine bevorstehenden Termine', description: 'Neue veröffentlichte Veranstaltungen erscheinen automatisch hier.' },
  draft: { title: 'Keine Entwürfe', description: 'Ausgeblendete Veranstaltungen werden hier gesammelt.' },
  past: { title: 'Noch keine vergangenen Termine', description: 'Abgelaufene Veranstaltungen werden automatisch archiviert.' },
}

type EventListView = 'list' | 'calendar'

const eventTemplates: Array<{ id: string; label: string; title: string; description: string; duration: number }> = [
  { id: 'feeding', label: 'Fütterung', title: 'Fütterung', description: 'Erleben Sie die Fütterung und erfahren Sie Wissenswertes von unserem Tierpflege-Team.', duration: 30 },
  { id: 'tour', label: 'Führung', title: 'Zooführung', description: 'Geführter Rundgang mit spannenden Einblicken in die Tierwelt.', duration: 60 },
  { id: 'show', label: 'Show', title: 'Tiershow', description: 'Eine moderierte Vorführung für unsere Besucherinnen und Besucher.', duration: 30 },
  { id: 'workshop', label: 'Workshop', title: 'Zoo-Workshop', description: 'Ein interaktives Lernangebot für kleine und große Zoofans.', duration: 60 },
]

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

function clockTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function addMinutes(time: string, minutes: number): string {
  const [hours, currentMinutes] = time.split(':').map(Number)
  const total = (hours * 60 + currentMinutes + minutes) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function weekdayForDate(value: string): Weekday {
  const index = new Date(`${value}T12:00:00Z`).getUTCDay()
  return weekdayLabels[(index + 6) % 7]?.value ?? 'monday'
}

function emptyEventDraft(now = new Date()): EventInput {
  const nextHour = new Date(now)
  nextHour.setMinutes(0, 0, 0)
  nextHour.setHours(nextHour.getHours() + 1)
  const startDate = localDateString(nextHour)
  return {
    title: 'Neue Veranstaltung',
    description: '',
    location: '',
    relatedItemId: null,
    startDate,
    startTime: clockTimeString(nextHour),
    endTime: null,
    recurrence: { frequency: 'once', interval: 1, weekdays: [], monthDays: [], endsOn: null, excludedDates: [] },
    visible: false,
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

function recurrenceNeedsAdvancedOptions(event: EventInput): boolean {
  const { recurrence } = event
  return recurrence.interval > 1
    || Boolean(recurrence.endsOn)
    || recurrence.excludedDates.length > 0
    || recurrence.weekdays.length > 1
    || recurrence.monthDays.length > 1
}

function calendarMonthString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function calendarDays(month: string): Array<string | null> {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstWeekday = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`),
  ]
}

export function EventManager({ open, events, items, onCreate, onUpdate, onDelete, onDeletePast, onPreview, onClose, now }: EventManagerProps) {
  const clock = useMemo(() => now ?? new Date(), [now, open])
  const sortedEvents = useMemo(() => [...events].sort((a, b) => {
    const leftOccurrence = nextEventOccurrence(a, clock)
    const rightOccurrence = nextEventOccurrence(b, clock)
    const leftKey = leftOccurrence ? `${leftOccurrence.date}T${leftOccurrence.time}` : `${a.startDate}T${a.startTime}`
    const rightKey = rightOccurrence ? `${rightOccurrence.date}T${rightOccurrence.time}` : `${b.startDate}T${b.startTime}`
    return leftKey.localeCompare(rightKey)
  }), [events, clock])
  const [activeFilter, setActiveFilter] = useState<EventLifecycleStatus>('upcoming')
  const filteredEvents = sortedEvents.filter((event) => eventLifecycleStatus(event, clock) === activeFilter)
  const filterCounts = events.reduce<Record<EventLifecycleStatus, number>>((counts, event) => {
    counts[eventLifecycleStatus(event, clock)] += 1
    return counts
  }, { upcoming: 0, draft: 0, past: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteRequest, setDeleteRequest] = useState<'selected' | 'past' | null>(null)
  const [closeWarningOpen, setCloseWarningOpen] = useState(false)
  const [listView, setListView] = useState<EventListView>('list')
  const [calendarMonth, setCalendarMonth] = useState(() => calendarMonthString(now ?? new Date()))
  const [advancedRecurrence, setAdvancedRecurrence] = useState(false)
  const [exceptionDate, setExceptionDate] = useState('')
  const selectedEvent = events.find((event) => event.id === selectedId) ?? null
  const [draft, setDraft] = useState<EventInput>(() => emptyEventDraft(now ?? new Date()))
  const [baseline, setBaseline] = useState<EventInput>(() => emptyEventDraft(now ?? new Date()))
  const draftDirty = JSON.stringify(draft) !== JSON.stringify(baseline)
  const monthDays = useMemo(() => calendarDays(calendarMonth), [calendarMonth])
  const calendarLabel = useMemo(() => new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date(`${calendarMonth}-15T12:00:00`)), [calendarMonth])

  useEffect(() => {
    if (!open) return
    const nextId = selectedId && filteredEvents.some((event) => event.id === selectedId) ? selectedId : filteredEvents[0]?.id ?? null
    const nextDraft = nextId ? eventToDraft(events.find((event) => event.id === nextId)!) : emptyEventDraft(clock)
    setSelectedId(nextId)
    setDraft(nextDraft)
    setBaseline(nextDraft)
    setAdvancedRecurrence(recurrenceNeedsAdvancedOptions(nextDraft))
    setCalendarMonth(calendarMonthString(clock))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !selectedEvent) return
    const nextDraft = eventToDraft(selectedEvent)
    setDraft(nextDraft)
    setBaseline(nextDraft)
    setAdvancedRecurrence(recurrenceNeedsAdvancedOptions(nextDraft))
  }, [open, selectedEvent?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const requestClose = useCallback(() => {
    if (draftDirty) setCloseWarningOpen(true)
    else onClose()
  }, [draftDirty, onClose])

  useEffect(() => {
    if (!open) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || deleteRequest || closeWarningOpen) return
      event.preventDefault()
      requestClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [closeWarningOpen, deleteRequest, open, requestClose])

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
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const publish = submitter?.value === 'publish'
    const normalized: EventInput = {
      ...draft,
      visible: publish,
      title: draft.title.trim(),
      description: draft.description.trim(),
      location: draft.location.trim(),
      endTime: draft.endTime || null,
      recurrence: {
        ...draft.recurrence,
        weekdays: draft.recurrence.frequency === 'weekly' ? draft.recurrence.weekdays : [],
        monthDays: draft.recurrence.frequency === 'monthly' ? draft.recurrence.monthDays : [],
        endsOn: draft.recurrence.frequency === 'once' ? null : draft.recurrence.endsOn,
        excludedDates: draft.recurrence.frequency === 'once' ? [] : [...draft.recurrence.excludedDates].sort(),
      },
    }
    if (!normalized.title) return
    const statusPreview: MapEvent = {
      id: selectedEvent?.id ?? 'new-event',
      createdAt: selectedEvent?.createdAt ?? clock.toISOString(),
      updatedAt: clock.toISOString(),
      ...normalized,
    }
    setActiveFilter(eventLifecycleStatus(statusPreview, clock))
    if (selectedEvent) onUpdate(selectedEvent.id, normalized)
    else setSelectedId(onCreate(normalized))
    setDraft(normalized)
    setBaseline(normalized)
  }

  const createNew = () => {
    const nextDraft = emptyEventDraft(clock)
    setActiveFilter('draft')
    setSelectedId(null)
    setDraft(nextDraft)
    setBaseline(nextDraft)
    setAdvancedRecurrence(false)
  }

  const duplicateSelected = () => {
    if (!selectedEvent) return
    const copy: EventInput = {
      ...eventToDraft(selectedEvent),
      title: `${selectedEvent.title} (Kopie)`,
      visible: false,
    }
    const id = onCreate(copy)
    setActiveFilter('draft')
    setSelectedId(id)
    setDraft(copy)
    setBaseline(copy)
    setAdvancedRecurrence(recurrenceNeedsAdvancedOptions(copy))
  }

  const applyTemplate = (templateId: string) => {
    const template = eventTemplates.find((candidate) => candidate.id === templateId)
    if (!template) return
    setDraft((current) => ({
      ...current,
      title: template.title,
      description: template.description,
      endTime: addMinutes(current.startTime, template.duration),
    }))
  }

  const removeSelected = () => {
    if (!selectedEvent) return
    onDelete(selectedEvent.id)
    const next = filteredEvents.find((event) => event.id !== selectedEvent.id) ?? null
    const nextDraft = next ? eventToDraft(next) : emptyEventDraft(clock)
    setSelectedId(next?.id ?? null)
    setDraft(nextDraft)
    setBaseline(nextDraft)
  }

  const removePastEvents = () => {
    const ids = filteredEvents.map((event) => event.id)
    if (ids.length === 0) return
    onDeletePast(ids)
    const nextDraft = emptyEventDraft(clock)
    setSelectedId(null)
    setDraft(nextDraft)
    setBaseline(nextDraft)
  }

  const selectFilter = (filter: EventLifecycleStatus) => {
    setActiveFilter(filter)
    const next = sortedEvents.find((event) => eventLifecycleStatus(event, clock) === filter) ?? null
    const nextDraft = next ? eventToDraft(next) : emptyEventDraft(clock)
    setSelectedId(next?.id ?? null)
    setDraft(nextDraft)
    setBaseline(nextDraft)
    setAdvancedRecurrence(recurrenceNeedsAdvancedOptions(nextDraft))
  }

  const selectEvent = (event: MapEvent) => {
    const nextDraft = eventToDraft(event)
    setSelectedId(event.id)
    setDraft(nextDraft)
    setBaseline(nextDraft)
    setAdvancedRecurrence(recurrenceNeedsAdvancedOptions(nextDraft))
  }

  const selectRelatedItem = (itemId: string) => setDraft((current) => {
    const previousTitle = items.find((item) => item.id === current.relatedItemId)?.title ?? ''
    const nextItem = items.find((item) => item.id === itemId)
    const shouldFillLocation = !current.location.trim() || current.location === previousTitle
    return {
      ...current,
      relatedItemId: itemId || null,
      location: shouldFillLocation ? nextItem?.title ?? '' : current.location,
    }
  })

  const addException = () => {
    if (!exceptionDate || draft.recurrence.excludedDates.includes(exceptionDate)) return
    setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, excludedDates: [...current.recurrence.excludedDates, exceptionDate].sort() } }))
    setExceptionDate('')
  }

  const moveCalendarMonth = (offset: number) => {
    const [year, month] = calendarMonth.split('-').map(Number)
    setCalendarMonth(calendarMonthString(new Date(year, month - 1 + offset, 1)))
  }

  const repeatUnit = draft.recurrence.frequency === 'daily' ? 'Tage' : draft.recurrence.frequency === 'weekly' ? 'Wochen' : 'Monate'

  return (
    <div className="modal-backdrop event-manager-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <section className="modal event-manager" role="dialog" aria-modal="true" aria-labelledby="events-title">
        <header className="event-manager-header">
          <div className="event-manager-heading"><span className="event-manager-icon"><CalendarDays size={22} /></span><div><span className="eyebrow">Zoo-Programm</span><h2 id="events-title">Veranstaltungen</h2><p>Fütterungen, Führungen und weitere Termine planen.</p></div></div>
          <button className="icon-button" onClick={requestClose} aria-label="Schließen"><X size={18} /></button>
        </header>

        <div className="event-manager-body">
          <aside className="event-list-pane">
            <div className="event-list-toolbar">
              <div><strong>{events.length} Termine</strong><span>{events.filter((event) => event.visible).length} veröffentlicht</span></div>
              <div className="event-list-toolbar-actions">
                <div className="event-view-toggle" aria-label="Darstellung">
                  <button type="button" className={listView === 'list' ? 'is-active' : ''} aria-label="Listenansicht" onClick={() => setListView('list')}><List size={14} /></button>
                  <button type="button" className={listView === 'calendar' ? 'is-active' : ''} aria-label="Kalenderansicht" onClick={() => setListView('calendar')}><CalendarRange size={14} /></button>
                </div>
                <button className="button event-add-button" onClick={createNew}><Plus size={15} />Neu</button>
              </div>
            </div>
            <div className="event-list-filters" role="tablist" aria-label="Terminstatus">
              {(Object.keys(filterLabels) as EventLifecycleStatus[]).map((filter) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === filter}
                  className={activeFilter === filter ? 'is-active' : ''}
                  key={filter}
                  onClick={() => selectFilter(filter)}
                >
                  {filterLabels[filter]} <span>{filterCounts[filter]}</span>
                </button>
              ))}
            </div>
            <div className="event-list-content">
              {activeFilter === 'past' && filteredEvents.length > 0 ? (
                <div className="event-past-actions">
                  <span>{filteredEvents.length} archiviert</span>
                  <button type="button" onClick={() => setDeleteRequest('past')}><Trash2 size={12} />Alle löschen</button>
                </div>
              ) : null}
              {listView === 'list' ? (
                <div className="event-list">
                  {filteredEvents.map((event) => (
                    <button key={event.id} className={`event-list-card${event.id === selectedId ? ' is-selected' : ''}${event.visible ? '' : ' is-hidden'}`} onClick={() => selectEvent(event)}>
                      <span className="event-date-tile"><strong>{event.startDate.slice(-2)}</strong><small>{new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' }).format(new Date(`${event.startDate}T12:00:00Z`))}</small></span>
                      <span className="event-list-copy"><strong>{event.title}</strong><span><Clock3 size={12} />{event.startTime}{event.endTime ? `–${event.endTime}` : ''}</span><small><Repeat2 size={11} />{recurrenceSummary(event)}</small></span>
                    </button>
                  ))}
                  {filteredEvents.length === 0 && <div className="event-empty"><CalendarDays size={28} /><strong>{emptyFilterCopy[activeFilter].title}</strong><span>{emptyFilterCopy[activeFilter].description}</span></div>}
                </div>
              ) : (
                <div className="event-calendar">
                  <div className="event-calendar-header"><button type="button" aria-label="Vorheriger Monat" onClick={() => moveCalendarMonth(-1)}><ChevronLeft size={15} /></button><strong>{calendarLabel}</strong><button type="button" aria-label="Nächster Monat" onClick={() => moveCalendarMonth(1)}><ChevronRight size={15} /></button></div>
                  <div className="event-calendar-weekdays">{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => <span key={day}>{day}</span>)}</div>
                  <div className="event-calendar-grid">
                    {monthDays.map((date, index) => {
                      const dayEvents = date ? filteredEvents.filter((event) => eventOccursOnDate(event, date)) : []
                      return <div className={`event-calendar-day${date === localDateString(clock) ? ' is-today' : ''}`} key={date ?? `empty-${index}`}>{date ? <><span>{Number(date.slice(-2))}</span>{dayEvents.slice(0, 2).map((event) => <button type="button" key={event.id} className={event.id === selectedId ? 'is-selected' : ''} title={`${event.startTime} · ${event.title}`} onClick={() => selectEvent(event)}>{event.startTime} {event.title}</button>)}{dayEvents.length > 2 ? <small>+{dayEvents.length - 2}</small> : null}</> : null}</div>
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>

          <form className="event-editor" onSubmit={submit}>
            <div className="event-editor-scroll">
              <div className="event-form-title">
                <div><span className="eyebrow">{selectedEvent ? 'Termin bearbeiten' : 'Neuer Termin'}</span><h3>{draft.title || 'Unbenannte Veranstaltung'}</h3></div>
                <div className="event-form-header-actions">
                  <span className={`event-status-badge ${draft.visible ? 'is-published' : 'is-draft'}`}>{draft.visible ? 'Veröffentlicht' : 'Entwurf'}{draftDirty ? ' · Nicht gespeichert' : ''}</span>
                  {selectedEvent ? <button type="button" className="button ghost compact" onClick={duplicateSelected}><Copy size={13} />Duplizieren</button> : null}
                  {selectedEvent ? <button type="button" className="button ghost compact" disabled={draftDirty} title={draftDirty ? 'Änderungen zuerst speichern' : undefined} onClick={() => onPreview(selectedEvent)}><CalendarRange size={13} />Im Simulator anzeigen</button> : null}
                </div>
              </div>

              {!selectedEvent ? (
                <section className="event-template-section" aria-label="Vorlage wählen">
                  <div><strong>Schnellstart mit Vorlage</strong><span>Datum, Uhrzeit und Kartenpunkt können danach angepasst werden.</span></div>
                  <div className="event-template-grid">
                    {eventTemplates.map((template) => <button type="button" key={template.id} onClick={() => applyTemplate(template.id)}><strong>{template.label}</strong><span>{template.duration} Min.</span></button>)}
                  </div>
                </section>
              ) : null}

              <section className="event-form-section">
                <h4>Allgemein</h4>
                <label className="field"><span>Name</span><input required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Zum Beispiel Pinguinfütterung" /></label>
                <label className="field"><span>Beschreibung</span><textarea rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Was erwartet die Besucher?" /></label>
                <div className="event-form-grid two-columns">
                  <label className="field"><span><MapPin size={13} /> Ort</span><input value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Pinguinanlage" /></label>
                  <label className="field"><span>Kartenpunkt</span><select value={draft.relatedItemId ?? ''} onChange={(event) => selectRelatedItem(event.target.value)}><option value="">Kein Kartenpunkt</option>{items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
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

                {draft.recurrence.frequency !== 'once' ? (
                  <>
                    <button type="button" className="recurrence-advanced-toggle" aria-expanded={advancedRecurrence} onClick={() => setAdvancedRecurrence((current) => !current)}><Repeat2 size={13} />{advancedRecurrence ? 'Erweiterte Optionen ausblenden' : 'Erweiterte Optionen'}</button>
                    {!advancedRecurrence ? <p className="recurrence-simple-summary">{draft.recurrence.frequency === 'daily' ? 'Wird jeden Tag wiederholt.' : draft.recurrence.frequency === 'weekly' ? `Wird jeden ${weekdayLabels.find((day) => day.value === draft.recurrence.weekdays[0])?.long ?? 'gewählten Wochentag'} wiederholt.` : `Wird monatlich am ${draft.recurrence.monthDays[0] ?? Number(draft.startDate.slice(-2))}. wiederholt.`}</p> : null}
                    {advancedRecurrence ? <div className="recurrence-options">
                      <label className="repeat-interval"><span>Wiederholen alle</span><input type="number" min="1" max="52" value={draft.recurrence.interval} onChange={(event) => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, interval: Math.min(52, Math.max(1, Number(event.target.value) || 1)) } }))} /><strong>{repeatUnit}</strong></label>

                      {draft.recurrence.frequency === 'weekly' && <div className="weekday-picker"><span>An diesen Tagen</span><div>{weekdayLabels.map((weekday) => <button type="button" key={weekday.value} title={weekday.long} aria-pressed={draft.recurrence.weekdays.includes(weekday.value)} className={draft.recurrence.weekdays.includes(weekday.value) ? 'is-active' : ''} onClick={() => toggleWeekday(weekday.value)}>{weekday.short}</button>)}</div></div>}

                      {draft.recurrence.frequency === 'monthly' && <div className="monthday-picker"><span>An diesen Kalendertagen</span><div>{Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <button type="button" key={day} aria-label={`${day}. Tag des Monats`} aria-pressed={draft.recurrence.monthDays.includes(day)} className={draft.recurrence.monthDays.includes(day) ? 'is-active' : ''} onClick={() => toggleMonthDay(day)}>{day}</button>)}</div><small>In kürzeren Monaten wird der letzte verfügbare Tag verwendet.</small></div>}

                      <label className="repeat-end-row"><input type="checkbox" checked={Boolean(draft.recurrence.endsOn)} onChange={(event) => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, endsOn: event.target.checked ? current.startDate : null } }))} /><span><strong>Enddatum festlegen</strong><small>Ohne Enddatum läuft die Wiederholung dauerhaft.</small></span>{draft.recurrence.endsOn && <input type="date" min={draft.startDate} value={draft.recurrence.endsOn} onChange={(event) => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, endsOn: event.target.value } }))} />}</label>

                      <div className="recurrence-exceptions"><div><strong>Ausnahmen</strong><small>An diesen Tagen findet der Termin nicht statt.</small></div><div className="recurrence-exception-add"><input aria-label="Ausnahmedatum" type="date" min={draft.startDate} value={exceptionDate} onChange={(event) => setExceptionDate(event.target.value)} /><button type="button" className="button ghost compact" disabled={!exceptionDate} onClick={addException}><Plus size={12} />Hinzufügen</button></div>{draft.recurrence.excludedDates.length > 0 ? <div className="recurrence-exception-list">{draft.recurrence.excludedDates.map((date) => <span key={date}>{formatEventDate(date)}<button type="button" aria-label={`Ausnahme ${date} entfernen`} onClick={() => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, excludedDates: current.recurrence.excludedDates.filter((value) => value !== date) } }))}><X size={11} /></button></span>)}</div> : null}</div>
                    </div> : null}
                  </>
                ) : null}
              </section>
            </div>

            <footer className="event-editor-actions">
              {selectedEvent ? <button type="button" className="button danger-ghost" onClick={() => setDeleteRequest('selected')}><Trash2 size={15} />Löschen</button> : <span />}
              <div><button type="button" className="button ghost" onClick={requestClose}>Abbrechen</button><button type="submit" name="eventStatus" value="draft" className="button ghost">Als Entwurf speichern</button><button type="submit" name="eventStatus" value="publish" className="button primary">{selectedEvent && draft.visible ? 'Änderungen veröffentlichen' : 'Veröffentlichen'}</button></div>
            </footer>
          </form>
        </div>
      </section>
      <ConfirmDialog
        open={deleteRequest === 'selected'}
        title={`„${selectedEvent?.title ?? 'Veranstaltung'}“ löschen?`}
        description="Die Veranstaltung wird gelöscht. Sie können diese Aktion mit Strg+Z rückgängig machen."
        onConfirm={removeSelected}
        onClose={() => setDeleteRequest(null)}
      />
      <ConfirmDialog
        open={deleteRequest === 'past'}
        title="Alle vergangenen Veranstaltungen löschen?"
        description={`${filteredEvents.length} archivierte Veranstaltungen werden gemeinsam gelöscht. Einmal Strg+Z stellt die gesamte Gruppe wieder her.`}
        confirmLabel="Alle löschen"
        onConfirm={removePastEvents}
        onClose={() => setDeleteRequest(null)}
      />
      <ConfirmDialog
        open={closeWarningOpen}
        title="Ungespeicherte Änderungen verwerfen?"
        description="Ihre Änderungen an diesem Termin wurden noch nicht gespeichert."
        confirmLabel="Änderungen verwerfen"
        danger={false}
        onConfirm={onClose}
        onClose={() => setCloseWarningOpen(false)}
      />
    </div>
  )
}
