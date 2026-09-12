import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MapCanvas } from './MapCanvas'
import { DEFAULT_MAP_SETTINGS } from '../domain'

afterEach(cleanup)
it('edits the shared accent and updates inherited theme tokens immediately', () => {
  const change = vi.fn()
  const props = { backgroundUrl: '/map.png', backgroundWidth: 1000, backgroundHeight: 600, items: [], categories: [], onMapSettingsChange: change }
  const ui = render(<MapCanvas {...props}/>)
  fireEvent.click(ui.getByRole('button', { name: 'Globale Einstellungen öffnen' }))
  fireEvent.change(ui.getByLabelText('Globale Akzentfarbe'), { target: { value: '#aa3366' } })
  expect(change).toHaveBeenCalledWith({ accentColor: '#aa3366' })
  ui.rerender(<MapCanvas {...props} mapSettings={{ ...DEFAULT_MAP_SETTINGS, accentColor: '#aa3366' }}/>)
  const root = ui.container.querySelector('.map-canvas') as HTMLElement
  expect(root.style.getPropertyValue('--map-accent')).toBe('#aa3366')
  expect(root.style.getPropertyValue('--map-accent-rgb')).toBe('170, 51, 102')
})
