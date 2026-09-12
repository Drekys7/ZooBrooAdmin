import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { FontSettings } from './FontSettings'
import { DEFAULT_TYPOGRAPHY } from '../domain/typography'

it('selects presets and restores the default', () => {
  const change = vi.fn()
  render(<FontSettings onChange={change} />)
  fireEvent.change(screen.getByLabelText('Schriftfamilie'), { target: { value: 'georgia' } })
  expect(change).toHaveBeenLastCalledWith({ ...DEFAULT_TYPOGRAPHY, preset: 'georgia' })
  fireEvent.click(screen.getByText('Standardschrift wiederherstellen'))
  expect(change).toHaveBeenLastCalledWith(DEFAULT_TYPOGRAPHY)
})

it('commits a font only after upload succeeds and reports errors', async () => {
  const change = vi.fn()
  const upload = vi.fn().mockRejectedValueOnce(new Error('Ungültige Schrift')).mockResolvedValueOnce('font-id')
  render(<FontSettings value={{ ...DEFAULT_TYPOGRAPHY, preset: 'custom' }} onChange={change} onUpload={upload} />)
  const file = new File(['font'], 'test.woff2')
  fireEvent.change(screen.getByLabelText('Normal / Variable Schrift'), { target: { files: [file] } })
  expect(await screen.findByRole('alert')).toHaveTextContent('Ungültige Schrift')
  expect(change).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Normal / Variable Schrift'), { target: { files: [file] } })
  await waitFor(() => expect(change).toHaveBeenCalledWith({ ...DEFAULT_TYPOGRAPHY, preset: 'custom', regularAssetId: 'font-id' }))
})
