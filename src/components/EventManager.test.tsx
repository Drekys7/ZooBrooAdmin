import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventManager, type EventInput } from './EventManager'

afterEach(cleanup)

describe('EventManager', () => {
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
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pinguinfütterung' } })
    fireEvent.change(screen.getByLabelText('Datum'), { target: { value: '2026-08-15' } })
    fireEvent.change(screen.getByLabelText('Beginn'), { target: { value: '11:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Wöchentlich' }))
    fireEvent.click(screen.getByTitle('Dienstag'))
    fireEvent.click(screen.getByRole('button', { name: 'Veranstaltung erstellen' }))

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
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Monatlich' }))
    fireEvent.click(screen.getByRole('button', { name: '15. Tag des Monats' }))
    fireEvent.click(screen.getByRole('button', { name: '28. Tag des Monats' }))

    expect(screen.getByRole('button', { name: '15. Tag des Monats' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '28. Tag des Monats' })).toHaveAttribute('aria-pressed', 'true')
  })
})
