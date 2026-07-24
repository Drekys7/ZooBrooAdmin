import { z } from "zod";
import { EntityIdSchema, MapProjectSchema, type MapProject } from "../domain";

export const OperationTypeSchema = z.enum([
  "createItem",
  "updateItem",
  "moveItem",
  "duplicateItem",
  "deleteItem",
  "createCategory",
  "updateCategory",
  "deleteCategory",
  "setBackground",
  "publishProject",
  "importProject",
  "undo",
  "redo",
]);

export const AffectedEntityTypeSchema = z.enum(["project", "item", "category", "asset"]);

export const OperationRecordSchema = z.object({
  id: EntityIdSchema,
  type: OperationTypeSchema,
  occurredAt: z.string().datetime(),
  affectedEntityType: AffectedEntityTypeSchema,
  affectedEntityId: EntityIdSchema,
});

export type OperationType = z.infer<typeof OperationTypeSchema>;
export type AffectedEntityType = z.infer<typeof AffectedEntityTypeSchema>;
export type OperationRecord = z.infer<typeof OperationRecordSchema>;
export type OperationDescriptor = Omit<OperationRecord, "id" | "occurredAt"> & { id?: string; occurredAt?: string };

type HistoryEntry = { before: MapProject; after: MapProject; operation: OperationRecord };

export type HistoryChange = { project: MapProject; operation: OperationRecord };

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `operation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clone = (project: MapProject) => MapProjectSchema.parse(structuredClone(project));

export class CommandHistory {
  private readonly undoStack: HistoryEntry[] = [];
  private readonly redoStack: HistoryEntry[] = [];
  private readonly journal: OperationRecord[] = [];

  constructor(private readonly maxEntries = 100) {}

  record(beforeValue: MapProject, afterValue: MapProject, descriptor: OperationDescriptor): MapProject {
    const before = clone(beforeValue);
    const after = clone(afterValue);
    if (JSON.stringify(before) === JSON.stringify(after)) return after;
    const operation = OperationRecordSchema.parse({
      ...descriptor,
      id: descriptor.id ?? makeId(),
      occurredAt: descriptor.occurredAt ?? new Date().toISOString(),
    });
    this.undoStack.push({ before, after, operation });
    if (this.undoStack.length > this.maxEntries) this.undoStack.shift();
    this.redoStack.length = 0;
    this.pushJournal(operation);
    return after;
  }

  execute(
    project: MapProject,
    descriptor: OperationDescriptor,
    command: (current: MapProject) => MapProject,
  ): MapProject {
    return this.record(project, command(clone(project)), descriptor);
  }

  undo(currentValue: MapProject): HistoryChange | undefined {
    const entry = this.undoStack.pop();
    if (!entry) return undefined;
    this.redoStack.push(entry);
    const operation = this.historyOperation("undo", entry.operation, currentValue.id);
    this.pushJournal(operation);
    return { project: clone(entry.before), operation };
  }

  redo(currentValue: MapProject): HistoryChange | undefined {
    const entry = this.redoStack.pop();
    if (!entry) return undefined;
    this.undoStack.push(entry);
    const operation = this.historyOperation("redo", entry.operation, currentValue.id);
    this.pushJournal(operation);
    return { project: clone(entry.after), operation };
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getJournal(limit = this.maxEntries): readonly OperationRecord[] {
    return this.journal.slice(-Math.max(0, limit)).reverse();
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.journal.length = 0;
  }

  private historyOperation(type: "undo" | "redo", source: OperationRecord, projectId: string): OperationRecord {
    return OperationRecordSchema.parse({
      id: makeId(),
      type,
      occurredAt: new Date().toISOString(),
      affectedEntityType: source.affectedEntityType ?? "project",
      affectedEntityId: source.affectedEntityId ?? projectId,
    });
  }

  private pushJournal(operation: OperationRecord) {
    this.journal.push(operation);
    if (this.journal.length > this.maxEntries) this.journal.shift();
  }
}

export { CommandHistory as ProjectHistory };
