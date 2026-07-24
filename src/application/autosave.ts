import type { MapProject } from "../domain";
import type { ContentRepository } from "./repositories";

export type DebouncedProjectSaver = {
  schedule(project: MapProject): void;
  flush(): Promise<void>;
  cancel(): void;
};

export function createDebouncedProjectSaver(
  repository: ContentRepository,
  delayMs = 500,
): DebouncedProjectSaver {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: MapProject | undefined;

  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const project = pending;
    pending = undefined;
    if (project) await repository.save(project);
  };

  return {
    schedule(project) {
      pending = project;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delayMs);
    },
    flush,
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
    },
  };
}
