"use client";

import { useCallback, useEffect, useState } from "react";

import type { PlanRequest } from "../plans/schema";
import type { Plan, StoredTask } from "./task";
import { createStoredTask } from "./task";
import { loadTasks, saveTasks } from "./storage";

type UseTasksValue = {
  tasks: StoredTask[];
  hydrated: boolean;
  addTask: (input: PlanRequest, plan: Plan) => StoredTask;
  updateTask: (task: StoredTask) => StoredTask;
  deleteTask: (taskId: string) => void;
  importTasks: (tasks: StoredTask[]) => void;
  getTask: (taskId: string) => StoredTask | undefined;
};

function getBrowserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function upsertTaskInList(
  existingTasks: StoredTask[],
  task: StoredTask,
): StoredTask[] {
  const taskIndex = existingTasks.findIndex(
    (existingTask) => existingTask.id === task.id,
  );

  return taskIndex === -1
    ? [...existingTasks, task]
    : existingTasks.map((existingTask, index) =>
        index === taskIndex ? task : existingTask,
      );
}

function persistTasks(tasks: StoredTask[]): void {
  const storage = getBrowserStorage();

  if (storage) {
    saveTasks(storage, tasks);
  }
}

export function useTasks(): UseTasksValue {
  const [tasks, setTasks] = useState<StoredTask[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    window.queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const storage = getBrowserStorage();

      setTasks(storage ? loadTasks(storage) : []);
      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const addTask = useCallback((input: PlanRequest, plan: Plan) => {
    const task = createStoredTask(input, plan);

    setTasks((existingTasks) => {
      const nextTasks = upsertTaskInList(existingTasks, task);

      persistTasks(nextTasks);

      return nextTasks;
    });

    return task;
  }, []);

  const updateTask = useCallback((task: StoredTask) => {
    const taskWithUpdatedTimestamp = {
      ...task,
      updatedAt: new Date().toISOString(),
    };

    setTasks((existingTasks) => {
      const nextTasks = upsertTaskInList(
        existingTasks,
        taskWithUpdatedTimestamp,
      );

      persistTasks(nextTasks);

      return nextTasks;
    });

    return taskWithUpdatedTimestamp;
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks((existingTasks) => {
      const nextTasks = existingTasks.filter((task) => task.id !== taskId);

      persistTasks(nextTasks);

      return nextTasks;
    });
  }, []);

  const importTasks = useCallback((importedTasks: StoredTask[]) => {
    if (importedTasks.length === 0) {
      return;
    }

    setTasks((existingTasks) => {
      const nextTasks = [...existingTasks, ...importedTasks];

      persistTasks(nextTasks);

      return nextTasks;
    });
  }, []);

  const getTask = useCallback(
    (taskId: string) => tasks.find((task) => task.id === taskId),
    [tasks],
  );

  return {
    tasks,
    hydrated,
    addTask,
    updateTask,
    deleteTask,
    importTasks,
    getTask,
  };
}
