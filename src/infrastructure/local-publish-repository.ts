import { PublishedZooMapSchema, type PublishedZooMap } from "../public-contract";
import type { PublishRepository } from "../application";
import { ZooMapLocalDatabase, type PublishedRow } from "./local-database";

const recordId = (projectId: string, version: number) => `${projectId}:${version}`;

export class LocalPublishRepository implements PublishRepository {
  constructor(private readonly database: ZooMapLocalDatabase) {}

  async publish(snapshotValue: PublishedZooMap): Promise<void> {
    const snapshot = PublishedZooMapSchema.parse(structuredClone(snapshotValue));
    const row: PublishedRow = { ...snapshot, id: recordId(snapshot.projectId, snapshot.version) };
    try {
      await this.database.published.add(row);
    } catch (error) {
      const existing = await this.getVersion(snapshot.projectId, snapshot.version);
      if (existing) throw new Error(`Published version already exists: ${snapshot.projectId}@${snapshot.version}`, { cause: error });
      throw error;
    }
  }

  async getLatest(projectId: string): Promise<PublishedZooMap | undefined> {
    const rows = await this.database.published.where("projectId").equals(projectId).toArray();
    const latest = rows.sort((left, right) => right.version - left.version)[0];
    return latest ? this.snapshot(latest) : undefined;
  }

  async getVersion(projectId: string, version: number): Promise<PublishedZooMap | undefined> {
    const row = await this.database.published.get(recordId(projectId, version));
    return row ? this.snapshot(row) : undefined;
  }

  async list(projectId: string): Promise<PublishedZooMap[]> {
    const rows = await this.database.published.where("projectId").equals(projectId).toArray();
    return rows.sort((left, right) => right.version - left.version).map((row) => this.snapshot(row));
  }

  private snapshot(row: PublishedRow): PublishedZooMap {
    const { id: _id, ...snapshot } = row;
    return PublishedZooMapSchema.parse(snapshot);
  }
}
