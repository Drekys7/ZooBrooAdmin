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
