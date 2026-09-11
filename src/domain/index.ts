export * from "./coordinates";
export * from "./eventSchedule";
export * from "./factories";
export * from "./models";
export * from "./localization";
export * from "./groups";

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
  PublishedMapSettingsSchema,
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
  PublishedMapSettings,
  PublishedZooMap,
} from "../public-contract";
