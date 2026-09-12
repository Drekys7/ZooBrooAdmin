import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMouseDragScroll } from './useMouseDragScroll'

afterEach(cleanup)

function setup(axis: 'x' | 'y' = 'x') {
  const click = vi.fn()
  function Strip() {
    const handlers = useMouseDragScroll(axis)
    return <div data-testid="strip" {...handlers}><button onClick={click}>Entry</button></div>
  }
  const result = render(<Strip />)
  const strip = result.getByTestId('strip')
  const button = result.getByRole('button')
  Object.defineProperties(strip, {
    clientWidth: { value: 300 }, scrollWidth: { value: 700 },
    clientHeight: { value: 500 }, scrollHeight: { value: 1100 },
  })
  return { ...result, strip, button, click }
}

describe('mouse drag scrolling', () => {
  it.each(['x', 'y'] as const)('pans on the %s axis and suppresses the drag click', (axis) => {
    const { strip, button, click } = setup(axis)
    fireEvent.mouseDown(button, { button: 0, clientX: 200, clientY: 200 })
    fireEvent.mouseMove(window, { buttons: 1, clientX: axis === 'x' ? 120 : 200, clientY: axis === 'y' ? 120 : 200 })
    expect(axis === 'x' ? strip.scrollLeft : strip.scrollTop).toBe(80)
    expect(strip).toHaveAttribute('data-mouse-dragging', 'true')
    fireEvent.mouseUp(window)
    expect(strip).not.toHaveAttribute('data-mouse-dragging')
    fireEvent.click(button, { detail: 1 })
    expect(click).not.toHaveBeenCalled()
    fireEvent.mouseDown(button, { button: 0, clientX: 200, clientY: 200 })
    fireEvent.mouseUp(window)
    fireEvent.click(button, { detail: 1 })
    expect(click).toHaveBeenCalledOnce()
  })

  it('keeps small movements, right clicks and keyboard activation from becoming drags', () => {
    const { strip, button, click } = setup()
    fireEvent.mouseDown(button, { button: 0, clientX: 100 })
    fireEvent.mouseMove(window, { buttons: 1, clientX: 97 })
    fireEvent.mouseUp(window)
    fireEvent.click(button, { detail: 1 })
    expect(strip.scrollLeft).toBe(0)
    expect(click).toHaveBeenCalledOnce()
    fireEvent.mouseDown(button, { button: 2, clientX: 100 })
    fireEvent.mouseMove(window, { buttons: 2, clientX: 20 })
    expect(strip.scrollLeft).toBe(0)
    fireEvent.click(button, { detail: 0 })
    expect(click).toHaveBeenCalledTimes(2)
  })

  it('leaves perpendicular gestures to the photo gallery or native scrolling', () => {
    const { strip, button } = setup('y')
    fireEvent.mouseDown(button, { button: 0, clientX: 200, clientY: 200 })
    fireEvent.mouseMove(window, { buttons: 1, clientX: 100, clientY: 198 })
    fireEvent.mouseMove(window, { buttons: 1, clientX: 100, clientY: 50 })
    expect(strip.scrollTop).toBe(0)
    expect(strip).not.toHaveAttribute('data-mouse-dragging')
  })

  it('clamps both edges and stops on release outside the strip or window blur', () => {
    const { strip, button } = setup()
    fireEvent.mouseDown(button, { button: 0, clientX: 200 })
    fireEvent.mouseMove(window, { buttons: 1, clientX: -1000 })
    expect(strip.scrollLeft).toBe(400)
    fireEvent.mouseMove(window, { buttons: 1, clientX: 1000 })
    expect(strip.scrollLeft).toBe(0)
    fireEvent.mouseUp(window)
    fireEvent.mouseMove(window, { buttons: 1, clientX: -1000 })
    expect(strip.scrollLeft).toBe(0)
    fireEvent.mouseDown(button, { button: 0, clientX: 200 })
    fireEvent.mouseMove(window, { buttons: 1, clientX: 100 })
    fireEvent.blur(window)
    fireEvent.mouseMove(window, { buttons: 1, clientX: 0 })
    expect(strip.scrollLeft).toBe(100)
    expect(strip).not.toHaveAttribute('data-mouse-dragging')
  })

  it('removes active listeners when unmounted', () => {
    const { strip, button, unmount } = setup()
    fireEvent.mouseDown(button, { button: 0, clientX: 200 })
    fireEvent.mouseMove(window, { buttons: 1, clientX: 100 })
    unmount()
    fireEvent.mouseMove(window, { buttons: 1, clientX: 0 })
    expect(strip.scrollLeft).toBe(100)
    expect(strip).not.toHaveAttribute('data-mouse-dragging')
  })
})
