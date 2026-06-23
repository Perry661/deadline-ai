"use client";

import { useCallback, useEffect, useState } from "react";

import type { PlanRequest } from "../plans/schema";
import type { Plan, StoredTask } from "./task";
import { createStoredTask } from "./task";
import { loadTasks, removeTask, upsertTask } from "./storage";

type UseTasksValue = {
  tasks: StoredTask[];
  hydrated: boolean;
  addTask: (input: PlanRequest, plan: Plan) => StoredTask;
  updateTask: (task: StoredTask) => StoredTask;
  deleteTask: (taskId: string) => void;
  getTask: (taskId: string) => StoredTask | undefined;
};

export function useTasks(): UseTasksValue {
  const [tasks, setTasks] = useState<StoredTask[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    window.queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setTasks(loadTasks(window.localStorage));
      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const addTask = useCallback((input: PlanRequest, plan: Plan) => {
    const task = createStoredTask(input, plan);
    const nextTasks = upsertTask(window.localStorage, task);

    setTasks(nextTasks);

    return task;
  }, []);

  const updateTask = useCallback((task: StoredTask) => {
    const taskWithUpdatedTimestamp = {
      ...task,
      updatedAt: new Date().toISOString(),
    };
    const nextTasks = upsertTask(window.localStorage, taskWithUpdatedTimestamp);

    setTasks(nextTasks);

    return taskWithUpdatedTimestamp;
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(removeTask(window.localStorage, taskId));
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
    getTask,
  };
}
