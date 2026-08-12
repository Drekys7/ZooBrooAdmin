import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_MAP_BACKGROUND_COLOR,
  MapProjectSchema,
  type MapProject,
} from "./models";

export type CreateEmptyProjectOptions = {
  id?: string;
  title?: string;
  now?: string;
};

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createId(): string {
  return makeId();
}

export function createEmptyProject(options: CreateEmptyProjectOptions = {}): MapProject {
  const now = options.now ?? new Date().toISOString();
  return MapProjectSchema.parse({
    id: options.id ?? makeId(),
    title: options.title ?? "Neue Zoo-Karte",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    backgroundAssetId: null,
    backgroundWidth: null,
    backgroundHeight: null,
    backgroundColor: DEFAULT_MAP_BACKGROUND_COLOR,
    categories: [],
    items: [],
    events: [],
    createdAt: now,
    updatedAt: now,
  });
}
