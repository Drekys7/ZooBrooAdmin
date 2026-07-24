import { NormalizedPositionSchema, type NormalizedPosition } from "./models";

export type PixelPosition = { x: number; y: number };
export type ImageDimensions = { width: number; height: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export function normalizePosition(position: PixelPosition, dimensions?: ImageDimensions): NormalizedPosition {
  const x = dimensions ? position.x / dimensions.width : position.x;
  const y = dimensions ? position.y / dimensions.height : position.y;
  return NormalizedPositionSchema.parse({ x: clamp01(x), y: clamp01(y) });
}

export function denormalizePosition(position: NormalizedPosition, dimensions: ImageDimensions): PixelPosition {
  const normalized = NormalizedPositionSchema.parse(position);
  if (dimensions.width <= 0 || dimensions.height <= 0) {
    throw new RangeError("Image dimensions must be positive");
  }
  return { x: normalized.x * dimensions.width, y: normalized.y * dimensions.height };
}
