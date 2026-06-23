import { storedTaskSchema, type StoredTask } from "./task";

const TASKS_STORAGE_KEY = "deadline-ai.tasks.v1";

export function loadTasks(storage: Storage): StoredTask[] {
  const storedValue = storage.getItem(TASKS_STORAGE_KEY);

  if (storedValue === null) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(storedValue);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((entry) => {
    const result = storedTaskSchema.safeParse(entry);

    return result.success ? [result.data] : [];
  });
}

export function saveTasks(storage: Storage, tasks: StoredTask[]): void {
  storage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

export function upsertTask(
  storage: Storage,
  task: StoredTask,
): StoredTask[] {
  const existingTasks = loadTasks(storage);
  const taskIndex = existingTasks.findIndex(
    (existingTask) => existingTask.id === task.id,
  );
  const nextTasks =
    taskIndex === -1
      ? [...existingTasks, task]
      : existingTasks.map((existingTask, index) =>
          index === taskIndex ? task : existingTask,
        );

  saveTasks(storage, nextTasks);

  return nextTasks;
}

export function removeTask(
  storage: Storage,
  taskId: string,
): StoredTask[] {
  const nextTasks = loadTasks(storage).filter((task) => task.id !== taskId);

  saveTasks(storage, nextTasks);

  return nextTasks;
}
