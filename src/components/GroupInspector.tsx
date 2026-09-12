import { ChevronDown, Copy, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_GROUP_BADGE_COLOR, groupEntries } from '../domain/groups'
import { InspectorPanel, type InspectorPanelProps } from './InspectorPanel'

export function GroupInspector(props: InspectorPanelProps & { focusEntry?: { entryId: string }; onAddMember: (id: string) => void; onRemoveMember: (parentId: string, memberId: string) => void }) {
  const { item, onAddMember, onRemoveMember } = props
  const [openId, setOpenId] = useState<string | null>(null)
  const focusedSection = useRef<HTMLElement>(null)
  const requestedEntryId = item && (props.focusEntry?.entryId === item.id || item.members?.some((member) => member.id === props.focusEntry?.entryId)) ? props.focusEntry?.entryId : undefined
  const lastMemberId = item?.members?.at(-1)?.id
  useEffect(() => { setOpenId(lastMemberId ?? item?.id ?? null) }, [item?.id, lastMemberId])
  useEffect(() => { if (requestedEntryId) setOpenId(requestedEntryId) }, [requestedEntryId, props.focusEntry])
  useEffect(() => {
    if (openId === requestedEntryId) focusedSection.current?.scrollIntoView?.({ block: 'nearest' })
  }, [openId, requestedEntryId, props.focusEntry])
  if (!item?.members?.length) return <InspectorPanel {...props} />
  return <aside className="sidebar inspector group-inspector" aria-label="Gruppeninspektor">
    <div className="inspector-titlebar"><div><span className="eyebrow">Inspektor · Gruppe</span><h2>{item.title}</h2></div><button className="icon-button" aria-label="Auswahl aufheben" onClick={props.onDeselect}><X size={17}/></button></div>
    <div className="inspector-scroll">
      <section className="inspector-section group-badge-settings">
        <h3>Gruppe</h3>
        <label className="field color-field">
          <span>Hintergrund der Gruppenanzahl</span>
          <div>
            <input type="color" aria-label="Hintergrund der Gruppenanzahl" value={item.groupBadgeColor ?? DEFAULT_GROUP_BADGE_COLOR} onChange={(event) => props.onUpdate(item.id, { groupBadgeColor: event.target.value })} />
            <code>{(item.groupBadgeColor ?? DEFAULT_GROUP_BADGE_COLOR).toUpperCase()}</code>
            {item.groupBadgeColor && <button type="button" className="icon-button" aria-label="Standardfarbe der Gruppenanzahl wiederherstellen" title="Standardfarbe wiederherstellen" onClick={() => props.onUpdate(item.id, { groupBadgeColor: null })}><X size={14}/></button>}
          </div>
        </label>
      </section>
      {groupEntries(item).map((entry, index) => <section className="group-editor-entry" key={entry.id} ref={entry.id === requestedEntryId ? focusedSection : undefined}>
        <div className="group-editor-heading">
          <button type="button" aria-expanded={openId === entry.id} onClick={() => setOpenId(openId === entry.id ? null : entry.id)}><ChevronDown size={16}/><strong>{entry.title}</strong>{index === 0 && <small>Hauptpunkt</small>}</button>
          {index > 0 && <button type="button" className="icon-button" aria-label={`${entry.title} aus Gruppe entfernen`} onClick={() => onRemoveMember(item.id, entry.id)}><X size={16}/></button>}
        </div>
        {openId === entry.id && <InspectorPanel {...props} item={entry} embedded member={index > 0} />}
      </section>)}
      <button className="button group-editor-add" onClick={() => onAddMember(item.id)}><Plus size={16}/>Neuer Punkt</button>
    </div>
    <div className="inspector-actions"><button className="button ghost" onClick={props.onDuplicate}><Copy size={15}/>Duplizieren</button><button className="button danger-ghost" onClick={props.onDelete}><Trash2 size={15}/>Löschen</button></div>
  </aside>
}
