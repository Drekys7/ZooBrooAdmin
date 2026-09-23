import {readFileSync} from 'node:fs'
import {expect, it} from 'vitest'
import {StartupTemplateSchema} from '../application/startup-template'
import {TEST_RELEASE_REVISION} from '../infrastructure/test-release-reset'

it('ships the exact approved September 24 export as the default for everyone', () => {
  const exported = JSON.parse(readFileSync('prepared-assets/baselines/approved-2026-09-24.json', 'utf8'))
  const {fontFiles, ...project} = exported
  const template = StartupTemplateSchema.parse(JSON.parse(readFileSync('public/startup-template.json', 'utf8')))
  expect(fontFiles).toEqual([])
  expect(template.project).toEqual(project)
  expect(template.project.items).toHaveLength(41)
  expect(template.project.items.flatMap(item => item.members ?? [])).toHaveLength(14)
  expect(TEST_RELEASE_REVISION).toBe('2026-09-24-approved-baseline-v1')
})
