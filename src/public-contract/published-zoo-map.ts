import { z } from 'zod'

const idSchema = z.string().trim().min(1)
const dateTimeSchema = z.string().datetime({ offset: true })

export const MapCategoryTypeSchema = z.enum([
  'animal',
  'restaurant',
  'restroom',
  'souvenir',
  'entrance',
  'custom',
])
export const MarkerStyleSchema = z.enum(['image', 'circle', 'pin'])

export const PublishedAssetSchema = z
  .object({
    assetId: idSchema,
    url: z.string().trim().min(1),
  })
  .strict()

export const PublishedBackgroundSchema = PublishedAssetSchema.extend({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#DDDDDD'),
}).strict()

export const NormalizedPositionSchema = z
  .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
  })
  .strict()

export const PublishedCategorySchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1),
    type: MapCategoryTypeSchema,
    color: z.string().trim().min(1),
    defaultIcon: PublishedAssetSchema.nullable(),
    markerStyle: MarkerStyleSchema.optional(),
    iconScale: z.number().finite().min(0.5).max(2).optional(),
    iconContentScale: z.number().finite().min(0.5).max(1.5).optional(),
    outlineEnabled: z.boolean().optional(),
    outlineWidth: z.number().finite().min(0.5).max(10).optional(),
    outlineColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    visible: z.boolean(),
    sortOrder: z.number().int(),
  })
  .strict()

export const PublishedFactSchema = z
  .object({
    id: idSchema,
    label: z.string().trim().min(1),
    value: z.string(),
    icon: PublishedAssetSchema.nullable(),
  })
  .strict()

export const PublishedMapItemSchema = z
  .object({
    id: idSchema,
    categoryId: idSchema,
    type: MapCategoryTypeSchema,
    title: z.string().trim().min(1),
    subtitle: z.string(),
    description: z.string(),
    icon: PublishedAssetSchema.nullable(),
    image: PublishedAssetSchema.nullable(),
    colorOverride: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
    position: NormalizedPositionSchema,
    facts: z.array(PublishedFactSchema),
    visible: z.boolean(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .strict()

export const PublishedZooMapSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    projectId: idSchema,
    version: z.number().int().positive(),
    publishedAt: dateTimeSchema,
    background: PublishedBackgroundSchema,
    categories: z.array(PublishedCategorySchema),
    items: z.array(PublishedMapItemSchema),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const categoryIds = new Set<string>()

    for (const [index, category] of snapshot.categories.entries()) {
      if (categoryIds.has(category.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate category id: ${category.id}`,
          path: ['categories', index, 'id'],
        })
      }
      categoryIds.add(category.id)
    }

    const itemIds = new Set<string>()
    for (const [index, item] of snapshot.items.entries()) {
      if (itemIds.has(item.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate item id: ${item.id}`,
          path: ['items', index, 'id'],
        })
      }
      itemIds.add(item.id)

      if (!categoryIds.has(item.categoryId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown category id: ${item.categoryId}`,
          path: ['items', index, 'categoryId'],
        })
      }
    }
  })

export type MapCategoryType = z.infer<typeof MapCategoryTypeSchema>
export type MarkerStyle = z.infer<typeof MarkerStyleSchema>
export type PublishedAsset = z.infer<typeof PublishedAssetSchema>
export type PublishedBackground = z.infer<typeof PublishedBackgroundSchema>
export type NormalizedPosition = z.infer<typeof NormalizedPositionSchema>
export type PublishedCategory = z.infer<typeof PublishedCategorySchema>
export type PublishedFact = z.infer<typeof PublishedFactSchema>
export type PublishedMapItem = z.infer<typeof PublishedMapItemSchema>
export type PublishedZooMap = z.infer<typeof PublishedZooMapSchema>

/**
 * Parses data crossing the public boundary and returns a typed snapshot.
 * Throws ZodError when the payload does not satisfy the public contract.
 */
export function validatePublishedZooMap(input: unknown): PublishedZooMap {
  return PublishedZooMapSchema.parse(input)
}
