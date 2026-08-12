import { Clock3, Move, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'

export interface ActivityEntry {
  id: string
  type: string
  timestamp: string | number | Date
  label?: string
  objectId?: string
}

function entryIcon(type: string) {
  if (type.includes('create')) return <Plus size={14}/>
  if (type.includes('delete')) return <Trash2 size={14}/>
  if (type.includes('move')) return <Move size={14}/>
  if (type.includes('undo') || type.includes('redo')) return <RotateCcw size={14}/>
  return <Pencil size={14}/>
}

const operationLabels: Record<string, string> = {
  createItem: 'Punkt hinzugefügt', updateItem: 'Punkt geändert', moveItem: 'Punkt verschoben', duplicateItem: 'Punkt dupliziert', deleteItem: 'Punkt gelöscht',
  createCategory: 'Kategorie hinzugefügt', updateCategory: 'Kategorie geändert', deleteCategory: 'Kategorie gelöscht', createEvent: 'Veranstaltung hinzugefügt', updateEvent: 'Veranstaltung geändert', deleteEvent: 'Veranstaltung gelöscht', setBackground: 'Karte ersetzt', publishProject: 'Projekt veröffentlicht', undo: 'Aktion rückgängig gemacht', redo: 'Aktion wiederholt',
}

export function ActivityPanel({ open, entries, onClose }: { open: boolean; entries: ActivityEntry[]; onClose: () => void }) {
  if (!open) return null
  return <aside className="activity-panel" aria-label="Änderungsverlauf"><header><div><span className="eyebrow">Projektprotokoll</span><h2>Letzte Änderungen</h2></div><button className="icon-button" onClick={onClose}><X size={17}/></button></header><div className="activity-list">{[...entries].reverse().map((entry) => <div className="activity-entry" key={entry.id}><span className="activity-icon">{entryIcon(entry.type)}</span><div><strong>{entry.label || operationLabels[entry.type] || entry.type}</strong><span>{new Date(entry.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}{entry.objectId ? ` · ${entry.objectId.slice(0, 8)}` : ''}</span></div></div>)}{entries.length === 0 && <div className="compact-empty"><Clock3 size={22}/><p>Noch keine Änderungen</p><small>Hier werden Änderungen am Projekt angezeigt</small></div>}</div></aside>
}
