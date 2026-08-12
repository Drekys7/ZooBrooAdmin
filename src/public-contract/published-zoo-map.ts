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
export const EventFrequencySchema = z.enum(['once', 'daily', 'weekly', 'monthly'])
export const WeekdaySchema = z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

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

export const PublishedMarkerOverridesSchema = z
  .object({
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
    markerOverrides: PublishedMarkerOverridesSchema.nullable().optional(),
    position: NormalizedPositionSchema,
    facts: z.array(PublishedFactSchema),
    visible: z.boolean(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .strict()

export const PublishedEventRecurrenceSchema = z.object({
  frequency: EventFrequencySchema,
  interval: z.number().int().min(1).max(52),
  weekdays: z.array(WeekdaySchema),
  monthDays: z.array(z.number().int().min(1).max(31)),
  endsOn: calendarDateSchema.nullable(),
}).strict()

export const PublishedEventSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1),
  description: z.string(),
  location: z.string(),
  relatedItemId: idSchema.nullable(),
  startDate: calendarDateSchema,
  startTime: clockTimeSchema,
  endTime: clockTimeSchema.nullable(),
  recurrence: PublishedEventRecurrenceSchema,
  visible: z.boolean(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
}).strict()

export const PublishedZooMapSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    projectId: idSchema,
    version: z.number().int().positive(),
    publishedAt: dateTimeSchema,
    background: PublishedBackgroundSchema,
    categories: z.array(PublishedCategorySchema),
    items: z.array(PublishedMapItemSchema),
    events: z.array(PublishedEventSchema).default([]),
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

    const eventIds = new Set<string>()
    for (const [index, event] of snapshot.events.entries()) {
      if (eventIds.has(event.id)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate event id: ${event.id}`, path: ['events', index, 'id'] })
      }
      eventIds.add(event.id)
      if (event.relatedItemId && !itemIds.has(event.relatedItemId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown item id: ${event.relatedItemId}`, path: ['events', index, 'relatedItemId'] })
      }
    }
  })

export type MapCategoryType = z.infer<typeof MapCategoryTypeSchema>
export type MarkerStyle = z.infer<typeof MarkerStyleSchema>
export type EventFrequency = z.infer<typeof EventFrequencySchema>
export type Weekday = z.infer<typeof WeekdaySchema>
export type PublishedAsset = z.infer<typeof PublishedAssetSchema>
export type PublishedBackground = z.infer<typeof PublishedBackgroundSchema>
export type NormalizedPosition = z.infer<typeof NormalizedPositionSchema>
export type PublishedCategory = z.infer<typeof PublishedCategorySchema>
export type PublishedFact = z.infer<typeof PublishedFactSchema>
export type PublishedMarkerOverrides = z.infer<typeof PublishedMarkerOverridesSchema>
export type PublishedMapItem = z.infer<typeof PublishedMapItemSchema>
export type PublishedEventRecurrence = z.infer<typeof PublishedEventRecurrenceSchema>
export type PublishedEvent = z.infer<typeof PublishedEventSchema>
export type PublishedZooMap = z.infer<typeof PublishedZooMapSchema>

/**
 * Parses data crossing the public boundary and returns a typed snapshot.
 * Throws ZodError when the payload does not satisfy the public contract.
 */
export function validatePublishedZooMap(input: unknown): PublishedZooMap {
  return PublishedZooMapSchema.parse(input)
}
