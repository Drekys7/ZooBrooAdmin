import type { AssetRepository, ContentRepository, PublishRepository } from "../application";
import { LocalAssetRepository } from "./local-asset-repository";
import { LocalContentRepository } from "./local-content-repository";
import { ZooMapLocalDatabase } from "./local-database";
import { LocalPublishRepository } from "./local-publish-repository";

export type ApplicationContainer = {
  contentRepository: ContentRepository;
  assetRepository: AssetRepository;
  publishRepository: PublishRepository;
  close(): void;
};

export function createLocalApplication(databaseName?: string): ApplicationContainer {
  const database = new ZooMapLocalDatabase(databaseName);
  return {
    contentRepository: new LocalContentRepository(database),
    assetRepository: new LocalAssetRepository(database),
    publishRepository: new LocalPublishRepository(database),
    close: () => database.close(),
  };
}

export const createApplicationContainer = createLocalApplication;
