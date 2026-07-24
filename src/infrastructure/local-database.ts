import Dexie, { type EntityTable } from "dexie";
import type { Asset, MapProject } from "../domain";
import type { PublishedZooMap } from "../public-contract";

export type AssetRow = Asset & { data: ArrayBuffer };
export type PublishedRow = PublishedZooMap & { id: string };

export class ZooMapLocalDatabase extends Dexie {
  projects!: EntityTable<MapProject, "id">;
  assets!: EntityTable<AssetRow, "id">;
  published!: EntityTable<PublishedRow, "id">;

  constructor(name = "zooweb-map-admin") {
    super(name);
    this.version(1).stores({
      projects: "id, updatedAt",
      assets: "id, kind, createdAt",
      published: "id, projectId, [projectId+version], publishedAt",
    });
  }
}
