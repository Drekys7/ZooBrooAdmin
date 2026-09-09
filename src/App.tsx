import {
  Archive,
  CalendarDays,
  ChevronDown,
  Clock3,
  Download,
  FileUp,
  Image as ImageIcon,
  Languages,
  MapPinned,
  Redo2,
  Undo2,
  UploadCloud,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityPanel } from './components/ActivityPanel'
import { AssetManager, type AssetView } from './components/AssetManager'
import { ConfirmDialog } from './components/ConfirmDialog'
import { CategoryInspector } from './components/CategoryInspector'
import { EventManager } from './components/EventManager'
import { InspectorPanel } from './components/InspectorPanel'
import { ALL_CATEGORIES_ID, LeftSidebar } from './components/LeftSidebar'
import { MapCanvas, type MapFocusRequest } from './components/MapCanvas'
import { ToastRegion, type ToastData } from './components/Toast'
import { useEditorStore } from './store/editorStore'
import { localizeCategory, localizeEvent, localizeFact, localizeItem, localeName, translationCompletion, type MapCategory, type MapEvent, type MapItem } from './domain'
import './styles.css'

type AssetSelectionField = 'imageGallery' | 'iconAssetId' | 'categoryIconAssetId' | 'backgroundAssetId'

function formatDate(value: string | null) {
  if (!value) return 'Noch nicht veröffentlicht'
  return new Date(value).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function App() {
  const editor = useEditorStore()
  const [assetManagerOpen, setAssetManagerOpen] = useState(false)
  const [eventManagerOpen, setEventManagerOpen] = useState(false)
  const [assetSelectionField, setAssetSelectionField] = useState<AssetSelectionField | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastData[]>([])
  const [mapFocusRequest, setMapFocusRequest] = useState<MapFocusRequest | null>(null)
  const [phonePreviewRequest, setPhonePreviewRequest] = useState(0)
  const [contentLocale, setContentLocale] = useState('de')
  const importRef = useRef<HTMLInputElement>(null)
  const lastError = useRef<string | null>(null)
  const mapFocusRequestId = useRef(0)
  const sliderInteractionActive = useRef(false)

  const beginSliderInteraction = (target: EventTarget) => {
    if (!(target instanceof HTMLInputElement) || target.type !== 'range' || sliderInteractionActive.current) return
    sliderInteractionActive.current = true
    editor.beginContinuousEdit()
  }

  const endSliderInteraction = () => {
    if (!sliderInteractionActive.current) return
    sliderInteractionActive.current = false
    editor.endContinuousEdit()
  }

  const toast = useCallback((message: string, tone: ToastData['tone'] = 'success') => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((entry) => entry.id !== id)), 3500)
  }, [])

  useEffect(() => { void editor.initialize() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editor.error && editor.error !== lastError.current) {
      lastError.current = editor.error
      toast(editor.error, 'error')
    }
  }, [editor.error, toast])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const editable = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement
      if (event.key === 'Escape') {
        if (eventManagerOpen) return
        else if (assetManagerOpen) { setAssetManagerOpen(false); setAssetSelectionField(null) }
        else if (deleteDialogOpen) setDeleteDialogOpen(false)
        else if (deleteCategoryDialogOpen) setDeleteCategoryDialogOpen(false)
        else if (editor.activeTool === 'add') editor.setActiveTool('select')
        else editor.setSelectedItemId(null)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) editor.redo(); else editor.undo()
      } else if (!editable && event.key === 'Delete') {
        if (editor.selectedItemId) { event.preventDefault(); setDeleteDialogOpen(true) }
        else if (editor.inspectedCategoryId && editor.inspectedCategoryId !== ALL_CATEGORIES_ID) { event.preventDefault(); setDeleteCategoryDialogOpen(true) }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [assetManagerOpen, deleteCategoryDialogOpen, deleteDialogOpen, editor, eventManagerOpen])

  const project = editor.project
  useEffect(() => {
    if (project && !project.enabledLocales.includes(contentLocale)) setContentLocale(project.defaultLocale)
  }, [contentLocale, project])

  const localizedCategories = useMemo(
    () => project?.categories.map((category) => localizeCategory(category, contentLocale, project.defaultLocale)) ?? [],
    [contentLocale, project],
  )
  const localizedItems = useMemo(
    () => project?.items.map((item) => localizeItem(item, contentLocale, project.defaultLocale)) ?? [],
    [contentLocale, project],
  )
  const localizedEvents = useMemo(
    () => project?.events.map((event) => localizeEvent(event, contentLocale, project.defaultLocale)) ?? [],
    [contentLocale, project],
  )
  const selectedItem = useMemo(() => {
    const item = localizedItems.find((entry) => entry.id === editor.selectedItemId) ?? null
    return item && editor.dragPreview?.itemId === item.id ? { ...item, position: editor.dragPreview.position } : item
  }, [editor.dragPreview, editor.selectedItemId, localizedItems])
  const editAllCategories = editor.inspectedCategoryId === ALL_CATEGORIES_ID
  const selectedCategory = useMemo(
    () => localizedCategories.find((entry) => entry.id === editor.inspectedCategoryId) ?? null,
    [editor.inspectedCategoryId, localizedCategories],
  )

  const updateLocalizedItem = useCallback((id: string, patch: Partial<MapItem>) => {
    const source = project?.items.find((item) => item.id === id)
    if (!source) return
    const defaultLocale = project?.defaultLocale ?? 'de'
    const next: Partial<MapItem> = { ...patch }
    const translated = { ...(source.translations?.[contentLocale] ?? {}) }
    for (const key of ['title', 'subtitle', 'description'] as const) {
      if (patch[key] !== undefined) {
        translated[key] = patch[key]
        delete next[key]
      }
    }
    if (patch.facts) {
      next.facts = patch.facts.map((fact) => {
        const original = source.facts.find((entry) => entry.id === fact.id)
        if (!original) return { ...fact, translations: { ...(fact.translations ?? {}), [contentLocale]: { label: fact.label, value: fact.value } } }
        const current = localizeFact(original, contentLocale, defaultLocale)
        const translatedFact = { ...(original.translations?.[contentLocale] ?? {}) }
        if (fact.label !== current.label) translatedFact.label = fact.label
        if (fact.value !== current.value) translatedFact.value = fact.value
        return { ...original, iconAssetId: fact.iconAssetId, translations: { ...(original.translations ?? {}), [contentLocale]: translatedFact } }
      })
    }
    if (Object.keys(translated).length) next.translations = { ...(source.translations ?? {}), [contentLocale]: translated }
    editor.updateItem(id, next)
  }, [contentLocale, editor, project])

  const updateLocalizedCategory = useCallback((id: string, patch: Partial<MapCategory>) => {
    const source = project?.categories.find((category) => category.id === id)
    if (!source) return
    const next = { ...patch }
    if (patch.name !== undefined) {
      next.translations = { ...(source.translations ?? {}), [contentLocale]: { ...(source.translations?.[contentLocale] ?? {}), name: patch.name } }
      delete next.name
    }
    editor.updateCategory(id, next)
  }, [contentLocale, editor, project])

  const translateEventPatch = useCallback((id: string, patch: Partial<MapEvent>): Partial<MapEvent> => {
    const source = project?.events.find((event) => event.id === id)
    if (!source) return patch
    const next = { ...patch }
    const translated = { ...(source.translations?.[contentLocale] ?? {}) }
    for (const key of ['title', 'description', 'location'] as const) {
      if (patch[key] !== undefined) {
        translated[key] = patch[key]
        delete next[key]
      }
    }
    return { ...next, translations: { ...(source.translations ?? {}), [contentLocale]: translated } }
  }, [contentLocale, project])

  const focusItemOnMap = useCallback((itemId: string) => {
    const item = project?.items.find((entry) => entry.id === itemId)
    if (!item) return
    mapFocusRequestId.current += 1
    setMapFocusRequest({
      requestId: mapFocusRequestId.current,
      position: item.position,
    })
  }, [project])

  const usedAssetIds = useMemo(() => {
    const ids = new Set<string>()
    if (!project) return ids
    if (project.backgroundAssetId) ids.add(project.backgroundAssetId)
    project.categories.forEach((category) => category.defaultIconAssetId && ids.add(category.defaultIconAssetId))
    project.items.forEach((item) => {
      if (item.imageAssetId) ids.add(item.imageAssetId)
      item.imageAssetIds?.forEach((id) => ids.add(id))
      if (item.iconAssetId) ids.add(item.iconAssetId)
      item.facts.forEach((fact) => fact.iconAssetId && ids.add(fact.iconAssetId))
    })
    return ids
  }, [project])

  const assetViews: AssetView[] = editor.assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    mimeType: asset.mimeType,
    size: asset.size,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
    url: editor.assetUrls[asset.id],
    used: usedAssetIds.has(asset.id),
    kind: asset.kind,
  }))

  const uploadForItem = async (files: File[], field: 'imageGallery' | 'iconAssetId') => {
    if (!selectedItem) return
    try {
      const assets = await Promise.all(files.map((file) => editor.uploadAsset(file, field === 'iconAssetId' ? 'icon' : 'image')))
      if (field === 'iconAssetId') editor.updateItem(selectedItem.id, { iconAssetId: assets[0]?.id ?? null })
      else {
        const currentIds = selectedItem.imageAssetIds?.length ? selectedItem.imageAssetIds : selectedItem.imageAssetId ? [selectedItem.imageAssetId] : []
        const imageAssetIds = [...currentIds, ...assets.map((asset) => asset.id)]
        editor.updateItem(selectedItem.id, { imageAssetId: imageAssetIds[0] ?? null, imageAssetIds })
      }
      toast(assets.length > 1 ? `${assets.length} Fotos wurden hinzugefügt` : 'Ressource wurde hochgeladen und ausgewählt')
    } catch (error) { toast(error instanceof Error ? error.message : 'Fehler beim Hochladen', 'error') }
  }

  const selectAsset = (assetId: string) => {
    if (assetSelectionField === 'backgroundAssetId') {
      editor.setBackgroundAsset(assetId)
    } else if (assetSelectionField === 'categoryIconAssetId') {
      if (editAllCategories) editor.updateAllCategories({ defaultIconAssetId: assetId })
      else if (selectedCategory) editor.updateCategory(selectedCategory.id, { defaultIconAssetId: assetId })
    } else if (assetSelectionField && selectedItem) {
      if (assetSelectionField === 'imageGallery') {
        const currentIds = selectedItem.imageAssetIds?.length ? selectedItem.imageAssetIds : selectedItem.imageAssetId ? [selectedItem.imageAssetId] : []
        const imageAssetIds = [...currentIds, assetId]
        editor.updateItem(selectedItem.id, { imageAssetId: imageAssetIds[0] ?? null, imageAssetIds })
      } else editor.updateItem(selectedItem.id, { iconAssetId: assetId })
    }
    setAssetManagerOpen(false)
    setAssetSelectionField(null)
    toast('Ressource ausgewählt')
  }

  if (editor.loading) return <div className="loading-screen"><div className="loading-box"><div className="loading-logo"><img src="/zooweb/icons/paw.png" alt=""/></div><strong>ZooWeb Map Admin</strong><span>Lokales Projekt wird geladen …</span></div></div>
  if (!project) return <div className="loading-screen"><div className="loading-box"><strong>Projekt konnte nicht geöffnet werden</strong><span>{editor.error ?? 'Bitte laden Sie die Anwendung neu'}</span></div></div>

  const backgroundUrl = project.backgroundAssetId ? editor.assetUrls[project.backgroundAssetId] ?? null : null
  const saveLabel = editor.saveStatus === 'saved' ? 'Gespeichert' : editor.saveStatus === 'saving' ? 'Wird gespeichert …' : 'Ungespeicherte Änderungen'

  return (
    <div
      className="app-shell"
      onPointerDownCapture={(event) => beginSliderInteraction(event.target)}
      onPointerUpCapture={endSliderInteraction}
      onPointerCancelCapture={endSliderInteraction}
      onKeyDownCapture={(event) => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
          beginSliderInteraction(event.target)
        }
      }}
      onKeyUpCapture={endSliderInteraction}
      onBlurCapture={(event) => {
        if (event.target instanceof HTMLInputElement && event.target.type === 'range') endSliderInteraction()
      }}
    >
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><img src="/zooweb/icons/paw.png" alt=""/></span><div className="brand-copy"><span>ZooWeb · Karteneditor</span><strong>{project.title}</strong></div></div>
        <div className={`save-state ${editor.saveStatus}`}><i/><span>{saveLabel}</span></div>
        <div className="topbar-tools">
          <label className="topbar-language" title="Sprache der bearbeiteten Inhalte">
            <Languages size={15} />
            <select value={contentLocale} onChange={(event) => setContentLocale(event.target.value)} aria-label="Inhaltssprache">
              {project.enabledLocales.map((locale) => <option key={locale} value={locale}>{locale.toUpperCase()} · {localeName(locale)}{locale !== project.defaultLocale ? ` · ${translationCompletion(locale, project.defaultLocale, project.categories, project.items, project.events)}%` : ''}</option>)}
            </select>
          </label>
          <button className="icon-button" disabled={!editor.canUndo} onClick={editor.undo} title="Rückgängig (Strg+Z)"><Undo2 size={17}/></button>
          <button className="icon-button" disabled={!editor.canRedo} onClick={editor.redo} title="Wiederholen (Strg+Umschalt+Z)"><Redo2 size={17}/></button>
          <span className="topbar-divider"/>
          <button className="button topbar-plain" onClick={() => importRef.current?.click()}><FileUp size={15}/><span className="optional-label">Importieren</span></button>
          <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await editor.importProjectFile(file); toast('Projekt importiert') } catch (error) { toast(error instanceof Error ? error.message : 'Importfehler', 'error') } event.target.value = '' }}/>
          <button className="button topbar-plain" onClick={editor.exportProject}><Download size={15}/><span className="optional-label">Exportieren</span></button>
          <button className="button topbar-plain" onClick={() => { setAssetSelectionField('backgroundAssetId'); setAssetManagerOpen(true) }}><ImageIcon size={15}/><span className="optional-label">Karte</span></button>
          <button className="button topbar-plain" aria-label="Veranstaltungen" title="Veranstaltungen" onClick={() => setEventManagerOpen(true)}><CalendarDays size={15}/><span className="optional-label">Veranstaltungen</span>{project.events.length > 0 && <em className="topbar-count">{project.events.length}</em>}</button>
          <button className="button topbar-plain" onClick={() => { setAssetSelectionField(null); setAssetManagerOpen(true) }}><Archive size={15}/><span className="optional-label">Ressourcen</span></button>
        </div>
        <div className="topbar-actions"><button className="button publish" onClick={async () => { try { const version = await editor.publish(); toast(`Version ${version} wurde veröffentlicht`) } catch (error) { toast(error instanceof Error ? error.message : 'Veröffentlichungsfehler', 'error') } }}><UploadCloud size={16}/>Veröffentlichen<ChevronDown size={12}/></button></div>
      </header>

      <main className="main-grid">
        <LeftSidebar
          categories={localizedCategories}
          items={localizedItems}
          selectedItemId={editor.selectedItemId}
          selectedCategoryId={editor.selectedCategoryId}
          inspectedCategoryId={editor.inspectedCategoryId}
          search={editor.search}
          visibility={editor.visibilityFilter}
          activeTool={editor.activeTool}
          onSearch={editor.setSearch}
          onVisibility={editor.setVisibilityFilter}
          onCategory={editor.setSelectedCategoryId}
          onToggleCategory={(id) => { const category = project.categories.find((entry) => entry.id === id); if (category) editor.updateCategory(id, { visible: !category.visible }) }}
          onToggleAllCategories={() => editor.updateAllCategories({ visible: !project.categories.every((category) => category.visible) })}
          onCreateCategory={editor.createCategory}
          onSelectItem={editor.setSelectedItemId}
          onFocusItem={focusItemOnMap}
          onAddItem={() => editor.setActiveTool(editor.activeTool === 'add' ? 'select' : 'add')}
        />
        <section className="map-workspace">
          <MapCanvas
            backgroundUrl={backgroundUrl}
            backgroundWidth={project.backgroundWidth ?? 1}
            backgroundHeight={project.backgroundHeight ?? 1}
            backgroundColor={project.backgroundColor}
            mapSettings={project.mapSettings}
            items={project.items}
            categories={project.categories}
            events={project.events}
            defaultLocale={project.defaultLocale}
            enabledLocales={project.enabledLocales}
            selectedItemId={editor.selectedItemId}
            addMode={editor.activeTool === 'add'}
            focusRequest={mapFocusRequest}
            phonePreviewRequest={phonePreviewRequest}
            getItemIconUrl={(item, category) => {
              const assetId = item.iconAssetId ?? category?.defaultIconAssetId
              return assetId ? editor.assetUrls[assetId] : null
            }}
            getItemImageUrl={(item) => item.imageAssetId ? editor.assetUrls[item.imageAssetId] : null}
            getItemImageUrls={(item) => {
              const ids = item.imageAssetIds?.length ? item.imageAssetIds : item.imageAssetId ? [item.imageAssetId] : []
              return ids.map((id) => editor.assetUrls[id]).filter(Boolean)
            }}
            getFactIconUrl={(fact) => fact.iconAssetId ? editor.assetUrls[fact.iconAssetId] : null}
            onSelect={editor.setSelectedItemId}
            onAdd={editor.createItemAt}
            onMove={editor.moveItem}
            onDragPreview={editor.previewMoveItem}
            onBackgroundColorChange={editor.setBackgroundColor}
            onMapSettingsChange={editor.updateMapSettings}
            onLanguagesChange={editor.updateProjectLanguages}
            onSettingsEditStart={editor.beginContinuousEdit}
            onSettingsEditEnd={editor.endContinuousEdit}
          />
        </section>
        {selectedItem ? <InspectorPanel
            item={selectedItem}
            contentLocale={contentLocale}
            defaultLocale={project.defaultLocale}
            categories={localizedCategories}
            assetUrls={editor.assetUrls}
            onUpdate={updateLocalizedItem}
            onDuplicate={() => { editor.duplicateSelected(); toast('Punkt dupliziert') }}
            onDelete={() => setDeleteDialogOpen(true)}
            onUpload={(files, field) => void uploadForItem(files, field)}
            onChooseAsset={(field) => { setAssetSelectionField(field); setAssetManagerOpen(true) }}
            onDeselect={() => editor.setSelectedItemId(null)}
          /> : (selectedCategory || editAllCategories) ? <CategoryInspector
            categories={localizedCategories}
            category={selectedCategory}
            contentLocale={contentLocale}
            defaultLocale={project.defaultLocale}
            editAll={editAllCategories}
            assetUrls={editor.assetUrls}
            onUpdateCategory={updateLocalizedCategory}
            onUpdateAll={editor.updateAllCategories}
            onChooseIcon={() => { setAssetSelectionField('categoryIconAssetId'); setAssetManagerOpen(true) }}
            onDelete={() => setDeleteCategoryDialogOpen(true)}
            onDeselect={() => editor.setInspectedCategoryId(null)}
          /> : <InspectorPanel
            item={null}
            contentLocale={contentLocale}
            defaultLocale={project.defaultLocale}
            categories={localizedCategories}
            assetUrls={editor.assetUrls}
            onUpdate={editor.updateItem}
            onDuplicate={() => {}}
            onDelete={() => {}}
            onUpload={() => {}}
            onChooseAsset={() => {}}
            onDeselect={() => {}}
          />}
      </main>

      <footer className="statusbar">
        <span><MapPinned size={12}/> {project.items.length} Punkte · {project.categories.length} Kategorien</span>
        <span>Karte: {project.backgroundWidth ?? '—'} × {project.backgroundHeight ?? '—'}</span>
        <span className="status-spacer"/>
        <button onClick={() => setActivityOpen((open) => !open)}><Clock3 size={12}/> Verlauf ({editor.journal.length})</button>
        <span>Veröffentlichung: v{editor.publishedVersion} · {formatDate(editor.lastPublishedAt)}</span>
        <span className="online"><i/> Lokale Datenbank</span>
      </footer>

      <AssetManager
        open={assetManagerOpen}
        assets={assetViews}
        selectionMode={Boolean(assetSelectionField)}
        selectionKind={assetSelectionField === 'backgroundAssetId' ? 'background' : undefined}
        accept={assetSelectionField === 'iconAssetId' || assetSelectionField === 'categoryIconAssetId' ? 'image/png,image/webp,image/svg+xml' : undefined}
        onUpload={(files) => {
          if (assetSelectionField === 'backgroundAssetId') {
            const file = files[0]
            if (!file) return
            void editor.setBackgroundFile(file).then(() => {
              setAssetManagerOpen(false)
              setAssetSelectionField(null)
              toast('Karte wurde in den Ressourcen gespeichert und ausgewählt')
            }).catch((error) => toast(error instanceof Error ? error.message : 'Fehler beim Hochladen der Karte', 'error'))
            return
          }
          void Promise.all(files.map((file) => editor.uploadAsset(file, assetSelectionField === 'iconAssetId' || assetSelectionField === 'categoryIconAssetId' ? 'icon' : 'image'))).then(() => toast('Ressourcen hochgeladen')).catch((error) => toast(error instanceof Error ? error.message : 'Fehler beim Hochladen', 'error'))
        }}
        onDelete={(id) => void editor.deleteAsset(id).then(() => toast('Ressource gelöscht')).catch((error) => toast(error instanceof Error ? error.message : 'Fehler beim Löschen', 'error'))}
        onSelect={selectAsset}
        onClose={() => { setAssetManagerOpen(false); setAssetSelectionField(null) }}
      />
      <EventManager
        open={eventManagerOpen}
        contentLocale={contentLocale}
        defaultLocale={project.defaultLocale}
        enabledLocales={project.enabledLocales}
        onContentLocaleChange={setContentLocale}
        events={localizedEvents}
        items={localizedItems}
        onCreate={(input) => {
          const id = editor.createEvent({ ...input, translations: { [contentLocale]: { title: input.title, description: input.description, location: input.location } } })
          toast('Veranstaltung erstellt')
          return id
        }}
        onUpdate={(id, patch) => {
          editor.updateEvent(id, translateEventPatch(id, patch))
          toast('Veranstaltung gespeichert')
        }}
        onDelete={(id) => {
          editor.deleteEvent(id)
          toast('Veranstaltung gelöscht', 'info')
        }}
        onDeletePast={(ids) => {
          editor.deleteEvents(ids)
          toast(`${ids.length} vergangene Veranstaltungen gelöscht`, 'info')
        }}
        onPreview={(event) => {
          if (event.relatedItemId) focusItemOnMap(event.relatedItemId)
          setEventManagerOpen(false)
          setPhonePreviewRequest((request) => request + 1)
        }}
        onClose={() => setEventManagerOpen(false)}
      />
      <ConfirmDialog open={deleteDialogOpen} title={`„${selectedItem?.title ?? 'Punkt'}“ löschen?`} description="Der Punkt wird aus dem Entwurf gelöscht. Die Aktion kann mit Strg+Z rückgängig gemacht werden." onConfirm={() => { editor.deleteSelected(); toast('Punkt gelöscht', 'info') }} onClose={() => setDeleteDialogOpen(false)}/>
      <ConfirmDialog open={deleteCategoryDialogOpen} title={`„${selectedCategory?.name ?? 'Kategorie'}“ löschen?`} description="Die Kategorie und alle zugehörigen Punkte werden aus dem Entwurf gelöscht. Die Aktion kann mit Strg+Z rückgängig gemacht werden." onConfirm={() => { editor.deleteSelectedCategory(); toast('Kategorie gelöscht', 'info') }} onClose={() => setDeleteCategoryDialogOpen(false)}/>
      <ActivityPanel open={activityOpen} entries={editor.journal.map((entry) => ({ id: entry.id, type: entry.type, timestamp: entry.occurredAt, objectId: entry.affectedEntityId }))} onClose={() => setActivityOpen(false)}/>
      <ToastRegion toasts={toasts} dismiss={(id) => setToasts((current) => current.filter((entry) => entry.id !== id))}/>
    </div>
  )
}

export default App
