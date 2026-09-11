import { useEffect } from 'react'

/** Keep live color previews in a single undo transaction until the gesture commits. */
export function useColorEditHistory(beginEdit: () => void, endEdit: () => void) {
  useEffect(() => {
    let activeInput: HTMLInputElement | null = null
    const isColor = (target: EventTarget | null): target is HTMLInputElement =>
      target instanceof HTMLInputElement && target.type === 'color'
    const finish = () => {
      if (!activeInput) return
      activeInput = null
      endEdit()
    }
    const start = (event: Event) => {
      if (!isColor(event.target)) {
        finish()
        return
      }
      if (activeInput === event.target) return
      finish()
      activeInput = event.target
      beginEdit()
    }
    const commit = (event: Event) => {
      if (event.target === activeInput) finish()
    }
    const pointerDown = (event: PointerEvent) => {
      if (event.target !== activeInput) finish()
    }
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z')) finish()
    }

    // Capture input before React applies the live value. Native change (not
    // React's onChange, which also handles input) signals a committed selection.
    document.addEventListener('input', start, true)
    document.addEventListener('change', commit)
    document.addEventListener('focusout', commit)
    document.addEventListener('pointerdown', pointerDown, true)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    document.addEventListener('keydown', keyDown, true)
    return () => {
      document.removeEventListener('input', start, true)
      document.removeEventListener('change', commit)
      document.removeEventListener('focusout', commit)
      document.removeEventListener('pointerdown', pointerDown, true)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      document.removeEventListener('keydown', keyDown, true)
      finish()
    }
  }, [beginEdit, endEdit])
}
