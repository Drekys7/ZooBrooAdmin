import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 1 as const;
export const DEFAULT_MAP_BACKGROUND_COLOR = "#DDDDDD";

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
export const MarkerStyleSchema = z.enum(["image", "circle", "pin"]);

export const NormalizedPositionSchema = z.object({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
});

export const MapBackgroundColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i)
  .default(DEFAULT_MAP_BACKGROUND_COLOR);

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
  markerStyle: MarkerStyleSchema.optional(),
  iconScale: z.number().finite().min(0.5).max(2).optional(),
  iconContentScale: z.number().finite().min(0.5).max(1.5).optional(),
  imageMaskRadius: z.number().finite().min(0).max(100).optional(),
  iconBackgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  colorizeIcon: z.boolean().optional(),
  outlineEnabled: z.boolean().optional(),
  outlineWidth: z.number().finite().min(0.5).max(10).optional(),
  outlineColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  shadowEnabled: z.boolean().optional(),
  shadowBlur: z.number().finite().min(0).max(30).optional(),
  shadowOpacity: z.number().finite().min(0).max(100).optional(),
  shadowColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  visible: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});

export const MarkerOverridesSchema = z.object({
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  markerStyle: MarkerStyleSchema.optional(),
  iconScale: z.number().finite().min(0.5).max(2).optional(),
  iconContentScale: z.number().finite().min(0.5).max(1.5).optional(),
  imageMaskRadius: z.number().finite().min(0).max(100).optional(),
  iconBackgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  colorizeIcon: z.boolean().optional(),
  outlineEnabled: z.boolean().optional(),
  outlineWidth: z.number().finite().min(0.5).max(10).optional(),
  outlineColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  shadowEnabled: z.boolean().optional(),
  shadowBlur: z.number().finite().min(0).max(30).optional(),
  shadowOpacity: z.number().finite().min(0).max(100).optional(),
  shadowColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
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
  colorOverride: z.string().regex(/^#[0-9a-f]{6}$/i).nullish(),
  markerOverrides: MarkerOverridesSchema.nullish(),
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
    backgroundColor: MapBackgroundColorSchema,
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
export type MarkerStyle = z.infer<typeof MarkerStyleSchema>;
export type NormalizedPosition = z.infer<typeof NormalizedPositionSchema>;
export type MapFact = z.infer<typeof MapFactSchema>;
export type MapCategory = z.infer<typeof MapCategorySchema>;
export type MarkerOverrides = z.infer<typeof MarkerOverridesSchema>;
export type MapItem = z.infer<typeof MapItemSchema>;
export type MapProject = z.infer<typeof MapProjectSchema>;
export type AssetKind = z.infer<typeof AssetKindSchema>;
export type Asset = z.infer<typeof AssetSchema>;

export function categoryMarkerStyle(category: Pick<MapCategory, "type" | "markerStyle">): MarkerStyle {
  return category.markerStyle ?? (category.type === "animal" ? "image" : "circle");
}

export function categoryIconScale(category: Pick<MapCategory, "iconScale">): number {
  return category.iconScale ?? 1;
}

export function categoryIconContentScale(category: Pick<MapCategory, "iconContentScale">): number {
  return category.iconContentScale ?? 1;
}

export function categoryImageMaskRadius(category: Pick<MapCategory, "imageMaskRadius">): number {
  return category.imageMaskRadius ?? 100;
}

export function categoryIconBackgroundColor(category: Pick<MapCategory, "iconBackgroundColor">): string {
  return category.iconBackgroundColor ?? "#FFFFFF";
}

export function categoryColorizeIcon(category: Pick<MapCategory, "colorizeIcon">): boolean {
  return category.colorizeIcon ?? false;
}

export function categoryOutlineEnabled(category: Pick<MapCategory, "outlineEnabled">): boolean {
  return category.outlineEnabled ?? false;
}

export function categoryOutlineWidth(category: Pick<MapCategory, "outlineWidth">): number {
  return category.outlineWidth ?? 2;
}

export function categoryOutlineColor(category: Pick<MapCategory, "outlineColor">): string {
  return category.outlineColor ?? "#FF0000";
}

export function categoryShadowEnabled(category: Pick<MapCategory, "shadowEnabled">): boolean {
  return category.shadowEnabled ?? true;
}

export function categoryShadowBlur(category: Pick<MapCategory, "shadowBlur">): number {
  return category.shadowBlur ?? 10;
}

export function categoryShadowOpacity(category: Pick<MapCategory, "shadowOpacity">): number {
  return category.shadowOpacity ?? 22;
}

export function categoryShadowColor(category: Pick<MapCategory, "shadowColor">): string {
  return category.shadowColor ?? "#000000";
}
