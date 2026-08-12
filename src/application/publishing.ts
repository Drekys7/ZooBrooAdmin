import { z } from "zod";
import {
  categoryIconScale,
  categoryIconContentScale,
  categoryIconBackgroundColor,
  categoryColorizeIcon,
  categoryImageMaskRadius,
  categoryMarkerStyle,
  categoryOutlineColor,
  categoryOutlineEnabled,
  categoryOutlineWidth,
  categoryShadowBlur,
  categoryShadowColor,
  categoryShadowEnabled,
  categoryShadowOpacity,
  type MapProject,
} from "../domain";
import {
  PublishedZooMapSchema,
  type PublishedAsset,
  type PublishedZooMap,
} from "../public-contract";
import type { PublishRepository } from "./repositories";

export const PublishProjectInputSchema = z.object({
  version: z.number().int().positive().optional(),
  publishedAt: z.string().datetime({ offset: true }).optional(),
});

export type PublishProjectInput = z.input<typeof PublishProjectInputSchema>;
export type AssetUrlResolver = (assetId: string) => string;

/** Stable local reference; a Firebase composition root can inject an HTTPS resolver. */
export const defaultAssetUrlResolver: AssetUrlResolver = (assetId) => `asset://${encodeURIComponent(assetId)}`;

function publishedAsset(
  assetId: string | null | undefined,
  resolveAssetUrl: AssetUrlResolver,
): PublishedAsset | null {
  if (!assetId) return null;
  const url = resolveAssetUrl(assetId);
  if (!url.trim()) throw new Error(`Asset URL resolver returned an empty URL for ${assetId}`);
  return { assetId, url };
}

export function buildPublishedSnapshot(
  project: MapProject,
  version: number,
  publishedAt = new Date().toISOString(),
  resolveAssetUrl: AssetUrlResolver = defaultAssetUrlResolver,
): PublishedZooMap {
  if (!project.backgroundAssetId || !project.backgroundWidth || !project.backgroundHeight) {
    throw new Error("Project must have a background before it can be published");
  }

  const backgroundAsset = publishedAsset(project.backgroundAssetId, resolveAssetUrl);
  if (!backgroundAsset) throw new Error("Unable to resolve the project background");

  return PublishedZooMapSchema.parse({
    schemaVersion: project.schemaVersion,
    projectId: project.id,
    version,
    publishedAt,
    background: {
      ...backgroundAsset,
      width: project.backgroundWidth,
      height: project.backgroundHeight,
      color: project.backgroundColor,
    },
    categories: project.categories.map((category) => ({
      id: category.id,
      name: category.name,
      type: category.type,
      color: category.color,
      defaultIcon: publishedAsset(category.defaultIconAssetId, resolveAssetUrl),
      markerStyle: categoryMarkerStyle(category),
      iconScale: categoryIconScale(category),
      iconContentScale: categoryIconContentScale(category),
      imageMaskRadius: categoryImageMaskRadius(category),
      iconBackgroundColor: categoryIconBackgroundColor(category),
      colorizeIcon: categoryColorizeIcon(category),
      outlineEnabled: categoryOutlineEnabled(category),
      outlineWidth: categoryOutlineWidth(category),
      outlineColor: categoryOutlineColor(category),
      shadowEnabled: categoryShadowEnabled(category),
      shadowBlur: categoryShadowBlur(category),
      shadowOpacity: categoryShadowOpacity(category),
      shadowColor: categoryShadowColor(category),
      visible: category.visible,
      sortOrder: category.sortOrder,
    })),
    items: project.items.map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      type: item.type,
      title: item.title,
      subtitle: item.subtitle,
      description: item.description,
      icon: publishedAsset(item.iconAssetId, resolveAssetUrl),
      image: publishedAsset(item.imageAssetId, resolveAssetUrl),
      colorOverride: item.colorOverride ?? null,
      markerOverrides: item.markerOverrides ?? (item.colorOverride ? { color: item.colorOverride } : null),
      position: item.position,
      facts: item.facts.map((fact) => ({
        id: fact.id,
        label: fact.label,
        value: fact.value,
        icon: publishedAsset(fact.iconAssetId, resolveAssetUrl),
      })),
      visible: item.visible,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    events: project.events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      relatedItemId: event.relatedItemId ?? null,
      startDate: event.startDate,
      startTime: event.startTime,
      endTime: event.endTime ?? null,
      recurrence: event.recurrence,
      visible: event.visible,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    })),
  });
}

export async function publishProject(
  project: MapProject,
  inputValue: PublishProjectInput,
  repository: PublishRepository,
  resolveAssetUrl: AssetUrlResolver = defaultAssetUrlResolver,
): Promise<PublishedZooMap> {
  const input = PublishProjectInputSchema.parse(inputValue);
  const latest = input.version === undefined ? await repository.getLatest(project.id) : undefined;
  const snapshot = buildPublishedSnapshot(
    project,
    input.version ?? (latest?.version ?? 0) + 1,
    input.publishedAt,
    resolveAssetUrl,
  );
  await repository.publish(snapshot);
  return snapshot;
}
