import { create } from 'zustand'
import {
  CommandHistory,
  createCategory,
  createItem,
  deleteCategory,
  deleteItem,
  duplicateItem,
  exportProjectToJson,
  importProjectFromJson,
  moveItem,
  publishProject,
  setBackground,
  setBackgroundColor,
  updateCategory,
  updateItem,
  type OperationRecord,
  type OperationType,
} from '../application'
import { createEmptyProject, type Asset, type MapCategory, type MapItem, type MapProject, type NormalizedPosition } from '../domain'
import { createLocalApplication } from '../infrastructure'

type SaveStatus = 'saved' | 'dirty' | 'saving'
type Tool = 'select' | 'add'
type VisibilityFilter = 'all' | 'visible' | 'hidden'

interface EditorState {
  project: MapProject | null
  assets: Asset[]
  assetUrls: Record<string, string>
  selectedItemId: string | null
  selectedCategoryId: string | null
  inspectedCategoryId: string | null
  search: string
  visibilityFilter: VisibilityFilter
  activeTool: Tool
  saveStatus: SaveStatus
  loading: boolean
  error: string | null
  lastPublishedAt: string | null
  publishedVersion: number
  canUndo: boolean
  canRedo: boolean
  journal: readonly OperationRecord[]
  dragPreview: { itemId: string; position: NormalizedPosition } | null
  initialize: () => Promise<void>
  setSearch: (search: string) => void
  setVisibilityFilter: (filter: VisibilityFilter) => void
  setSelectedCategoryId: (id: string | null) => void
  setInspectedCategoryId: (id: string | null) => void
  setSelectedItemId: (id: string | null) => void
  setActiveTool: (tool: Tool) => void
  createItemAt: (position: NormalizedPosition) => void
  updateItem: (id: string, patch: Partial<MapItem>) => void
  moveItem: (id: string, position: NormalizedPosition) => void
  previewMoveItem: (id: string, position: NormalizedPosition) => void
  duplicateSelected: () => void
  deleteSelected: () => void
  createCategory: () => void
  updateCategory: (id: string, patch: Partial<MapCategory>) => void
  updateAllCategories: (patch: Partial<MapCategory>) => void
  deleteSelectedCategory: () => void
  undo: () => void
  redo: () => void
  uploadAsset: (file: File, kind: Asset['kind']) => Promise<Asset>
  deleteAsset: (id: string) => Promise<void>
  setBackgroundFile: (file: File) => Promise<void>
  setBackgroundColor: (color: string) => void
  importProjectFile: (file: File) => Promise<void>
  exportProject: () => void
  publish: () => Promise<number>
}

const container = createLocalApplication()
const history = new CommandHistory(150)
let saveTimer: ReturnType<typeof setTimeout> | null = null
let initialized = false

const demoCategories: Array<Omit<MapCategory, 'sortOrder'>> = [
  { id: 'animals', name: 'Tiere', type: 'animal', color: '#4F8F64', defaultIconAssetId: 'zooweb-icon-paw', visible: true },
  { id: 'restaurants', name: 'Gastronomie', type: 'restaurant', color: '#2F7D59', defaultIconAssetId: 'zooweb-icon-restaurant', visible: true },
  { id: 'restrooms', name: 'Toiletten', type: 'restroom', color: '#2F79A8', defaultIconAssetId: 'zooweb-icon-restroom', visible: true },
  { id: 'souvenirs', name: 'Souvenirshops', type: 'souvenir', color: '#A66B2E', defaultIconAssetId: 'zooweb-icon-souvenir', visible: true },
  { id: 'entrances', name: 'Ein- und Ausgänge', type: 'entrance', color: '#5D6F7B', defaultIconAssetId: 'zooweb-icon-entrance', visible: true },
]

type DemoItemSeed = {
  id: string
  categoryId: string
  title: string
  subtitle: string
  description: string
  iconAssetId: string
  x: number
  y: number
  facts?: Array<{ id: string; label: string; value: string; iconAssetId: string }>
}

const animalFacts = (id: string, region: string, lifespan: string, weight: string, food: string) => [
  { id: `${id}-region`, label: 'Region', value: region, iconAssetId: 'zooweb-fact-region' },
  { id: `${id}-lifespan`, label: 'Lebensdauer', value: lifespan, iconAssetId: 'zooweb-fact-lifespan' },
  { id: `${id}-weight`, label: 'Gewicht', value: weight, iconAssetId: 'zooweb-fact-weight' },
  { id: `${id}-food`, label: 'Nahrung', value: food, iconAssetId: 'zooweb-fact-food' },
]

const demoItems: DemoItemSeed[] = [
  { id: 'antelope', categoryId: 'animals', title: 'Antilope', subtitle: 'Schneller Savannenbewohner', description: 'Antilopen leben in offenen Landschaften und reagieren sehr früh auf Veränderungen in ihrer Umgebung.', iconAssetId: 'zooweb-animal-antelope', x: .18, y: .22, facts: animalFacts('antelope', 'Afrika', '10–20 Jahre', '40–80 kg', 'Gräser und Blätter') },
  { id: 'arctic-fox', categoryId: 'animals', title: 'Polarfuchs', subtitle: 'Arktischer Jäger', description: 'Der Polarfuchs ist mit seinem dichten Fell hervorragend an kalte Klimazonen angepasst.', iconAssetId: 'zooweb-animal-arctic-fox', x: .32, y: .18, facts: animalFacts('arctic-fox', 'Arktis', '3–6 Jahre', '3–8 kg', 'Kleintiere') },
  { id: 'porcupine', categoryId: 'animals', title: 'Stachelschwein', subtitle: 'Nachtaktiver Nager', description: 'Seine kräftigen Stacheln dienen als wirksamer Schutz, während es nachts auf Nahrungssuche geht.', iconAssetId: 'zooweb-animal-porcupine', x: .46, y: .28, facts: animalFacts('porcupine', 'Afrika und Asien', '12–15 Jahre', '10–27 kg', 'Wurzeln und Rinde') },
  { id: 'raccoon', categoryId: 'animals', title: 'Waschbär', subtitle: 'Geschickter Allesfresser', description: 'Waschbären sind neugierig und untersuchen ihre Umgebung mit sehr empfindlichen Vorderpfoten.', iconAssetId: 'zooweb-animal-raccoon', x: .74, y: .32, facts: animalFacts('raccoon', 'Nordamerika', '2–5 Jahre', '4–9 kg', 'Allesfresser') },
  { id: 'boar', categoryId: 'animals', title: 'Wildschwein', subtitle: 'Robuster Waldbewohner', description: 'Wildschweine erkunden den Boden gemeinsam auf der Suche nach Wurzeln, Insekten und Samen.', iconAssetId: 'zooweb-animal-boar', x: .20, y: .46, facts: animalFacts('boar', 'Europa und Asien', '10–15 Jahre', '50–120 kg', 'Wurzeln und Samen') },
  { id: 'bear', categoryId: 'animals', title: 'Bär', subtitle: 'Kraftvoller Allesfresser', description: 'Bären passen ihre Aktivität und Nahrungssuche an die Jahreszeit an.', iconAssetId: 'zooweb-animal-bear', x: .36, y: .52, facts: animalFacts('bear', 'Europa und Asien', '20–30 Jahre', '80–300 kg', 'Fisch und Beeren') },
  { id: 'rhino', categoryId: 'animals', title: 'Nashorn', subtitle: 'Großer Pflanzenfresser', description: 'Nashörner nutzen feste Wege zwischen Futter-, Wasser- und Ruheplätzen.', iconAssetId: 'zooweb-animal-rhino', x: .68, y: .54, facts: animalFacts('rhino', 'Afrika und Asien', '35–50 Jahre', '900–2300 kg', 'Gras und Zweige') },
  { id: 'deer', categoryId: 'animals', title: 'Hirsch', subtitle: 'Aufmerksamer Wiederkäuer', description: 'Hirsche bewegen sich aufmerksam durch ihr Umfeld und orientieren sich an ihrer Gruppe.', iconAssetId: 'zooweb-animal-deer', x: .82, y: .64, facts: animalFacts('deer', 'Europa und Asien', '10–20 Jahre', '70–200 kg', 'Kräuter und Blätter') },
  { id: 'lynx', categoryId: 'animals', title: 'Luchs', subtitle: 'Leiser Jäger', description: 'Der Luchs ist eine heimliche Katze mit starken Hinterbeinen und scharfen Sinnen.', iconAssetId: 'zooweb-animal-lynx', x: .30, y: .74, facts: animalFacts('lynx', 'Europa und Asien', '10–15 Jahre', '18–30 kg', 'Kleinsäuger') },
  { id: 'elephant', categoryId: 'animals', title: 'Elefant', subtitle: 'Sozialer Riese', description: 'Elefanten leben in stabilen Familienverbänden und kommunizieren über Berührung, Laute und Vibrationen.', iconAssetId: 'zooweb-animal-elephant', x: .58, y: .78, facts: animalFacts('elephant', 'Afrika und Asien', '60–70 Jahre', '2500–6000 kg', 'Heu und Obst') },
  { id: 'restaurant-1', categoryId: 'restaurants', title: 'Restaurant 1', subtitle: 'Essen & Trinken', description: 'Speisen, Getränke und eine Pause während des Zoobesuchs.', iconAssetId: 'zooweb-icon-restaurant', x: .62, y: .20 },
  { id: 'restroom-1', categoryId: 'restrooms', title: 'WC 1', subtitle: 'Toiletten', description: 'Öffentliche Toiletten für Besucherinnen und Besucher.', iconAssetId: 'zooweb-icon-restroom', x: .52, y: .60 },
  { id: 'souvenir-1', categoryId: 'souvenirs', title: 'Souvenirshop 1', subtitle: 'Geschenke & Andenken', description: 'Souvenirs und kleine Erinnerungen an den Zoobesuch.', iconAssetId: 'zooweb-icon-souvenir', x: .58, y: .78 },
  { id: 'entrance-1', categoryId: 'entrances', title: 'Eingang/Ausgang 1', subtitle: 'Ein- und Ausgang', description: 'Zugang zum Zoo und Ausgang vom Gelände.', iconAssetId: 'zooweb-icon-entrance', x: .40, y: .12 },
]

function buildDemoProject(): MapProject {
  let project = createEmptyProject({ id: 'zooweb-main', title: 'Zoo Osnabrück – Interaktive Karte' })
  for (const [sortOrder, category] of demoCategories.entries()) project = createCategory(project, { ...category, sortOrder })
  project = setBackground(project, { assetId: 'zooweb-map', width: 3427, height: 2038 })
  for (const item of demoItems) {
    project = createItem(project, {
      id: item.id,
      categoryId: item.categoryId,
      title: item.title,
      subtitle: item.subtitle,
      description: item.description,
      iconAssetId: item.iconAssetId,
      imageAssetId: item.categoryId === 'animals' ? 'zooweb-animal-preview' : null,
      position: { x: item.x, y: item.y },
      facts: item.facts ?? [],
      visible: true,
    })
  }
  return project
}

const builtinAssets: Array<{ id: string; url: string; name: string; kind: Asset['kind']; width: number; height: number }> = [
  { id: 'zooweb-map', url: '/zooweb/map.png', name: 'Zoo Osnabrück – Lageplan.png', kind: 'background', width: 3427, height: 2038 },
  { id: 'zooweb-animal-preview', url: '/zooweb/animal-preview.jpg', name: 'Tierporträt.jpg', kind: 'image', width: 1200, height: 1500 },
  ...['paw', 'restaurant', 'restroom', 'souvenir', 'entrance'].map((name) => ({ id: `zooweb-icon-${name}`, url: `/zooweb/icons/${name}.png`, name: `${name}.png`, kind: 'icon' as const, width: 512, height: 512 })),
  ...Object.entries({ antelope: [627, 627], 'arctic-fox': [836, 471], porcupine: [859, 458], raccoon: [789, 499], boar: [766, 514], bear: [790, 498], rhino: [770, 511], deer: [622, 633], lynx: [676, 582], elephant: [716, 550] }).map(([name, [width, height]]) => ({ id: `zooweb-animal-${name}`, url: `/zooweb/animals/${name}.png`, name: `${name}.png`, kind: 'icon' as const, width, height })),
  ...['region', 'lifespan', 'weight', 'food'].map((name) => ({ id: `zooweb-fact-${name}`, url: `/zooweb/facts/${name === 'food' ? 'food-type' : name}.png`, name: `${name}.png`, kind: 'icon' as const, width: 512, height: 512 })),
]

async function ensureBuiltinAssets() {
  for (const asset of builtinAssets) {
    const existing = await container.assetRepository.get(asset.id)
    if (existing?.asset.width === asset.width && existing.asset.height === asset.height) continue
    if (existing) await container.assetRepository.delete(asset.id)
    const response = await fetch(asset.url)
    if (!response.ok) throw new Error(`Asset konnte nicht geladen werden: ${asset.name}`)
    const blob = await response.blob()
    await container.assetRepository.put({ id: asset.id, blob, name: asset.name, mimeType: blob.type, kind: asset.kind, width: asset.width, height: asset.height })
  }
}

async function imageDimensions(blob: Blob): Promise<{ width: number | null; height: number | null }> {
  try {
    const bitmap = await createImageBitmap(blob)
    const dimensions = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dimensions
  } catch {
    const url = URL.createObjectURL(blob)
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve({ width: image.naturalWidth || null, height: image.naturalHeight || null })
        image.onerror = reject
        image.src = url
      })
    } catch {
      return { width: null, height: null }
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

async function loadAssetUrls(assets: Asset[]) {
  const entries = await Promise.all(assets.map(async (asset) => {
    const stored = await container.assetRepository.get(asset.id)
    return [asset.id, stored ? URL.createObjectURL(stored.blob) : ''] as const
  }))
  return Object.fromEntries(entries.filter(([, value]) => value))
}

function download(name: string, contents: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unbekannter Fehler'
}

export const useEditorStore = create<EditorState>((set, get) => {
  const syncHistory = () => set({ canUndo: history.canUndo(), canRedo: history.canRedo(), journal: history.getJournal() })

  const scheduleSave = (project: MapProject) => {
    if (saveTimer) clearTimeout(saveTimer)
    set({ saveStatus: 'dirty' })
    saveTimer = setTimeout(async () => {
      set({ saveStatus: 'saving' })
      try {
        await container.contentRepository.save(project)
        if (get().project?.updatedAt === project.updatedAt) set({ saveStatus: 'saved' })
      } catch (error) {
        set({ error: `Projekt konnte nicht gespeichert werden: ${errorMessage(error)}`, saveStatus: 'dirty' })
      }
    }, 550)
  }

  const commit = (type: OperationType, entityType: 'project' | 'item' | 'category' | 'asset', entityId: string, command: (project: MapProject) => MapProject) => {
    const project = get().project
    if (!project) return
    try {
      const next = history.execute(project, { type, affectedEntityType: entityType, affectedEntityId: entityId }, command)
      set({ project: next, error: null, dragPreview: null })
      scheduleSave(next)
      syncHistory()
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  }

  return {
    project: null,
    assets: [],
    assetUrls: {},
    selectedItemId: null,
    selectedCategoryId: null,
    inspectedCategoryId: null,
    search: '',
    visibilityFilter: 'all',
    activeTool: 'select',
    saveStatus: 'saved',
    loading: true,
    error: null,
    lastPublishedAt: null,
    publishedVersion: 0,
    canUndo: false,
    canRedo: false,
    journal: [],
    dragPreview: null,

    initialize: async () => {
      if (initialized) return
      initialized = true
      try {
        await ensureBuiltinAssets()
        let projects = await container.contentRepository.list()
        if (projects.length === 0) {
          const project = buildDemoProject()
          await container.contentRepository.save(project)
          projects = [project]
        }
        let project = projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
        if (project.id === 'zooweb-main' && project.backgroundAssetId === 'builtin-zoo-map') {
          project = buildDemoProject()
          await container.contentRepository.save(project)
          projects = projects.map((entry) => entry.id === project.id ? project : entry)
        }
        if (projects.every((entry) => entry.backgroundAssetId !== 'builtin-zoo-map')) {
          await container.assetRepository.delete('builtin-zoo-map')
        }
        const assets = await container.assetRepository.list()
        const assetUrls = await loadAssetUrls(assets)
        const latest = await container.publishRepository.getLatest(project.id)
        set({ project, assets, assetUrls, selectedItemId: project.items[0]?.id ?? null, inspectedCategoryId: null, loading: false, lastPublishedAt: latest?.publishedAt ?? null, publishedVersion: latest?.version ?? 0 })
      } catch (error) {
        initialized = false
        set({ loading: false, error: `Fehler beim Laden: ${errorMessage(error)}` })
      }
    },
    setSearch: (search) => set({ search }),
    setVisibilityFilter: (visibilityFilter) => set({ visibilityFilter }),
    setSelectedCategoryId: (selectedCategoryId) => set({ selectedCategoryId, inspectedCategoryId: selectedCategoryId, selectedItemId: null, activeTool: 'select' }),
    setInspectedCategoryId: (inspectedCategoryId) => set({ inspectedCategoryId }),
    setSelectedItemId: (selectedItemId) => set({ selectedItemId, inspectedCategoryId: null, activeTool: 'select' }),
    setActiveTool: (activeTool) => set({ activeTool }),

    createItemAt: (position) => {
      const project = get().project
      if (!project) return
      const categoryId = get().selectedCategoryId && project.categories.some((category) => category.id === get().selectedCategoryId) ? get().selectedCategoryId! : project.categories[0]?.id
      if (!categoryId) return set({ error: 'Erstellen Sie zuerst eine Kategorie' })
      const itemId = crypto.randomUUID()
      commit('createItem', 'item', itemId, (current) => createItem(current, { id: itemId, categoryId, title: 'Neuer Punkt', position }))
      set({ selectedItemId: itemId, inspectedCategoryId: null, activeTool: 'select' })
    },
    updateItem: (id, patch) => {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...allowed } = patch
      void _id; void _createdAt; void _updatedAt
      if (Object.keys(allowed).length) commit('updateItem', 'item', id, (project) => updateItem(project, { itemId: id, patch: allowed }))
    },
    moveItem: (id, position) => commit('moveItem', 'item', id, (project) => moveItem(project, { itemId: id, position })),
    previewMoveItem: (itemId, position) => set({ dragPreview: { itemId, position } }),
    duplicateSelected: () => {
      const itemId = get().selectedItemId
      if (!itemId) return
      const newId = crypto.randomUUID()
      commit('duplicateItem', 'item', itemId, (project) => duplicateItem(project, { itemId, id: newId }))
      set({ selectedItemId: newId })
    },
    deleteSelected: () => {
      const itemId = get().selectedItemId
      if (!itemId) return
      commit('deleteItem', 'item', itemId, (project) => deleteItem(project, { itemId }))
      set({ selectedItemId: null })
    },
    createCategory: () => {
      const id = crypto.randomUUID()
      commit('createCategory', 'category', id, (project) => createCategory(project, { id, name: 'Neue Kategorie', type: 'custom', color: '#4F8F64', defaultIconAssetId: null, markerStyle: 'circle', visible: true }))
      set({ selectedCategoryId: id, inspectedCategoryId: id, selectedItemId: null, activeTool: 'select' })
    },
    updateCategory: (id, patch) => {
      const { id: _id, ...allowed } = patch
      void _id
      if (Object.keys(allowed).length) commit('updateCategory', 'category', id, (project) => updateCategory(project, { categoryId: id, patch: allowed }))
    },
    updateAllCategories: (patch) => {
      const { id: _id, sortOrder: _sortOrder, ...allowed } = patch
      void _id; void _sortOrder
      if (!Object.keys(allowed).length) return
      commit('updateCategory', 'project', 'all-categories', (project) =>
        project.categories.reduce(
          (current, category) => updateCategory(current, { categoryId: category.id, patch: allowed }),
          project,
        ),
      )
    },
    deleteSelectedCategory: () => {
      const categoryId = get().inspectedCategoryId
      if (!categoryId || !get().project?.categories.some((category) => category.id === categoryId)) return
      commit('deleteCategory', 'category', categoryId, (project) => deleteCategory(project, { categoryId, deleteItems: true }))
      set({ selectedCategoryId: null, inspectedCategoryId: null, selectedItemId: null })
    },
    undo: () => {
      const project = get().project
      if (!project) return
      const change = history.undo(project)
      if (!change) return
      set({ project: change.project, dragPreview: null })
      scheduleSave(change.project)
      syncHistory()
    },
    redo: () => {
      const project = get().project
      if (!project) return
      const change = history.redo(project)
      if (!change) return
      set({ project: change.project, dragPreview: null })
      scheduleSave(change.project)
      syncHistory()
    },
    uploadAsset: async (file, kind) => {
      const dimensions = await imageDimensions(file)
      const asset = await container.assetRepository.put({ blob: file, name: file.name, mimeType: file.type, kind, ...dimensions })
      const stored = await container.assetRepository.get(asset.id)
      set((state) => ({ assets: [asset, ...state.assets], assetUrls: { ...state.assetUrls, [asset.id]: stored ? URL.createObjectURL(stored.blob) : '' } }))
      return asset
    },
    deleteAsset: async (id) => {
      const project = get().project
      if (!project) return
      const used = project.backgroundAssetId === id || project.categories.some((category) => category.defaultIconAssetId === id) || project.items.some((item) => item.iconAssetId === id || item.imageAssetId === id || item.facts.some((fact) => fact.iconAssetId === id))
      if (used) throw new Error('Diese Ressource wird vom Projekt verwendet')
      await container.assetRepository.delete(id)
      const url = get().assetUrls[id]
      if (url) URL.revokeObjectURL(url)
      set((state) => ({ assets: state.assets.filter((asset) => asset.id !== id), assetUrls: Object.fromEntries(Object.entries(state.assetUrls).filter(([assetId]) => assetId !== id)) }))
    },
    setBackgroundFile: async (file) => {
      const asset = await get().uploadAsset(file, 'background')
      if (!asset.width || !asset.height) throw new Error('Die Bildgröße konnte nicht ermittelt werden')
      commit('setBackground', 'project', get().project?.id ?? 'project', (project) => setBackground(project, { assetId: asset.id, width: asset.width!, height: asset.height! }))
    },
    setBackgroundColor: (color) => {
      commit(
        'setBackgroundColor',
        'project',
        get().project?.id ?? 'project',
        (project) => setBackgroundColor(project, { color }),
      )
    },
    importProjectFile: async (file) => {
      const project = importProjectFromJson(await file.text())
      await container.contentRepository.save(project)
      history.clear()
      set({ project, selectedItemId: project.items[0]?.id ?? null, selectedCategoryId: null, inspectedCategoryId: null, activeTool: 'select', saveStatus: 'saved', canUndo: false, canRedo: false, journal: [], error: null })
    },
    exportProject: () => {
      const project = get().project
      if (!project) return
      const safeTitle = project.title.replace(/[^a-zäöüß0-9]+/gi, '-').replace(/^-|-$/g, '').toLocaleLowerCase('de-DE')
      download(`${safeTitle || 'zoo-map'}.json`, exportProjectToJson(project))
    },
    publish: async () => {
      const project = get().project
      if (!project) throw new Error('Projekt ist nicht geladen')
      if (!project.backgroundAssetId) throw new Error('Laden Sie zuerst eine Hintergrundkarte hoch')
      const resolveUrl = (assetId: string) => `assets/${assetId}`
      const snapshot = await publishProject(project, {}, container.publishRepository, resolveUrl)
      set({ lastPublishedAt: snapshot.publishedAt, publishedVersion: snapshot.version })
      return snapshot.version
    },
  }
})
