import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FactIconPicker } from './FactIconPicker'

afterEach(cleanup)

it('lists named custom icons without an add option', () => {
  const onChange = vi.fn()
  render(<FactIconPicker label="Region" assetUrls={{}} onChange={onChange} customIcons={[{ id: 'custom', label: 'Schutzstatus' }]} />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom' } })
  expect(onChange).toHaveBeenCalledWith('custom')
  expect(screen.getByRole('option', { name: 'Schutzstatus' })).toBeTruthy()
  expect(screen.queryByText(/Neue Ikone hinzufügen/)).toBeNull()
})

it('selects a stored fact icon and allows the information fallback', () => {
  const onChange = vi.fn()
  render(<FactIconPicker value="zooweb-fact-region" label="Region" assetUrls={{}} onChange={onChange} />)
  const select = screen.getByRole('combobox', { name: 'Symbol für Region' })
  fireEvent.change(select, { target: { value: 'zooweb-fact-lifespan' } })
  expect(onChange).toHaveBeenLastCalledWith('zooweb-fact-lifespan')
  fireEvent.change(select, { target: { value: '' } })
  expect(onChange).toHaveBeenLastCalledWith(null)
})

it('preserves an existing custom icon until another is selected', () => {
  const onChange = vi.fn()
  render(<FactIconPicker value="custom-icon" label="Region" assetUrls={{ 'custom-icon': '/custom.png' }} onChange={onChange} />)
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('custom-icon')
  expect(screen.getByRole('option', { name: 'Benutzerdefiniert' })).toBeTruthy()
  expect(onChange).not.toHaveBeenCalled()
})
