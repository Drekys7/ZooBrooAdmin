import type { AssetRepository, ContentRepository, PublishRepository } from "../application";
import { LocalAssetRepository } from "./local-asset-repository";
import { LocalContentRepository } from "./local-content-repository";
import { ZooMapLocalDatabase } from "./local-database";
import { LocalPublishRepository } from "./local-publish-repository";
import { resetTestRelease } from './test-release-reset';

export type ApplicationContainer = {
  contentRepository: ContentRepository;
  assetRepository: AssetRepository;
  publishRepository: PublishRepository;
  migrateMapMarkers(): Promise<void>;
  close(): void;
};

export function createLocalApplication(databaseName?: string): ApplicationContainer {
  const database = new ZooMapLocalDatabase(databaseName);
  return {
    contentRepository: new LocalContentRepository(database),
    assetRepository: new LocalAssetRepository(database),
    publishRepository: new LocalPublishRepository(database),
    migrateMapMarkers: async () => {
      // The current complete template supersedes all incremental test-data migrations.
      await resetTestRelease(database);
    },
    close: () => database.close(),
  };
}

export const createApplicationContainer = createLocalApplication;
