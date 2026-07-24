import { MapProjectSchema, type MapProject } from "../domain";
import type { ContentRepository } from "../application";
import { ZooMapLocalDatabase } from "./local-database";

export class LocalContentRepository implements ContentRepository {
  constructor(private readonly database: ZooMapLocalDatabase) {}

  async get(projectId: string): Promise<MapProject | undefined> {
    const project = await this.database.projects.get(projectId);
    return project ? MapProjectSchema.parse(project) : undefined;
  }

  async list(): Promise<MapProject[]> {
    const projects = await this.database.projects.orderBy("updatedAt").reverse().toArray();
    return projects.map((project) => MapProjectSchema.parse(project));
  }

  async save(project: MapProject): Promise<void> {
    await this.database.projects.put(MapProjectSchema.parse(structuredClone(project)));
  }

  async delete(projectId: string): Promise<void> {
    await this.database.projects.delete(projectId);
  }
}
