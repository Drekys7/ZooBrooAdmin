import { FileImage, Grid2X2, HardDrive, Image, List, Search, Trash2, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

export interface AssetView {
  id: string
  name: string
  mimeType: string
  size: number
  width?: number
  height?: number
  url?: string
  used: boolean
}

interface AssetManagerProps {
  open: boolean
  assets: AssetView[]
  selectionMode?: boolean
  accept?: string
  onUpload: (files: File[]) => void
  onDelete: (id: string) => void
  onSelect: (id: string) => void
  onClose: () => void
}

const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`

export function AssetManager({ open, assets, selectionMode, accept = 'image/png,image/jpeg,image/webp,image/svg+xml', onUpload, onDelete, onSelect, onClose }: AssetManagerProps) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const inputRef = useRef<HTMLInputElement>(null)
  const filteredAssets = useMemo(() => assets.filter((asset) => asset.name.toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE'))), [assets, query])
  if (!open) return null
  const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0)
  return (
    <div className="modal-backdrop asset-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal asset-manager" role="dialog" aria-modal="true" aria-labelledby="assets-title">
        <header className="asset-header">
          <div><span className="eyebrow">Projektmediathek</span><h2 id="assets-title">Medienverwaltung</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Schließen"><X size={18}/></button>
        </header>
        <div className="asset-toolbar">
          <label className="search-field asset-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Dateien durchsuchen…"/></label>
          <div className="view-toggle"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Rasteransicht"><Grid2X2 size={15}/></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="Listenansicht"><List size={16}/></button></div>
          <button className="button primary" onClick={() => inputRef.current?.click()}><Upload size={15}/>Hochladen</button>
          <input ref={inputRef} hidden multiple type="file" accept={accept} onChange={(event) => { onUpload(Array.from(event.target.files ?? [])); event.target.value = '' }}/>
        </div>
        <div className="asset-summary"><span><HardDrive size={14}/>{assets.length} {assets.length === 1 ? 'Datei' : 'Dateien'} · {formatBytes(totalSize)}</span><span>{assets.filter((asset) => asset.used).length} verwendet</span></div>
        <div className={`asset-collection ${view}`}>
          {filteredAssets.map((asset) => <article key={asset.id} className="asset-tile">
            <button className="asset-preview" onClick={() => selectionMode && onSelect(asset.id)} disabled={!selectionMode}>{asset.url ? <img src={asset.url} alt=""/> : <FileImage size={28}/>}<span className="asset-kind">{asset.mimeType.split('/')[1]?.toUpperCase()}</span></button>
            <div className="asset-meta"><strong title={asset.name}>{asset.name}</strong><span>{asset.width && asset.height ? `${asset.width} × ${asset.height} · ` : ''}{formatBytes(asset.size)}</span></div>
            <div className="asset-tile-actions">{selectionMode && <button className="text-button" onClick={() => onSelect(asset.id)}>Auswählen</button>}<button className="icon-button subtle" disabled={asset.used} title={asset.used ? 'Datei wird verwendet' : 'Löschen'} onClick={() => onDelete(asset.id)}><Trash2 size={14}/></button></div>
          </article>)}
          {filteredAssets.length === 0 && <div className="asset-empty"><Image size={28}/><h3>{assets.length ? 'Keine Ergebnisse' : 'Die Mediathek ist noch leer'}</h3><p>{assets.length ? 'Versuchen Sie es mit einem anderen Suchbegriff.' : 'Laden Sie eine Karte, Fotos oder Symbole hoch.'}</p><button className="button primary" onClick={() => inputRef.current?.click()}><Upload size={15}/>Dateien hinzufügen</button></div>}
        </div>
        <footer className="asset-footer"><p>{selectionMode ? 'Wählen Sie eine Datei für dieses Feld aus.' : 'Nur Dateien, die im Projekt nicht verwendet werden, können gelöscht werden.'}</p><button className="button ghost" onClick={onClose}>Fertig</button></footer>
      </section>
    </div>
  )
}
