import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FactIconManager } from './FactIconManager'
import { MapSettingsSchema } from '../domain/models'

afterEach(cleanup)

it('uploads a named icon and resets the form after saving', async () => {
  const onAdd = vi.fn().mockResolvedValue(undefined)
  render(<FactIconManager icons={[]} assetUrls={{}} onAdd={onAdd} onRename={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
  const file = new File(['image'], 'status.svg', { type: 'image/svg+xml' })
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Schutzstatus' } })
  fireEvent.change(screen.getByLabelText('Bild · PNG, WebP oder SVG'), { target: { files: [file] } })
  fireEvent.submit(screen.getByRole('button', { name: 'Symbol hinzufügen' }).closest('form')!)
  await waitFor(() => expect(onAdd).toHaveBeenCalledWith(file, 'Schutzstatus'))
  await waitFor(() => expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(''))
})

it('retains the catalogue when settings are serialized and parsed', () => {
  const icons = [{ id: 'uploaded-icon', label: 'Schutzstatus' }]
  const settings = MapSettingsSchema.parse({ factIcons: icons })
  expect(MapSettingsSchema.parse(JSON.parse(JSON.stringify(settings))).factIcons).toEqual(icons)
})

it('offers deletion only for custom symbols', () => {
  const onDelete = vi.fn()
  render(<FactIconManager icons={[{ id: 'custom', label: 'Schutzstatus' }]} assetUrls={{}} onAdd={vi.fn()} onRename={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Schutzstatus löschen' }))
  expect(onDelete).toHaveBeenCalledWith('custom')
  expect(screen.queryByRole('button', { name: 'Region löschen' })).toBeNull()
})
