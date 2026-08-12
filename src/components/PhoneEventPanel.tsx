import { CalendarDays, Clock3, LocateFixed, MapPin, Repeat2, X } from 'lucide-react'
import type { MapEvent, MapItem, Weekday } from '../domain/models'

interface PhoneEventPanelProps {
  events: readonly MapEvent[]
  items: readonly MapItem[]
  onFocusItem: (itemId: string) => void
  onClose: () => void
}

export interface EventOccurrence {
  event: MapEvent
  date: string
  time: string
}

const weekdayLabels: Record<Weekday, string> = {
  monday: 'Mo',
  tuesday: 'Di',
  wednesday: 'Mi',
  thursday: 'Do',
  friday: 'Fr',
  saturday: 'Sa',
  sunday: 'So',
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`))
}

function localDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function utcDate(value: string): Date {
  return new Date(`${value}T12:00:00Z`)
}

function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function dayDifference(left: string, right: string): number {
  return Math.round((utcDate(left).getTime() - utcDate(right).getTime()) / 86_400_000)
}

function weekdayIndex(value: string): number {
  return (utcDate(value).getUTCDay() + 6) % 7
}

function daysInMonth(value: string): number {
  const [year, month] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function matchesRecurrence(event: MapEvent, date: string): boolean {
  const { recurrence } = event
  const difference = dayDifference(date, event.startDate)
  if (difference < 0) return false
  if (recurrence.frequency === 'daily') return difference % recurrence.interval === 0
  if (recurrence.frequency === 'weekly') {
    const weekStart = dayDifference(date, event.startDate) + weekdayIndex(event.startDate) - weekdayIndex(date)
    const weekIndex = Math.floor(weekStart / 7)
    const weekday = Object.keys(weekdayLabels)[weekdayIndex(date)] as Weekday
    return weekIndex >= 0 && weekIndex % recurrence.interval === 0 && recurrence.weekdays.includes(weekday)
  }
  if (recurrence.frequency === 'monthly') {
    const [startYear, startMonth] = event.startDate.split('-').map(Number)
    const [year, month, day] = date.split('-').map(Number)
    const monthDifference = (year - startYear) * 12 + month - startMonth
    const scheduledDays = new Set(recurrence.monthDays.map((value) => Math.min(value, daysInMonth(date))))
    return monthDifference >= 0 && monthDifference % recurrence.interval === 0 && scheduledDays.has(day)
  }
  return date === event.startDate
}

export function nextEventOccurrence(event: MapEvent, now = new Date()): EventOccurrence | null {
  if (!event.visible) return null
  const today = localDateString(now)
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  if (event.recurrence.frequency === 'once') {
    if (`${event.startDate}T${event.startTime}` < `${today}T${currentTime}`) return null
    return { event, date: event.startDate, time: event.startTime }
  }

  const firstCandidate = event.startDate > today ? event.startDate : today
  const cursor = utcDate(firstCandidate)
  for (let offset = 0; offset < 3660; offset += 1) {
    const date = utcDateString(cursor)
    if (event.recurrence.endsOn && date > event.recurrence.endsOn) return null
    const timeHasNotPassed = date !== today || event.startTime >= currentTime
    if (timeHasNotPassed && matchesRecurrence(event, date)) return { event, date, time: event.startTime }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return null
}

export function nextVisibleEventOccurrence(events: readonly MapEvent[], now = new Date()): EventOccurrence | null {
  return events
    .map((event) => nextEventOccurrence(event, now))
    .filter((occurrence): occurrence is EventOccurrence => Boolean(occurrence))
    .sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`))[0] ?? null
}

export function eventRecurrenceLabel(event: MapEvent): string {
  const { recurrence } = event
  if (recurrence.frequency === 'once') return formatDate(event.startDate)
  if (recurrence.frequency === 'daily') return recurrence.interval === 1 ? 'Täglich' : `Alle ${recurrence.interval} Tage`
  if (recurrence.frequency === 'weekly') {
    const days = recurrence.weekdays.map((day) => weekdayLabels[day]).join(', ')
    return recurrence.interval === 1 ? `Wöchentlich · ${days}` : `Alle ${recurrence.interval} Wochen · ${days}`
  }
  const days = recurrence.monthDays.map((day) => `${day}.`).join(', ')
  return recurrence.interval === 1 ? `Monatlich · ${days}` : `Alle ${recurrence.interval} Monate · ${days}`
}

export function PhoneEventPanel({ events, items, onFocusItem, onClose }: PhoneEventPanelProps) {
  const visibleEvents = [...events]
    .filter((event) => event.visible)
    .sort((left, right) => `${left.startDate}T${left.startTime}`.localeCompare(`${right.startDate}T${right.startTime}`))
  const itemsById = new Map(items.map((item) => [item.id, item]))

  return (
    <div className="map-client-events__overlay" onClick={onClose}>
      <section
        className="map-client-events__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-client-events-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="map-client-events__header">
          <span className="map-client-events__header-icon" aria-hidden="true"><CalendarDays size={19} strokeWidth={1.9} /></span>
          <div>
            <span>Zoo-Programm</span>
            <h2 id="map-client-events-title">Veranstaltungen</h2>
          </div>
          <button type="button" aria-label="Veranstaltungen schließen" onClick={onClose}><X size={15} strokeWidth={2} /></button>
        </header>

        <div className="map-client-events__scroll">
          {visibleEvents.length > 0 ? (
            <div className="map-client-events__list">
              {visibleEvents.map((event) => {
                const relatedItem = event.relatedItemId ? itemsById.get(event.relatedItemId) : undefined
                const location = event.location || relatedItem?.title || ''
                return (
                  <article className="map-client-events__card" key={event.id}>
                    <div className="map-client-events__date">
                      <strong>{event.startDate.slice(-2)}</strong>
                      <span>{new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' }).format(new Date(`${event.startDate}T12:00:00Z`))}</span>
                    </div>
                    <div className="map-client-events__card-content">
                      <h3>{event.title}</h3>
                      <div className="map-client-events__time"><Clock3 size={12} />{event.startTime}{event.endTime ? `–${event.endTime}` : ''} Uhr</div>
                      <div className="map-client-events__repeat"><Repeat2 size={11} />{eventRecurrenceLabel(event)}</div>
                      {location ? <div className="map-client-events__location"><MapPin size={12} />{location}</div> : null}
                      {event.description ? <p>{event.description}</p> : null}
                      {relatedItem ? (
                        <button
                          type="button"
                          className="map-client-events__locate"
                          onClick={() => onFocusItem(relatedItem.id)}
                        >
                          <LocateFixed size={14} strokeWidth={1.9} />
                          Auf der Karte zeigen
                        </button>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="map-client-events__empty">
              <span aria-hidden="true"><CalendarDays size={28} strokeWidth={1.6} /></span>
              <strong>Keine Veranstaltungen</strong>
              <p>Zurzeit sind keine Termine für Besucher veröffentlicht.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
