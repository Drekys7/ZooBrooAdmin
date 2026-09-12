import { expect, it } from 'vitest'
import { dilateAlpha } from './background-outline'

it.each([0, 1, 2, 6])('matches alpha dilation at radius %s including transparent holes and edges', radius => {
  const width = 7, height = 5
  const alpha = Uint8ClampedArray.from({ length: width * height }, (_, i) => (i * 73) % 256)
  const expected = alpha.map((_, i) => {
    let max = 0
    const x = i % width, y = Math.floor(i / width)
    for (let dy = Math.max(0, y - radius); dy <= Math.min(height - 1, y + radius); dy++) {
      for (let dx = Math.max(0, x - radius); dx <= Math.min(width - 1, x + radius); dx++) max = Math.max(max, alpha[dy * width + dx])
    }
    return max
  })
  expect(dilateAlpha(alpha, width, height, radius)).toEqual(expected)
})
