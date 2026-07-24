import { AssetSchema, createId, type Asset } from "../domain";
import type { AssetRepository, SaveAssetInput, StoredAsset } from "../application";
import { ZooMapLocalDatabase, type AssetRow } from "./local-database";

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read asset"));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
}

export class LocalAssetRepository implements AssetRepository {
  constructor(private readonly database: ZooMapLocalDatabase) {}

  async put(input: SaveAssetInput): Promise<Asset> {
    const asset = AssetSchema.parse({
      id: input.id ?? createId(),
      name: input.name,
      mimeType: input.mimeType || input.blob.type || "application/octet-stream",
      size: input.blob.size,
      kind: input.kind,
      width: input.width ?? null,
      height: input.height ?? null,
      createdAt: new Date().toISOString(),
    });
    const existing = await this.database.assets.get(asset.id);
    if (existing) throw new Error(`Asset already exists: ${asset.id}`);
    await this.database.assets.add({ ...asset, data: await readBlob(input.blob) });
    return asset;
  }

  async get(assetId: string): Promise<StoredAsset | undefined> {
    const row = await this.database.assets.get(assetId);
    if (!row) return undefined;
    const asset = this.metadata(row);
    return { asset, blob: new Blob([row.data], { type: asset.mimeType }) };
  }

  async list(): Promise<Asset[]> {
    const rows = await this.database.assets.orderBy("createdAt").reverse().toArray();
    return rows.map((row) => this.metadata(row));
  }

  async delete(assetId: string): Promise<void> {
    await this.database.assets.delete(assetId);
  }

  private metadata(row: AssetRow): Asset {
    const { data: _data, ...asset } = row;
    return AssetSchema.parse(asset);
  }
}
