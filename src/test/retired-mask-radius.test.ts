import {readFileSync} from 'node:fs'
import {expect, it} from 'vitest'
import {MapProjectSchema} from '../domain'
import {validatePublishedZooMap} from '../public-contract/published-zoo-map'

it('discards legacy mask settings from categories, markers and group members while preserving other data', () => {
  const {project} = JSON.parse(readFileSync('public/startup-template.json', 'utf8'))
  const expected = MapProjectSchema.parse(project)
  for (const category of project.categories) category.imageMaskRadius = 35
  for (const item of project.items.flatMap((item: {members?: unknown[]}) => [item, ...(item.members ?? [])])) {
    item.markerOverrides = {...item.markerOverrides, imageMaskRadius: 20}
  }
  const actual = MapProjectSchema.parse(project)
  expect(actual.categories).toEqual(expected.categories)
  expect(JSON.stringify(actual)).not.toContain('imageMaskRadius')
  expect(actual.items.map(item => item.position)).toEqual(expected.items.map(item => item.position))
})

it('ignores retired settings in older published maps', () => {
  const raw = JSON.parse(readFileSync('public/published-map.example.json', 'utf8'))
  raw.categories[0].imageMaskRadius = 25
  expect(JSON.stringify(validatePublishedZooMap(raw))).not.toContain('imageMaskRadius')
})
