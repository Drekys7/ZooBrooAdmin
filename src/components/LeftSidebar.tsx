import { ArrowRight, Eye, EyeOff, ListFilter, Plus, Search, SlidersHorizontal } from 'lucide-react'
import type { MapCategory, MapItem } from '../domain/models'
import { CategoryIcon } from './CategoryIcon'

export type VisibilityFilter = 'all' | 'visible' | 'hidden'
export const ALL_CATEGORIES_ID = '__all-categories__'

interface LeftSidebarProps {
  categories: MapCategory[]
  items: MapItem[]
  selectedItemId: string | null
  selectedCategoryId: string | null
  inspectedCategoryId: string | null
  search: string
  visibility: VisibilityFilter
  activeTool: 'select' | 'add'
  onSearch: (value: string) => void
  onVisibility: (value: VisibilityFilter) => void
  onCategory: (id: string | null) => void
  onToggleCategory: (id: string) => void
  onToggleAllCategories: () => void
  onCreateCategory: () => void
  onSelectItem: (id: string) => void
  onFocusItem: (id: string) => void
  onAddItem: () => void
}

export function LeftSidebar(props: LeftSidebarProps) {
  const query = props.search.trim().toLocaleLowerCase('de-DE')
  const visibleItems = props.items
    .filter((item) => !props.selectedCategoryId || props.selectedCategoryId === ALL_CATEGORIES_ID || item.categoryId === props.selectedCategoryId)
    .filter((item) => props.visibility === 'all' || (props.visibility === 'visible' ? item.visible : !item.visible))
    .filter((item) => !query || `${item.title} ${item.subtitle}`.toLocaleLowerCase('de-DE').includes(query))
    .sort((a, b) => a.title.localeCompare(b.title, 'de-DE'))
  const allCategoriesVisible = props.categories.every((category) => category.visible)

  return (
    <aside className="sidebar left-sidebar" aria-label="Kartenobjekte">
      <div className="sidebar-heading">
        <div><span className="eyebrow">Inhalt</span><h2>Kartenpunkte</h2></div>
      </div>

      <div className="panel-section categories-section">
        <div className="section-title"><span>Kategorien</span><button className="section-add-button" onClick={props.onCreateCategory} title="Kategorie hinzufügen" aria-label="Kategorie hinzufügen"><Plus size={15}/></button></div>
        <div className="category-list">
          <div className={`category-row ${props.inspectedCategoryId === ALL_CATEGORIES_ID ? 'selected' : props.selectedCategoryId === ALL_CATEGORIES_ID ? 'active' : ''}`}>
            <button className="category-select" onClick={() => props.onCategory(ALL_CATEGORIES_ID)}>
              <span className="category-icon neutral"><ListFilter size={15} /></span>
              <span className="category-name">Alle Objekte</span>
              <span className="count-badge">{props.items.length}</span>
            </button>
            <button className="visibility-button" onClick={props.onToggleAllCategories} title={allCategoriesVisible ? 'Alle Kategorien ausblenden' : 'Alle Kategorien anzeigen'} aria-label={allCategoriesVisible ? 'Alle Kategorien ausblenden' : 'Alle Kategorien anzeigen'}>
              {allCategoriesVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>
          {[...props.categories].sort((a, b) => a.sortOrder - b.sortOrder).map((category) => {
            const count = props.items.filter((item) => item.categoryId === category.id).length
            const selectedInInspector = props.inspectedCategoryId === category.id || props.inspectedCategoryId === ALL_CATEGORIES_ID
            const activeAsFilter = !selectedInInspector && props.selectedCategoryId === category.id
            return <div key={category.id} className={`category-row ${selectedInInspector ? 'selected' : activeAsFilter ? 'active' : ''}`}>
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

      <div className="section-title search-title">
        <span>Suche</span>
      </div>

      <label className="search-field">
        <Search size={15} />
        <input value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Punkte durchsuchen…" aria-label="Punkte durchsuchen" />
      </label>

      <div className="filter-row" aria-label="Sichtbarkeitsfilter">
        <SlidersHorizontal size={14} />
        {(['all', 'visible', 'hidden'] as VisibilityFilter[]).map((filter) => (
          <button key={filter} className={props.visibility === filter ? 'active' : ''} onClick={() => props.onVisibility(filter)}>
            {filter === 'all' ? 'Alle' : filter === 'visible' ? 'Sichtbar' : 'Ausgeblendet'}
          </button>
        ))}
      </div>

      <div className="panel-section items-section">
        <div className="item-list">
          {visibleItems.map((item) => {
            const category = props.categories.find((entry) => entry.id === item.categoryId)
            const isSelected = props.selectedItemId === item.id
            return <div key={item.id} className={`item-row ${isSelected ? 'selected' : ''} ${!item.visible ? 'muted' : ''}`}>
              <button
                className="item-select"
                onClick={() => props.onSelectItem(item.id)}
                onDoubleClick={() => isSelected && props.onFocusItem(item.id)}
              >
                <span className="item-dot" style={{ background: category?.color ?? '#60756d' }} />
                <span className="item-copy"><strong>{item.title}</strong><small>{category?.name ?? 'Ohne Kategorie'}{item.subtitle ? ` · ${item.subtitle}` : ''}</small></span>
                {!item.visible && <EyeOff size={13} />}
              </button>
              {isSelected && <button
                className="item-focus-button"
                onClick={() => props.onFocusItem(item.id)}
                title="Auf der Karte zentrieren"
                aria-label={`${item.title} auf der Karte zentrieren`}
              >
                <ArrowRight size={16} />
              </button>}
            </div>
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
