export * from "./coordinates";
export * from "./factories";
export * from "./models";

// Kept as a compatibility export for consumers that historically imported the
// published contract from the domain barrel. The source of truth is public-contract.
export {
  PublishedAssetSchema,
  PublishedBackgroundSchema,
  PublishedCategorySchema,
  PublishedEventRecurrenceSchema,
  PublishedEventSchema,
  PublishedFactSchema,
  PublishedMapItemSchema,
  PublishedZooMapSchema,
  validatePublishedZooMap,
} from "../public-contract";
export type {
  PublishedAsset,
  PublishedBackground,
  PublishedCategory,
  PublishedEvent,
  PublishedEventRecurrence,
  PublishedFact,
  PublishedMapItem,
  PublishedZooMap,
} from "../public-contract";
