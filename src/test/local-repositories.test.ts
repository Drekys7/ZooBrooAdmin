import { afterEach, describe, expect, it } from "vitest";
import { publishProject, setBackground } from "../application";
import { createEmptyProject, MapItemSchema } from "../domain";
import { createLocalApplication } from "../infrastructure";

const containers: ReturnType<typeof createLocalApplication>[] = [];
const makeContainer = () => {
  const container = createLocalApplication(`test-${crypto.randomUUID()}`);
  containers.push(container);
  return container;
};

afterEach(() => {
  for (const container of containers.splice(0)) container.close();
});

describe("local repositories", () => {
  it("publishes with an editor fact-icon library and preserves used fact icons", async () => {
    const container = makeContainer();
    const project = setBackground(createEmptyProject(), { assetId: "map", width: 1000, height: 600 });
    project.mapSettings.factIcons = [{ id: "fact-icon", label: "Schutzstatus" }];
    project.categories = [{ id: "animals", name: "Tiere", type: "animal", color: "#315F4B", defaultIconAssetId: null, visible: true, sortOrder: 0 }];
    project.items = [MapItemSchema.parse({
      id: "animal", categoryId: "animals", type: "animal", title: "Löwe",
      subtitle: "", description: "", visible: true,
      position: { x: 0.5, y: 0.5 }, createdAt: project.createdAt, updatedAt: project.updatedAt,
      facts: [{ id: "status", label: "Status", value: "Gefährdet", iconAssetId: "fact-icon" }],
    })];
    const snapshot = await publishProject(project, {}, container.publishRepository);
    const saved = await container.publishRepository.getLatest(project.id);
    expect(saved).toEqual(snapshot);
    expect(saved?.mapSettings).not.toHaveProperty("factIcons");
    expect(saved?.items[0].facts[0].icon).toEqual({ assetId: "fact-icon", url: "asset://fact-icon" });
    expect(project.mapSettings.factIcons).toEqual([{ id: "fact-icon", label: "Schutzstatus" }]);
  });
  it("persists projects and blobs through repository interfaces", async () => {
    const container = makeContainer();
    const project = setBackground(
      createEmptyProject({ id: "zoo", now: "2026-07-13T00:00:00.000Z" }),
      { assetId: "map", width: 2000, height: 1000, now: "2026-07-13T00:00:00.000Z" },
    );
    await container.contentRepository.save(project);
    expect(await container.contentRepository.get("zoo")).toEqual(project);

    const blob = new Blob(["svg"], { type: "image/svg+xml" });
    const asset = await container.assetRepository.put({ id: "icon", name: "icon.svg", kind: "icon", blob });
    expect(asset.size).toBe(3);
    expect((await container.assetRepository.get("icon"))?.blob.size).toBe(3);
  });

  it("keeps published versions immutable and selects the latest", async () => {
    const container = makeContainer();
    const project = setBackground(
      createEmptyProject({ id: "zoo", now: "2026-07-13T00:00:00.000Z" }),
      { assetId: "map", width: 2000, height: 1000, now: "2026-07-13T00:00:00.000Z" },
    );
    const first = await publishProject(project, { publishedAt: "2026-07-13T01:00:00.000Z" }, container.publishRepository);
    const second = await publishProject(project, { publishedAt: "2026-07-13T02:00:00.000Z" }, container.publishRepository);
    expect([first.version, second.version]).toEqual([1, 2]);
    expect((await container.publishRepository.getLatest("zoo"))?.version).toBe(2);
    await expect(container.publishRepository.publish(second)).rejects.toThrow("already exists");
  });
});
