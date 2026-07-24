import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 1 as const;

export const EntityIdSchema = z.string().trim().min(1);
export const IsoDateSchema = z.string().datetime();
export const CategoryTypeSchema = z.enum([
  "animal",
  "restaurant",
  "restroom",
  "souvenir",
  "entrance",
  "custom",
]);

export const NormalizedPositionSchema = z.object({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
});

export const MapFactSchema = z.object({
  id: EntityIdSchema,
  label: z.string().trim().min(1),
  value: z.string(),
  iconAssetId: EntityIdSchema.nullish(),
});

export const MapCategorySchema = z.object({
  id: EntityIdSchema,
  name: z.string().trim().min(1),
  type: CategoryTypeSchema,
  color: z.string().trim().min(1),
  defaultIconAssetId: EntityIdSchema.nullish(),
  visible: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});

export const MapItemSchema = z.object({
  id: EntityIdSchema,
  categoryId: EntityIdSchema,
  type: CategoryTypeSchema,
  title: z.string().trim().min(1),
  subtitle: z.string(),
  description: z.string(),
  iconAssetId: EntityIdSchema.nullish(),
  imageAssetId: EntityIdSchema.nullish(),
  position: NormalizedPositionSchema,
  facts: z.array(MapFactSchema),
  visible: z.boolean(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const MapProjectSchema = z
  .object({
    id: EntityIdSchema,
    title: z.string().trim().min(1),
    schemaVersion: z.number().int().positive(),
    backgroundAssetId: EntityIdSchema.nullable(),
    backgroundWidth: z.number().int().positive().nullable(),
    backgroundHeight: z.number().int().positive().nullable(),
    categories: z.array(MapCategorySchema),
    items: z.array(MapItemSchema),
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
  })
  .superRefine((project, context) => {
    const categoryIds = new Set<string>();
    for (const category of project.categories) {
      if (categoryIds.has(category.id)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate category id: ${category.id}` });
      }
      categoryIds.add(category.id);
    }

    const itemIds = new Set<string>();
    for (const item of project.items) {
      if (itemIds.has(item.id)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate item id: ${item.id}` });
      }
      itemIds.add(item.id);
      if (!categoryIds.has(item.categoryId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Item ${item.id} references unknown category ${item.categoryId}`,
        });
      }
    }

    const hasBackground = project.backgroundAssetId !== null;
    if (hasBackground !== (project.backgroundWidth !== null && project.backgroundHeight !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Background id, width and height must either all be present or all be null",
      });
    }
  });

export const AssetKindSchema = z.enum(["background", "image", "icon"]);

export const AssetSchema = z.object({
  id: EntityIdSchema,
  name: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  size: z.number().int().nonnegative(),
  kind: AssetKindSchema,
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  createdAt: IsoDateSchema,
});

export type CategoryType = z.infer<typeof CategoryTypeSchema>;
export type NormalizedPosition = z.infer<typeof NormalizedPositionSchema>;
export type MapFact = z.infer<typeof MapFactSchema>;
export type MapCategory = z.infer<typeof MapCategorySchema>;
export type MapItem = z.infer<typeof MapItemSchema>;
export type MapProject = z.infer<typeof MapProjectSchema>;
export type AssetKind = z.infer<typeof AssetKindSchema>;
export type Asset = z.infer<typeof AssetSchema>;
