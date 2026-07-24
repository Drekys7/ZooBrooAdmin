import type { Asset, AssetKind, MapProject } from "../domain";
import type { PublishedZooMap } from "../public-contract";

export interface ContentRepository {
  get(projectId: string): Promise<MapProject | undefined>;
  list(): Promise<MapProject[]>;
  save(project: MapProject): Promise<void>;
  delete(projectId: string): Promise<void>;
}

export type SaveAssetInput = {
  id?: string;
  blob: Blob;
  name: string;
  mimeType?: string;
  kind: AssetKind;
  width?: number | null;
  height?: number | null;
};

export type StoredAsset = {
  asset: Asset;
  blob: Blob;
};

export interface AssetRepository {
  put(input: SaveAssetInput): Promise<Asset>;
  get(assetId: string): Promise<StoredAsset | undefined>;
  list(): Promise<Asset[]>;
  delete(assetId: string): Promise<void>;
}

export interface PublishRepository {
  publish(snapshot: PublishedZooMap): Promise<void>;
  getLatest(projectId: string): Promise<PublishedZooMap | undefined>;
  getVersion(projectId: string, version: number): Promise<PublishedZooMap | undefined>;
  list(projectId: string): Promise<PublishedZooMap[]>;
}
