import { Eye, EyeOff, ListFilter, Plus, Search, SlidersHorizontal } from 'lucide-react'
import type { MapCategory, MapItem } from '../domain/models'
import { CategoryIcon } from './CategoryIcon'

export type VisibilityFilter = 'all' | 'visible' | 'hidden'

interface LeftSidebarProps {
  categories: MapCategory[]
  items: MapItem[]
  selectedItemId: string | null
  selectedCategoryId: string | null
  search: string
  visibility: VisibilityFilter
  activeTool: 'select' | 'add'
  onSearch: (value: string) => void
  onVisibility: (value: VisibilityFilter) => void
  onCategory: (id: string | null) => void
  onToggleCategory: (id: string) => void
  onSelectItem: (id: string) => void
  onAddItem: () => void
  onAddCategory: () => void
}

export function LeftSidebar(props: LeftSidebarProps) {
  const query = props.search.trim().toLocaleLowerCase('de-DE')
  const visibleItems = props.items
    .filter((item) => !props.selectedCategoryId || item.categoryId === props.selectedCategoryId)
    .filter((item) => props.visibility === 'all' || (props.visibility === 'visible' ? item.visible : !item.visible))
    .filter((item) => !query || `${item.title} ${item.subtitle}`.toLocaleLowerCase('de-DE').includes(query))
    .sort((a, b) => a.title.localeCompare(b.title, 'de-DE'))

  return (
    <aside className="sidebar left-sidebar" aria-label="Kartenobjekte">
      <div className="sidebar-heading">
        <div><span className="eyebrow">Inhalt</span><h2>Kartenpunkte</h2></div>
        <button className="icon-button" onClick={props.onAddCategory} title="Neue Kategorie"><Plus size={17} /></button>
      </div>

      <label className="search-field">
        <Search size={15} />
        <input value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Punkte durchsuchen…" aria-label="Punkte durchsuchen" />
        <kbd>/</kbd>
      </label>

      <div className="filter-row" aria-label="Sichtbarkeitsfilter">
        <SlidersHorizontal size={14} />
        {(['all', 'visible', 'hidden'] as VisibilityFilter[]).map((filter) => (
          <button key={filter} className={props.visibility === filter ? 'active' : ''} onClick={() => props.onVisibility(filter)}>
            {filter === 'all' ? 'Alle' : filter === 'visible' ? 'Sichtbar' : 'Ausgeblendet'}
          </button>
        ))}
      </div>

      <div className="panel-section categories-section">
        <div className="section-title"><span>Kategorien</span><span>{props.categories.length}</span></div>
        <div className="category-list">
          <button className={`category-row ${props.selectedCategoryId === null ? 'selected' : ''}`} onClick={() => props.onCategory(null)}>
            <span className="category-icon neutral"><ListFilter size={15} /></span>
            <span className="category-name">Alle Objekte</span>
            <span className="count-badge">{props.items.length}</span>
          </button>
          {[...props.categories].sort((a, b) => a.sortOrder - b.sortOrder).map((category) => {
            const count = props.items.filter((item) => item.categoryId === category.id).length
            return <div key={category.id} className={`category-row ${props.selectedCategoryId === category.id ? 'selected' : ''}`}>
              <button className="category-select" onClick={() => props.onCategory(category.id)}>
                <span className="category-icon" style={{ color: category.color, background: `${category.color}18` }}><CategoryIcon type={category.type} size={15} /></span>
                <span className="category-name">{category.name}</span>
                <span className="count-badge">{count}</span>
              </button>
              <button className="visibility-button" onClick={() => props.onToggleCategory(category.id)} title={category.visible ? 'Kategorie ausblenden' : 'Kategorie anzeigen'}>
                {category.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          })}
        </div>
      </div>

      <div className="panel-section items-section">
        <div className="section-title"><span>Objekte</span><span>{visibleItems.length}</span></div>
        <div className="item-list">
          {visibleItems.map((item) => {
            const category = props.categories.find((entry) => entry.id === item.categoryId)
            return <button key={item.id} className={`item-row ${props.selectedItemId === item.id ? 'selected' : ''} ${!item.visible ? 'muted' : ''}`} onClick={() => props.onSelectItem(item.id)}>
              <span className="item-dot" style={{ background: category?.color ?? '#60756d' }} />
              <span className="item-copy"><strong>{item.title}</strong><small>{category?.name ?? 'Ohne Kategorie'}{item.subtitle ? ` · ${item.subtitle}` : ''}</small></span>
              {!item.visible && <EyeOff size={13} />}
            </button>
          })}
          {visibleItems.length === 0 && <div className="compact-empty"><Search size={20} /><p>Keine Punkte gefunden</p><small>Ändern Sie den Filter oder Suchbegriff</small></div>}
        </div>
      </div>

      <button className={`add-point-button ${props.activeTool === 'add' ? 'active' : ''}`} onClick={props.onAddItem}>
        <Plus size={17} />
        {props.activeTool === 'add' ? 'Auf die Karte klicken' : 'Punkt hinzufügen'}
        {props.activeTool === 'add' && <kbd>Esc</kbd>}
      </button>
    </aside>
  )
}
