import { MapProjectSchema, type MapProject } from "../domain";

export function createProjectSnapshot(project: MapProject): MapProject {
  return MapProjectSchema.parse(structuredClone(project));
}

export function exportProjectToJson(project: MapProject, pretty = true): string {
  const snapshot = createProjectSnapshot(project);
  return JSON.stringify(snapshot, null, pretty ? 2 : undefined);
}

export function importProjectFromJson(json: string): MapProject {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    throw new Error("Project file is not valid JSON", { cause: error });
  }
  return MapProjectSchema.parse(value);
}

export const exportProject = exportProjectToJson;
export const importProject = importProjectFromJson;
