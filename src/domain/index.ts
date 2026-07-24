export * from "./coordinates";
export * from "./factories";
export * from "./models";

// Kept as a compatibility export for consumers that historically imported the
// published contract from the domain barrel. The source of truth is public-contract.
export {
  PublishedAssetSchema,
  PublishedBackgroundSchema,
  PublishedCategorySchema,
  PublishedFactSchema,
  PublishedMapItemSchema,
  PublishedZooMapSchema,
  validatePublishedZooMap,
} from "../public-contract";
export type {
  PublishedAsset,
  PublishedBackground,
  PublishedCategory,
  PublishedFact,
  PublishedMapItem,
  PublishedZooMap,
} from "../public-contract";
