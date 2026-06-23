import { describe, expect, it } from "vitest";

import type { StoredTask } from "./task";
import { loadTasks, removeTask, saveTasks, upsertTask } from "./storage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const task: StoredTask = {
  id: "task-1",
  taskDescription: "Ship the Deadline AI MVP",
  deadline: "2026-07-01",
  hoursPerDay: 2,
  createdAt: "2026-06-22T12:00:00.000Z",
  updatedAt: "2026-06-22T12:00:00.000Z",
  plan: {
    title: "Ship the MVP",
    summary: "Finish the core planning workflow.",
    feasibility: "on_track",
    riskExplanation: "The work fits in the available time.",
    scopeRecommendation: "Keep the release focused on planning.",
    totalEstimatedMinutes: 90,
    days: [
      {
        date: "2026-06-22",
        dailyFocus: "Persist task progress",
        totalMinutes: 90,
        steps: [
          {
            id: "step-1",
            title: "Create task storage",
            estimatedMinutes: 45,
            completed: false,
          },
          {
            id: "step-2",
            title: "Render progress",
            estimatedMinutes: 45,
            completed: true,
          },
        ],
      },
    ],
  },
};

describe("task storage", () => {
  it("round-trips valid tasks", () => {
    const storage = new MemoryStorage();

    saveTasks(storage, [task]);

    expect(loadTasks(storage)).toEqual([task]);
  });

  it("returns an empty list for malformed JSON", () => {
    const storage = new MemoryStorage();
    storage.setItem("deadline-ai.tasks.v1", "{not json");

    expect(loadTasks(storage)).toEqual([]);
  });

  it("returns an empty list when stored tasks cannot be read", () => {
    const storage = new MemoryStorage();
    storage.getItem = () => {
      throw new DOMException("Storage access denied", "SecurityError");
    };

    expect(loadTasks(storage)).toEqual([]);
  });

  it("preserves valid tasks when another stored entry is invalid", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "deadline-ai.tasks.v1",
      JSON.stringify([task, { ...task, id: 123 }]),
    );

    expect(loadTasks(storage)).toEqual([task]);
  });

  it("deletes one task while preserving other tasks", () => {
    const storage = new MemoryStorage();
    const otherTask = { ...task, id: "task-2" };
    saveTasks(storage, [task, otherTask]);

    expect(removeTask(storage, "task-1")).toEqual([otherTask]);
    expect(loadTasks(storage)).toEqual([otherTask]);
  });

  it("returns the next task list when persistence fails", () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    };

    expect(saveTasks(storage, [task])).toBeUndefined();
    expect(upsertTask(storage, task)).toEqual([task]);
    expect(removeTask(storage, "task-1")).toEqual([]);
  });
});
