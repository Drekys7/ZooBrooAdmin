import { expect, it } from 'vitest'
import { accentVariables, DEFAULT_ACCENT_COLOR } from '../domain/accent'
import { createEmptyProject } from '../domain'
import { buildPublishedSnapshot, exportProjectToJson, importProjectFromJson, setBackground, updateMapSettings } from '../application'

it('provides default colors and readable foregrounds for dark and light accents', () => {
  expect(accentVariables()['--map-accent']).toBe(DEFAULT_ACCENT_COLOR)
  expect(accentVariables('#FFFFFF')['--map-accent-on']).toBe('#000000')
  expect(accentVariables('#000000')['--map-accent-on']).toBe('#FFFFFF')
  expect(accentVariables('#AA3366')['--map-accent-rgb']).toBe('170, 51, 102')
  expect(accentVariables('#FFFFFF')['--map-accent-ink']).not.toBe('rgb(255, 255, 255)')
})

it('saves and publishes the shared accent and rejects invalid values', () => {
  const original = setBackground(createEmptyProject(), { assetId: 'map', width: 1000, height: 600 })
  const project = updateMapSettings(original, { patch: { accentColor: '#AA3366' } })
  expect(importProjectFromJson(exportProjectToJson(project)).mapSettings.accentColor).toBe('#AA3366')
  expect(buildPublishedSnapshot(project, 1).mapSettings.accentColor).toBe('#AA3366')
  expect(() => updateMapSettings(original, { patch: { accentColor: 'red' } })).toThrow()
})
