import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CommandHistory } from '../application/history'
import { createCategory, updateCategory } from '../application/commands'
import { createEmptyProject } from '../domain'
import { useColorEditHistory } from './useColorEditHistory'

function setup() {
  const original = createCategory(createEmptyProject({ id: 'colors' }), {
    id: 'animals', name: 'Tiere', type: 'animal', color: '#226644', visible: true,
  })
  let project = original
  const history = new CommandHistory()
  const begin = () => history.beginTransaction(project)
  const end = () => { project = history.endTransaction(project) }
  const update = (color: string) => {
    project = history.execute(project, { type: 'updateCategory', affectedEntityType: 'category', affectedEntityId: 'animals' },
      (current) => updateCategory(current, { categoryId: 'animals', patch: { color } }))
  }
  function Editor() {
    useColorEditHistory(begin, end)
    return <><input aria-label="Color" type="color" defaultValue="#226644" onChange={(event) => update(event.target.value)} /><button>Other action</button></>
  }
  const view = render(<Editor />)
  return { ...view, input: view.getByLabelText('Color'), history, original, current: () => project }
}

describe('color edit history', () => {
  it('previews intermediate colors but records one step when the mouse is released', () => {
    const { input, history, original, current, unmount } = setup()
    fireEvent.pointerDown(input)
    fireEvent.pointerUp(input) // Opening the native picker is not an edit.
    for (const color of ['#112233', '#223344', '#334455']) fireEvent.input(input, { target: { value: color } })
    expect(current().categories[0].color).toBe('#334455')
    expect(history.getJournal()).toHaveLength(0)
    fireEvent.pointerUp(window)
    expect(history.getJournal()).toHaveLength(1)
    const undone = history.undo(current())!
    expect(undone.project.categories[0].color).toBe(original.categories[0].color)
    expect(history.canUndo()).toBe(false)
    expect(history.redo(undone.project)?.project.categories[0].color).toBe('#334455')
    unmount()
  })

  it('uses native change to commit a picker gesture and separates the next gesture', () => {
    const { input, history, current, unmount } = setup()
    fireEvent.input(input, { target: { value: '#112233' } })
    fireEvent.input(input, { target: { value: '#223344' } })
    fireEvent.change(input, { target: { value: '#223344' } })
    expect(history.getJournal()).toHaveLength(1)
    fireEvent.input(input, { target: { value: '#334455' } })
    fireEvent.input(input, { target: { value: '#445566' } })
    fireEvent.change(input, { target: { value: '#445566' } })
    expect(history.getJournal()).toHaveLength(2)
    expect(history.undo(current())?.project.categories[0].color).toBe('#223344')
    unmount()
  })

  it.each(['blur', 'other-control', 'undo', 'unmount'])('finishes pending color changes on %s', (action) => {
    const { input, history, getByText, unmount } = setup()
    fireEvent.input(input, { target: { value: '#112233' } })
    fireEvent.input(input, { target: { value: '#223344' } })
    if (action === 'blur') fireEvent.focusOut(input)
    if (action === 'other-control') fireEvent.pointerDown(getByText('Other action'))
    if (action === 'undo') fireEvent.keyDown(input, { key: 'z', ctrlKey: true })
    if (action === 'unmount') unmount()
    expect(history.getJournal()).toHaveLength(1)
    unmount()
  })
})
