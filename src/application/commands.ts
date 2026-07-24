import { z } from "zod";
import {
  CategoryTypeSchema,
  EntityIdSchema,
  MapCategorySchema,
  MapFactSchema,
  MapItemSchema,
  MapProjectSchema,
  normalizePosition,
  createId,
  type MapProject,
} from "../domain";

const RawPositionSchema = z.object({ x: z.number().finite(), y: z.number().finite() });
const NullableIdSchema = EntityIdSchema.nullable();

export const CreateItemInputSchema = z.object({
  id: EntityIdSchema.optional(),
  categoryId: EntityIdSchema,
  type: CategoryTypeSchema.optional(),
  title: z.string().trim().min(1).default("Neuer Punkt"),
  subtitle: z.string().default(""),
  description: z.string().default(""),
  iconAssetId: NullableIdSchema.optional().default(null),
  imageAssetId: NullableIdSchema.optional().default(null),
  position: RawPositionSchema,
  facts: z.array(MapFactSchema).default([]),
  visible: z.boolean().default(true),
  now: z.string().datetime().optional(),
});

export const UpdateItemInputSchema = z.object({
  itemId: EntityIdSchema,
  patch: z
    .object({
      categoryId: EntityIdSchema,
      type: CategoryTypeSchema,
      title: z.string().trim().min(1),
      subtitle: z.string(),
      description: z.string(),
      iconAssetId: NullableIdSchema,
      imageAssetId: NullableIdSchema,
      position: RawPositionSchema,
      facts: z.array(MapFactSchema),
      visible: z.boolean(),
    })
    .partial()
    .refine((patch) => Object.keys(patch).length > 0, "Patch cannot be empty"),
  now: z.string().datetime().optional(),
});

export const MoveItemInputSchema = z.object({
  itemId: EntityIdSchema,
  position: RawPositionSchema,
  now: z.string().datetime().optional(),
});

export const DuplicateItemInputSchema = z.object({
  itemId: EntityIdSchema,
  id: EntityIdSchema.optional(),
  offset: RawPositionSchema.default({ x: 0.02, y: 0.02 }),
  title: z.string().trim().min(1).optional(),
  now: z.string().datetime().optional(),
});

export const DeleteItemInputSchema = z.object({ itemId: EntityIdSchema, now: z.string().datetime().optional() });

export const CreateCategoryInputSchema = MapCategorySchema.omit({ id: true, sortOrder: true }).extend({
  id: EntityIdSchema.optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  now: z.string().datetime().optional(),
});

export const UpdateCategoryInputSchema = z.object({
  categoryId: EntityIdSchema,
  patch: MapCategorySchema.omit({ id: true }).partial().refine((patch) => Object.keys(patch).length > 0),
  now: z.string().datetime().optional(),
});

export const DeleteCategoryInputSchema = z.object({
  categoryId: EntityIdSchema,
  deleteItems: z.boolean().default(true),
  now: z.string().datetime().optional(),
});

export const SetBackgroundInputSchema = z.union([
  z.object({ assetId: z.null(), now: z.string().datetime().optional() }),
  z.object({
    assetId: EntityIdSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    now: z.string().datetime().optional(),
  }),
]);

export type CreateItemInput = z.input<typeof CreateItemInputSchema>;
export type UpdateItemInput = z.input<typeof UpdateItemInputSchema>;
export type MoveItemInput = z.input<typeof MoveItemInputSchema>;
export type DuplicateItemInput = z.input<typeof DuplicateItemInputSchema>;
export type DeleteItemInput = z.input<typeof DeleteItemInputSchema>;
export type CreateCategoryInput = z.input<typeof CreateCategoryInputSchema>;
export type UpdateCategoryInput = z.input<typeof UpdateCategoryInputSchema>;
export type DeleteCategoryInput = z.input<typeof DeleteCategoryInputSchema>;
export type SetBackgroundInput = z.input<typeof SetBackgroundInputSchema>;

const timestamp = (now?: string) => now ?? new Date().toISOString();

function checkedProject(project: MapProject): MapProject {
  return MapProjectSchema.parse(project);
}

function finish(project: MapProject): MapProject {
  return MapProjectSchema.parse(project);
}

function requireCategory(project: MapProject, id: string) {
  const category = project.categories.find((candidate) => candidate.id === id);
  if (!category) throw new Error(`Category not found: ${id}`);
  return category;
}

function requireItem(project: MapProject, id: string) {
  const item = project.items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Item not found: ${id}`);
  return item;
}

export function createItem(projectValue: MapProject, inputValue: CreateItemInput): MapProject {
  const project = checkedProject(projectValue);
  const input = CreateItemInputSchema.parse(inputValue);
  const category = requireCategory(project, input.categoryId);
  const id = input.id ?? createId();
  if (project.items.some((item) => item.id === id)) throw new Error(`Item already exists: ${id}`);
  const now = timestamp(input.now);
  const item = MapItemSchema.parse({ ...input, id, type: input.type ?? category.type, position: normalizePosition(input.position), createdAt: now, updatedAt: now });
  return finish({ ...project, items: [...project.items, item], updatedAt: now });
}

export function updateItem(projectValue: MapProject, inputValue: UpdateItemInput): MapProject {
  const project = checkedProject(projectValue);
  const input = UpdateItemInputSchema.parse(inputValue);
  const existing = requireItem(project, input.itemId);
  const category = input.patch.categoryId ? requireCategory(project, input.patch.categoryId) : undefined;
  const now = timestamp(input.now);
  const patch = { ...input.patch, ...(input.patch.position ? { position: normalizePosition(input.patch.position) } : {}) };
  if (category && input.patch.type === undefined) patch.type = category.type;
  const item = MapItemSchema.parse({ ...existing, ...patch, updatedAt: now });
  return finish({ ...project, items: project.items.map((value) => (value.id === item.id ? item : value)), updatedAt: now });
}

export function moveItem(project: MapProject, inputValue: MoveItemInput): MapProject {
  const input = MoveItemInputSchema.parse(inputValue);
  return updateItem(project, { itemId: input.itemId, patch: { position: normalizePosition(input.position) }, now: input.now });
}

export function duplicateItem(projectValue: MapProject, inputValue: DuplicateItemInput): MapProject {
  const project = checkedProject(projectValue);
  const input = DuplicateItemInputSchema.parse(inputValue);
  const source = requireItem(project, input.itemId);
  const id = input.id ?? createId();
  if (project.items.some((item) => item.id === id)) throw new Error(`Item already exists: ${id}`);
  const now = timestamp(input.now);
  const item = MapItemSchema.parse({
    ...source,
    id,
    title: input.title ?? `${source.title} (Kopie)`,
    position: normalizePosition({ x: source.position.x + input.offset.x, y: source.position.y + input.offset.y }),
    facts: source.facts.map((fact) => ({ ...fact, id: createId() })),
    createdAt: now,
    updatedAt: now,
  });
  return finish({ ...project, items: [...project.items, item], updatedAt: now });
}

export function deleteItem(projectValue: MapProject, inputValue: DeleteItemInput): MapProject {
  const project = checkedProject(projectValue);
  const input = DeleteItemInputSchema.parse(inputValue);
  requireItem(project, input.itemId);
  const now = timestamp(input.now);
  return finish({ ...project, items: project.items.filter((item) => item.id !== input.itemId), updatedAt: now });
}

export function createCategory(projectValue: MapProject, inputValue: CreateCategoryInput): MapProject {
  const project = checkedProject(projectValue);
  const input = CreateCategoryInputSchema.parse(inputValue);
  const id = input.id ?? createId();
  if (project.categories.some((category) => category.id === id)) throw new Error(`Category already exists: ${id}`);
  const category = MapCategorySchema.parse({ ...input, id, sortOrder: input.sortOrder ?? project.categories.length });
  const now = timestamp(input.now);
  return finish({ ...project, categories: [...project.categories, category], updatedAt: now });
}

export function updateCategory(projectValue: MapProject, inputValue: UpdateCategoryInput): MapProject {
  const project = checkedProject(projectValue);
  const input = UpdateCategoryInputSchema.parse(inputValue);
  const existing = requireCategory(project, input.categoryId);
  const category = MapCategorySchema.parse({ ...existing, ...input.patch });
  const now = timestamp(input.now);
  const items = input.patch.type
    ? project.items.map((item) => (item.categoryId === category.id ? { ...item, type: category.type, updatedAt: now } : item))
    : project.items;
  return finish({ ...project, categories: project.categories.map((value) => (value.id === category.id ? category : value)), items, updatedAt: now });
}

export function deleteCategory(projectValue: MapProject, inputValue: DeleteCategoryInput): MapProject {
  const project = checkedProject(projectValue);
  const input = DeleteCategoryInputSchema.parse(inputValue);
  requireCategory(project, input.categoryId);
  const hasItems = project.items.some((item) => item.categoryId === input.categoryId);
  if (hasItems && !input.deleteItems) throw new Error(`Category ${input.categoryId} is not empty`);
  const now = timestamp(input.now);
  return finish({
    ...project,
    categories: project.categories.filter((category) => category.id !== input.categoryId),
    items: project.items.filter((item) => item.categoryId !== input.categoryId),
    updatedAt: now,
  });
}

export function setBackground(projectValue: MapProject, inputValue: SetBackgroundInput): MapProject {
  const project = checkedProject(projectValue);
  const input = SetBackgroundInputSchema.parse(inputValue);
  const now = timestamp(input.now);
  return finish({
    ...project,
    backgroundAssetId: input.assetId,
    backgroundWidth: input.assetId === null ? null : input.width,
    backgroundHeight: input.assetId === null ? null : input.height,
    updatedAt: now,
  });
}
