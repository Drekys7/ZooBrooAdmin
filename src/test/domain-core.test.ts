import { describe, expect, it } from "vitest";
import {
  CommandHistory,
  buildPublishedSnapshot,
  createCategory,
  createItem,
  deleteCategory,
  duplicateItem,
  exportProjectToJson,
  importProjectFromJson,
  moveItem,
  setBackground,
  setBackgroundColor,
  updateItem,
} from "../application";
import { createEmptyProject, denormalizePosition, normalizePosition } from "../domain";

const now = "2026-07-13T00:00:00.000Z";

function projectWithCategory() {
  return createCategory(createEmptyProject({ id: "project", now }), {
    id: "animals",
    name: "Tiere",
    type: "animal",
    color: "#2a815d",
    defaultIconAssetId: null,
    visible: true,
    now,
  });
}

describe("normalized coordinates", () => {
  it("converts pixels independently of the map resolution and clamps overflow", () => {
    expect(normalizePosition({ x: 500, y: 250 }, { width: 1000, height: 500 })).toEqual({ x: 0.5, y: 0.5 });
    expect(normalizePosition({ x: 1200, y: -10 }, { width: 1000, height: 500 })).toEqual({ x: 1, y: 0 });
    expect(denormalizePosition({ x: 0.5, y: 0.5 }, { width: 2000, height: 1000 })).toEqual({ x: 1000, y: 500 });
  });
});

describe("project commands", () => {
  it("creates, updates, moves, duplicates and deletes entities without mutating the source", () => {
    const initial = projectWithCategory();
    const created = createItem(initial, {
      id: "lion",
      categoryId: "animals",
      title: "Löwe",
      position: { x: 0.2, y: 0.3 },
      now,
    });
    expect(initial.items).toHaveLength(0);
    expect(created.items[0]?.colorOverride).toBeNull();
    const updated = updateItem(created, { itemId: "lion", patch: { subtitle: "Afrikanischer Löwe", colorOverride: "#A1B2C3" }, now });
    expect(updated.items[0]?.colorOverride).toBe("#A1B2C3");
    const moved = moveItem(updated, { itemId: "lion", position: { x: 2, y: -1 }, now });
    const duplicated = duplicateItem(moved, { itemId: "lion", id: "lion-copy", now });
    expect(duplicated.items).toHaveLength(2);
    expect(duplicated.items[0]?.position).toEqual({ x: 1, y: 0 });
    expect(duplicated.items[1]?.title).toContain("Kopie");
    expect(deleteCategory(duplicated, { categoryId: "animals", deleteItems: true, now }).items).toHaveLength(0);
  });
});

describe("history and serialization", () => {
  it("undoes and redoes a recorded command", () => {
    const initial = projectWithCategory();
    const history = new CommandHistory();
    const changed = history.execute(
      initial,
      { type: "createItem", affectedEntityType: "item", affectedEntityId: "lion", occurredAt: now },
      (project) => createItem(project, { id: "lion", categoryId: "animals", title: "Löwe", position: { x: 0.5, y: 0.5 }, now }),
    );
    expect(changed.items).toHaveLength(1);
    const undone = history.undo(changed);
    expect(undone?.project.items).toHaveLength(0);
    expect(history.redo(undone!.project)?.project.items).toHaveLength(1);
    expect(history.getJournal()).toHaveLength(3);
  });

  it("round-trips valid JSON and rejects an invalid project", () => {
    const project = projectWithCategory();
    expect(importProjectFromJson(exportProjectToJson(project))).toEqual(project);
    expect(() => importProjectFromJson('{"id":"broken"}')).toThrow();
    expect(() => importProjectFromJson("not-json")).toThrow("not valid JSON");
  });

  it("stores a validated map background color and supplies gray for legacy projects", () => {
    const project = projectWithCategory();
    const updated = setBackgroundColor(project, { color: "#a1b2c3", now });
    expect(updated.backgroundColor).toBe("#A1B2C3");

    const legacy = JSON.parse(exportProjectToJson(project)) as Record<string, unknown>;
    delete legacy.backgroundColor;
    expect(importProjectFromJson(JSON.stringify(legacy)).backgroundColor).toBe("#DDDDDD");
  });

  it("creates a detached published snapshot", () => {
    const project = setBackground(projectWithCategory(), { assetId: "map", width: 2000, height: 1000, now });
    const snapshot = buildPublishedSnapshot(project, 3, now, (assetId) => `/assets/${assetId}`);
    expect(snapshot).toMatchObject({
      projectId: "project",
      version: 3,
      publishedAt: now,
      background: { assetId: "map", url: "/assets/map", width: 2000, height: 1000, color: "#DDDDDD" },
    });
    project.categories[0]!.name = "Changed after publish";
    expect(snapshot.categories[0]!.name).toBe("Tiere");
  });

  it("refuses to publish a draft without a background", () => {
    expect(() => buildPublishedSnapshot(projectWithCategory(), 1, now)).toThrow("must have a background");
  });
});
