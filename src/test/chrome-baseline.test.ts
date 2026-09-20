import {readFileSync} from 'node:fs'
import {expect, it} from 'vitest'
import {StartupTemplateSchema} from '../application/startup-template'
import {TEST_RELEASE_REVISION} from '../infrastructure/test-release-reset'

it('preserves the entire approved Chrome export without normalizing positions or appearance', () => {
  const exported = JSON.parse(readFileSync('prepared-assets/baselines/chrome-2026-09-20.json', 'utf8'))
  const {fontFiles, ...project} = exported
  const template = StartupTemplateSchema.parse(JSON.parse(readFileSync('public/startup-template.json', 'utf8')))
  expect(fontFiles).toEqual([])
  expect(template.project).toEqual(project)
  expect(template.project.items).toHaveLength(41)
  expect(template.project.items.flatMap(item => item.members ?? [])).toHaveLength(15)
  expect(TEST_RELEASE_REVISION).toBe('2026-09-20-chrome-baseline-v2')
})
