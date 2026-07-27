import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validatePublishedZooMap } from './published-zoo-map'

const examplePath = resolve('public/published-map.example.json')

function readExample(): unknown {
  return JSON.parse(readFileSync(examplePath, 'utf8'))
}

describe('PublishedZooMap public contract', () => {
  it('validates the published JSON example', () => {
    const snapshot = validatePublishedZooMap(readExample())

    expect(snapshot.schemaVersion).toBe(1)
    expect(snapshot.items).toHaveLength(2)
    expect(snapshot.background.color).toBe('#DDE7D3')
    expect(snapshot.categories.map((category) => category.markerStyle)).toEqual(['image', 'circle'])
    expect(snapshot.categories.map((category) => category.iconScale)).toEqual([1, 1.2])
    expect(snapshot.categories.map((category) => category.iconContentScale)).toEqual([1, 0.9])
    expect(snapshot.categories.map((category) => category.outlineEnabled)).toEqual([true, false])
    expect(snapshot.categories.map((category) => category.outlineWidth)).toEqual([2, 2])
    expect(snapshot.categories.map((category) => category.outlineColor)).toEqual(['#FF0000', '#FF0000'])
    expect(snapshot.items.map((item) => item.colorOverride)).toEqual([null, '#D47B32'])
  })

  it('uses the legacy gray background when an older snapshot has no color', () => {
    const example = readExample() as {
      background: { color?: string }
    }
    delete example.background.color

    expect(validatePublishedZooMap(example).background.color).toBe('#DDDDDD')
  })

  it('rejects coordinates outside the normalized range', () => {
    const example = readExample() as {
      items: Array<{ position: { x: number; y: number } }>
    }
    example.items[0].position.x = 1.01

    expect(() => validatePublishedZooMap(example)).toThrow()
  })

  it('rejects item references to missing categories', () => {
    const example = readExample() as {
      items: Array<{ categoryId: string }>
    }
    example.items[0].categoryId = 'category-does-not-exist'

    expect(() => validatePublishedZooMap(example)).toThrow(
      'Unknown category id',
    )
  })
})
