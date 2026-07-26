import {
  Archive,
  ChevronDown,
  Clock3,
  Download,
  FileUp,
  Image as ImageIcon,
  MapPinned,
  Redo2,
  Undo2,
  UploadCloud,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityPanel } from './components/ActivityPanel'
import { AssetManager, type AssetView } from './components/AssetManager'
import { ConfirmDialog } from './components/ConfirmDialog'
import { InspectorPanel } from './components/InspectorPanel'
import { LeftSidebar } from './components/LeftSidebar'
import { MapCanvas, type MapFocusRequest } from './components/MapCanvas'
import { ToastRegion, type ToastData } from './components/Toast'
import { useEditorStore } from './store/editorStore'
import './styles.css'

type AssetSelectionField = 'imageAssetId' | 'iconAssetId'

function formatDate(value: string | null) {
  if (!value) return 'Noch nicht veröffentlicht'
  return new Date(value).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function App() {
  const editor = useEditorStore()
  const [assetManagerOpen, setAssetManagerOpen] = useState(false)
  const [assetSelectionField, setAssetSelectionField] = useState<AssetSelectionField | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastData[]>([])
  const [mapFocusRequest, setMapFocusRequest] = useState<MapFocusRequest | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const backgroundRef = useRef<HTMLInputElement>(null)
  const lastError = useRef<string | null>(null)
  const mapFocusRequestId = useRef(0)

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
        if (assetManagerOpen) { setAssetManagerOpen(false); setAssetSelectionField(null) }
        else if (deleteDialogOpen) setDeleteDialogOpen(false)
        else if (editor.activeTool === 'add') editor.setActiveTool('select')
        else editor.setSelectedItemId(null)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) editor.redo(); else editor.undo()
      } else if (!editable && event.key === 'Delete' && editor.selectedItemId) {
        event.preventDefault(); setDeleteDialogOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [assetManagerOpen, deleteDialogOpen, editor])

  const project = editor.project
  const selectedItem = useMemo(() => {
    const item = project?.items.find((entry) => entry.id === editor.selectedItemId) ?? null
    return item && editor.dragPreview?.itemId === item.id ? { ...item, position: editor.dragPreview.position } : item
  }, [editor.dragPreview, editor.selectedItemId, project])

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
  }))

  const uploadForItem = async (file: File, field: AssetSelectionField) => {
    if (!selectedItem) return
    try {
      const asset = await editor.uploadAsset(file, field === 'iconAssetId' ? 'icon' : 'image')
      editor.updateItem(selectedItem.id, { [field]: asset.id })
      toast('Ressource wurde hochgeladen und ausgewählt')
    } catch (error) { toast(error instanceof Error ? error.message : 'Fehler beim Hochladen', 'error') }
  }

  const selectAsset = (assetId: string) => {
    if (assetSelectionField && selectedItem) editor.updateItem(selectedItem.id, { [assetSelectionField]: assetId })
    setAssetManagerOpen(false)
    setAssetSelectionField(null)
    toast('Ressource ausgewählt')
  }

  const uploadBackground = async (file: File) => {
    try { await editor.setBackgroundFile(file); toast('Hintergrundkarte aktualisiert') }
    catch (error) { toast(error instanceof Error ? error.message : 'Fehler beim Hochladen der Karte', 'error') }
  }

  if (editor.loading) return <div className="loading-screen"><div className="loading-box"><div className="loading-logo"><img src="/zooweb/icons/paw.png" alt=""/></div><strong>ZooWeb Map Admin</strong><span>Lokales Projekt wird geladen …</span></div></div>
  if (!project) return <div className="loading-screen"><div className="loading-box"><strong>Projekt konnte nicht geöffnet werden</strong><span>{editor.error ?? 'Bitte laden Sie die Anwendung neu'}</span></div></div>

  const backgroundUrl = project.backgroundAssetId ? editor.assetUrls[project.backgroundAssetId] ?? null : null
  const saveLabel = editor.saveStatus === 'saved' ? 'Gespeichert' : editor.saveStatus === 'saving' ? 'Wird gespeichert …' : 'Ungespeicherte Änderungen'

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><img src="/zooweb/icons/paw.png" alt=""/></span><div className="brand-copy"><span>ZooWeb · Karteneditor</span><strong>{project.title}</strong></div></div>
        <div className={`save-state ${editor.saveStatus}`}><i/><span>{saveLabel}</span></div>
        <div className="topbar-tools">
          <button className="icon-button" disabled={!editor.canUndo} onClick={editor.undo} title="Rückgängig (Strg+Z)"><Undo2 size={17}/></button>
          <button className="icon-button" disabled={!editor.canRedo} onClick={editor.redo} title="Wiederholen (Strg+Umschalt+Z)"><Redo2 size={17}/></button>
          <span className="topbar-divider"/>
          <button className="button topbar-plain" onClick={() => importRef.current?.click()}><FileUp size={15}/><span className="optional-label">Importieren</span></button>
          <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await editor.importProjectFile(file); toast('Projekt importiert') } catch (error) { toast(error instanceof Error ? error.message : 'Importfehler', 'error') } event.target.value = '' }}/>
          <button className="button topbar-plain" onClick={editor.exportProject}><Download size={15}/><span className="optional-label">Exportieren</span></button>
          <button className="button topbar-plain" onClick={() => backgroundRef.current?.click()}><ImageIcon size={15}/><span className="optional-label">Karte</span></button>
          <input ref={backgroundRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadBackground(file); event.target.value = '' }}/>
          <button className="button topbar-plain" onClick={() => { setAssetSelectionField(null); setAssetManagerOpen(true) }}><Archive size={15}/><span className="optional-label">Ressourcen</span></button>
        </div>
        <div className="topbar-actions"><button className="button publish" onClick={async () => { try { const version = await editor.publish(); toast(`Version ${version} wurde veröffentlicht`) } catch (error) { toast(error instanceof Error ? error.message : 'Veröffentlichungsfehler', 'error') } }}><UploadCloud size={16}/>Veröffentlichen<ChevronDown size={12}/></button></div>
      </header>

      <main className="main-grid">
        <LeftSidebar
          categories={project.categories}
          items={project.items}
          selectedItemId={editor.selectedItemId}
          selectedCategoryId={editor.selectedCategoryId}
          search={editor.search}
          visibility={editor.visibilityFilter}
          activeTool={editor.activeTool}
          onSearch={editor.setSearch}
          onVisibility={editor.setVisibilityFilter}
          onCategory={editor.setSelectedCategoryId}
          onToggleCategory={(id) => { const category = project.categories.find((entry) => entry.id === id); if (category) editor.updateCategory(id, { visible: !category.visible }) }}
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
            items={project.items}
            categories={project.categories}
            selectedItemId={editor.selectedItemId}
            addMode={editor.activeTool === 'add'}
            focusRequest={mapFocusRequest}
            getItemIconUrl={(item, category) => {
              const assetId = item.iconAssetId ?? category?.defaultIconAssetId
              return assetId ? editor.assetUrls[assetId] : null
            }}
            onSelect={editor.setSelectedItemId}
            onAdd={editor.createItemAt}
            onMove={editor.moveItem}
            onDragPreview={editor.previewMoveItem}
            onBackgroundColorChange={editor.setBackgroundColor}
          />
        </section>
        <InspectorPanel
          item={selectedItem}
          categories={project.categories}
          assetUrls={editor.assetUrls}
          onUpdate={editor.updateItem}
          onUpdateCategory={editor.updateCategory}
          onDuplicate={() => { editor.duplicateSelected(); toast('Punkt dupliziert') }}
          onDelete={() => setDeleteDialogOpen(true)}
          onUpload={(file, field) => void uploadForItem(file, field)}
          onChooseAsset={(field) => { setAssetSelectionField(field); setAssetManagerOpen(true) }}
          onDeselect={() => editor.setSelectedItemId(null)}
        />
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
        accept={assetSelectionField === 'iconAssetId' ? 'image/png,image/webp,image/svg+xml' : undefined}
        onUpload={(files) => void Promise.all(files.map((file) => editor.uploadAsset(file, assetSelectionField === 'iconAssetId' ? 'icon' : 'image'))).then(() => toast('Ressourcen hochgeladen')).catch((error) => toast(error instanceof Error ? error.message : 'Fehler beim Hochladen', 'error'))}
        onDelete={(id) => void editor.deleteAsset(id).then(() => toast('Ressource gelöscht')).catch((error) => toast(error instanceof Error ? error.message : 'Fehler beim Löschen', 'error'))}
        onSelect={selectAsset}
        onClose={() => { setAssetManagerOpen(false); setAssetSelectionField(null) }}
      />
      <ConfirmDialog open={deleteDialogOpen} title={`„${selectedItem?.title ?? 'Punkt'}“ löschen?`} description="Der Punkt wird aus dem Entwurf gelöscht. Die Aktion kann mit Strg+Z rückgängig gemacht werden." onConfirm={() => { editor.deleteSelected(); toast('Punkt gelöscht', 'info') }} onClose={() => setDeleteDialogOpen(false)}/>
      <ActivityPanel open={activityOpen} entries={editor.journal.map((entry) => ({ id: entry.id, type: entry.type, timestamp: entry.occurredAt, objectId: entry.affectedEntityId }))} onClose={() => setActivityOpen(false)}/>
      <ToastRegion toasts={toasts} dismiss={(id) => setToasts((current) => current.filter((entry) => entry.id !== id))}/>
    </div>
  )
}

export default App
