import { describe, expect, it } from "vitest";
import {
  CommandHistory,
  buildPublishedSnapshot,
  createCategory,
  createEvent,
  createItem,
  deleteCategory,
  deleteEvent,
  deleteEvents,
  duplicateItem,
  exportProjectToJson,
  importProjectFromJson,
  moveItem,
  setBackground,
  setBackgroundColor,
  updateItem,
  updateMapSettings,
  updateEvent,
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

  it("creates, updates and deletes recurring zoo events", () => {
    const withItem = createItem(projectWithCategory(), {
      id: "penguins",
      categoryId: "animals",
      title: "Pinguine",
      position: { x: 0.3, y: 0.4 },
      now,
    });
    const created = createEvent(withItem, {
      id: "penguin-feeding",
      title: "Pinguinfütterung",
      description: "Treffpunkt an der Anlage",
      location: "Pinguinanlage",
      relatedItemId: "penguins",
      startDate: "2026-08-15",
      startTime: "11:00",
      endTime: "11:20",
      recurrence: { frequency: "weekly", interval: 1, weekdays: ["tuesday", "saturday"], monthDays: [], endsOn: null },
      visible: true,
      now,
    });

    expect(created.events[0]).toMatchObject({ id: "penguin-feeding", relatedItemId: "penguins" });
    const updated = updateEvent(created, { eventId: "penguin-feeding", patch: { startTime: "11:30", visible: false }, now });
    expect(updated.events[0]).toMatchObject({ startTime: "11:30", visible: false });
    expect(deleteEvent(updated, { eventId: "penguin-feeding", now }).events).toHaveLength(0);
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

  it("restores a bulk event deletion with one undo step", () => {
    const eventDefaults = {
      description: "",
      location: "",
      relatedItemId: null,
      startDate: "2026-07-12",
      startTime: "10:00",
      endTime: null,
      recurrence: { frequency: "once" as const, interval: 1, weekdays: [], monthDays: [], endsOn: null },
      visible: true,
      now,
    };
    let project = createEvent(projectWithCategory(), { ...eventDefaults, id: "past-1", title: "Gestern" });
    project = createEvent(project, { ...eventDefaults, id: "past-2", title: "Vorgestern", startDate: "2026-07-11" });
    const history = new CommandHistory();
    const deleted = history.execute(
      project,
      { type: "deletePastEvents", affectedEntityType: "event", affectedEntityId: "past-events" },
      (current) => deleteEvents(current, { eventIds: ["past-1", "past-2"], now }),
    );

    expect(deleted.events).toHaveLength(0);
    expect(history.undo(deleted)?.project.events.map((event) => event.id)).toEqual(["past-1", "past-2"]);
    expect(history.canUndo()).toBe(false);
  });

  it("groups continuous slider updates into one undo step", () => {
    const history = new CommandHistory();
    const original = createEmptyProject({ id: "slider-project", title: "Slider" });
    const descriptor = {
      type: "updateCategory" as const,
      affectedEntityType: "project" as const,
      affectedEntityId: original.id,
    };

    history.beginTransaction(original);
    const first = history.execute(original, descriptor, (project) => ({ ...project, backgroundColor: "#111111" }));
    const second = history.execute(first, descriptor, (project) => ({ ...project, backgroundColor: "#222222" }));
    const final = history.endTransaction(second);

    expect(history.getJournal()).toHaveLength(1);
    expect(history.undo(final)?.project.backgroundColor).toBe(original.backgroundColor);
    expect(history.canUndo()).toBe(false);
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

  it("stores map navigation settings and supplies defaults for legacy projects", () => {
    const project = projectWithCategory();
    const updated = updateMapSettings(project, {
      patch: {
        minZoomScale: 2,
        maxZoomScale: 15,
        navigationPaddingX: 0.2,
        navigationPaddingY: 0.6,
        mapOutlineEnabled: true,
        mapOutlineWidth: 7,
        mapOutlineColor: "#AABBCC",
      },
      now,
    });
    expect(updated.mapSettings).toEqual({
      minZoomScale: 2,
      maxZoomScale: 15,
      navigationPaddingX: 0.2,
      navigationPaddingY: 0.6,
      mapOutlineEnabled: true,
      mapOutlineWidth: 7,
      mapOutlineColor: "#AABBCC",
    });

    const legacy = JSON.parse(exportProjectToJson(project)) as Record<string, unknown>;
    delete legacy.mapSettings;
    expect(importProjectFromJson(JSON.stringify(legacy)).mapSettings).toEqual({
      minZoomScale: 0.5,
      maxZoomScale: 4,
      navigationPaddingX: 0.45,
      navigationPaddingY: 0.45,
      mapOutlineEnabled: false,
      mapOutlineWidth: 4,
      mapOutlineColor: "#FFFFFF",
    });

    const legacyWithZoomSettings = JSON.parse(exportProjectToJson(project)) as {
      mapSettings: Record<string, unknown>;
    };
    delete legacyWithZoomSettings.mapSettings.mapOutlineEnabled;
    delete legacyWithZoomSettings.mapSettings.mapOutlineWidth;
    delete legacyWithZoomSettings.mapSettings.mapOutlineColor;
    legacyWithZoomSettings.mapSettings.mapShadowEnabled = true;
    legacyWithZoomSettings.mapSettings.mapShadowBlur = 24;
    legacyWithZoomSettings.mapSettings.mapShadowOpacity = 45;
    legacyWithZoomSettings.mapSettings.mapShadowColor = "#112233";
    const importedLegacySettings = importProjectFromJson(JSON.stringify(legacyWithZoomSettings)).mapSettings;
    expect(importedLegacySettings).toMatchObject({
      mapOutlineEnabled: false,
      mapOutlineWidth: 4,
      mapOutlineColor: "#FFFFFF",
    });
    expect(importedLegacySettings).not.toHaveProperty("mapShadowEnabled");
  });

  it("creates a detached published snapshot", () => {
    const project = createEvent(
      setBackground(projectWithCategory(), { assetId: "map", width: 2000, height: 1000, now }),
      {
        id: "daily-talk",
        title: "Tierpfleger-Treff",
        description: "Fragen und Antworten",
        location: "Haupteingang",
        relatedItemId: null,
        startDate: "2026-08-15",
        startTime: "10:00",
        endTime: null,
        recurrence: { frequency: "daily", interval: 1, weekdays: [], monthDays: [], endsOn: null },
        visible: true,
        now,
      },
    );
    const snapshot = buildPublishedSnapshot(project, 3, now, (assetId) => `/assets/${assetId}`);
    expect(snapshot).toMatchObject({
      projectId: "project",
      version: 3,
      publishedAt: now,
      background: { assetId: "map", url: "/assets/map", width: 2000, height: 1000, color: "#DDDDDD" },
      mapSettings: {
        minZoomScale: 0.5,
        maxZoomScale: 4,
        navigationPaddingX: 0.45,
        navigationPaddingY: 0.45,
        mapOutlineEnabled: false,
      },
      events: [{ id: "daily-talk", recurrence: { frequency: "daily", interval: 1 } }],
    });
    project.categories[0]!.name = "Changed after publish";
    expect(snapshot.categories[0]!.name).toBe("Tiere");
  });

  it("publishes only visitor-visible events that still have an upcoming occurrence", () => {
    let project = setBackground(projectWithCategory(), { assetId: "map", width: 2000, height: 1000, now });
    const eventDefaults = {
      description: "",
      location: "",
      relatedItemId: null,
      startTime: "10:00",
      endTime: null,
      recurrence: { frequency: "once" as const, interval: 1, weekdays: [], monthDays: [], endsOn: null },
      now,
    };
    project = createEvent(project, { ...eventDefaults, id: "future", title: "Morgen", startDate: "2026-07-14", visible: true });
    project = createEvent(project, { ...eventDefaults, id: "past", title: "Gestern", startDate: "2026-07-12", visible: true });
    project = createEvent(project, { ...eventDefaults, id: "draft", title: "Entwurf", startDate: "2026-07-14", visible: false });

    const snapshot = buildPublishedSnapshot(project, 1, now);

    expect(snapshot.events.map((event) => event.id)).toEqual(["future"]);
  });

  it("refuses to publish a draft without a background", () => {
    expect(() => buildPublishedSnapshot(projectWithCategory(), 1, now)).toThrow("must have a background");
  });
});
