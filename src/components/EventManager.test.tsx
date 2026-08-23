import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapEvent, MapItem } from '../domain'
import { EventManager, type EventInput } from './EventManager'

afterEach(cleanup)

describe('EventManager', () => {
  const mapItem: MapItem = {
    id: 'penguins', categoryId: 'animals', type: 'animal', title: 'Pinguine', subtitle: '', description: '',
    iconAssetId: null, imageAssetId: null, colorOverride: null, markerOverrides: null, position: { x: 0.4, y: 0.3 },
    facts: [], visible: true, createdAt: '2026-08-20T08:00:00.000Z', updatedAt: '2026-08-20T08:00:00.000Z',
  }

  it('creates a weekly event with calendar date, time and selected weekdays', () => {
    const onCreate = vi.fn((_input: EventInput) => 'feeding')

    render(
      <EventManager
        open
        events={[]}
        items={[]}
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onDeletePast={vi.fn()}
        onPreview={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pinguinfütterung' } })
    fireEvent.change(screen.getByLabelText('Datum'), { target: { value: '2026-08-15' } })
    fireEvent.change(screen.getByLabelText('Beginn'), { target: { value: '11:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Wöchentlich' }))
    fireEvent.click(screen.getByRole('button', { name: 'Erweiterte Optionen' }))
    fireEvent.click(screen.getByTitle('Dienstag'))
    fireEvent.click(screen.getByRole('button', { name: 'Veröffentlichen' }))

    expect(onCreate).toHaveBeenCalledOnce()
    const created = onCreate.mock.calls[0]![0]
    expect(created).toMatchObject({
      title: 'Pinguinfütterung',
      startDate: '2026-08-15',
      startTime: '11:00',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
      },
      visible: true,
    })
    expect(created.recurrence.weekdays).toContain('saturday')
  })

  it('offers selected calendar days for monthly repetition', () => {
    render(
      <EventManager
        open
        events={[]}
        items={[]}
        onCreate={vi.fn(() => 'tour')}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onDeletePast={vi.fn()}
        onPreview={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Monatlich' }))
    fireEvent.click(screen.getByRole('button', { name: 'Erweiterte Optionen' }))
    fireEvent.click(screen.getByRole('button', { name: '15. Tag des Monats' }))
    fireEvent.click(screen.getByRole('button', { name: '28. Tag des Monats' }))

    expect(screen.getByRole('button', { name: '15. Tag des Monats' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '28. Tag des Monats' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('starts at the next full hour, applies a template and saves an explicit draft', () => {
    const onCreate = vi.fn((_input: EventInput) => 'feeding')
    render(
      <EventManager
        open events={[]} items={[mapItem]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()}
        onDeletePast={vi.fn()} onPreview={vi.fn()} onClose={vi.fn()} now={new Date(2026, 7, 23, 15, 12)}
      />,
    )

    expect(screen.getByLabelText('Beginn')).toHaveValue('16:00')
    fireEvent.click(screen.getByRole('button', { name: 'Fütterung 30 Min.' }))
    fireEvent.change(screen.getByLabelText('Kartenpunkt'), { target: { value: 'penguins' } })
    fireEvent.click(screen.getByRole('button', { name: 'Als Entwurf speichern' }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Fütterung', startTime: '16:00', endTime: '16:30', relatedItemId: 'penguins', location: 'Pinguine', visible: false,
    }))
  })

  it('warns before closing a changed event editor', () => {
    const onClose = vi.fn()
    render(
      <EventManager
        open events={[]} items={[]} onCreate={vi.fn(() => 'new')} onUpdate={vi.fn()} onDelete={vi.fn()}
        onDeletePast={vi.fn()} onPreview={vi.fn()} onClose={onClose} now={new Date(2026, 7, 23, 15, 12)}
      />,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Geänderte Veranstaltung' } })
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))

    const warning = screen.getByRole('alertdialog', { name: 'Ungespeicherte Änderungen verwerfen?' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(within(warning).getByRole('button', { name: 'Änderungen verwerfen' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('stores excluded recurrence dates', () => {
    const onCreate = vi.fn((_input: EventInput) => 'feeding')
    render(
      <EventManager
        open events={[]} items={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()}
        onDeletePast={vi.fn()} onPreview={vi.fn()} onClose={vi.fn()} now={new Date(2026, 7, 23, 15, 12)}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Wöchentlich' }))
    fireEvent.click(screen.getByRole('button', { name: 'Erweiterte Optionen' }))
    fireEvent.change(screen.getByLabelText('Ausnahmedatum'), { target: { value: '2026-08-30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Veröffentlichen' }))

    expect(onCreate.mock.calls[0]![0].recurrence.excludedDates).toEqual(['2026-08-30'])
  })

  it('separates upcoming, draft and elapsed events automatically', () => {
    const onDeletePast = vi.fn()
    const baseEvent: MapEvent = {
      id: 'future',
      title: 'Morgen',
      description: '',
      location: '',
      relatedItemId: null,
      startDate: '2026-08-24',
      startTime: '10:00',
      endTime: null,
      recurrence: { frequency: 'once', interval: 1, weekdays: [], monthDays: [], endsOn: null, excludedDates: [] },
      visible: true,
      createdAt: '2026-08-20T08:00:00.000Z',
      updatedAt: '2026-08-20T08:00:00.000Z',
    }
    const events: MapEvent[] = [
      baseEvent,
      { ...baseEvent, id: 'draft', title: 'Versteckt', visible: false },
      { ...baseEvent, id: 'past', title: 'Gestern', startDate: '2026-08-22' },
    ]

    render(
      <EventManager
        open
        events={events}
        items={[]}
        onCreate={vi.fn(() => 'new')}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onDeletePast={onDeletePast}
        onPreview={vi.fn()}
        onClose={vi.fn()}
        now={new Date(2026, 7, 23, 12, 0)}
      />,
    )

    expect(screen.getByRole('button', { name: /Morgen/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gestern/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Entwürfe/ }))
    expect(screen.getByRole('button', { name: /Versteckt/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Morgen/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Vergangen/ }))
    expect(screen.getByRole('button', { name: /Gestern/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Versteckt/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Alle löschen' }))
    const confirmation = screen.getByRole('alertdialog', { name: 'Alle vergangenen Veranstaltungen löschen?' })
    expect(confirmation).toHaveTextContent('Einmal Strg+Z stellt die gesamte Gruppe wieder her.')
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Alle löschen' }))
    expect(onDeletePast).toHaveBeenCalledWith(['past'])
  })
})
