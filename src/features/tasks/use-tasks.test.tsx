import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlanRequest } from "../plans/schema";
import type { Plan, StoredTask } from "./task";
import { useTasks } from "./use-tasks";

const STORAGE_KEY = "deadline-ai.tasks.v1";

const plan: Plan = {
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
          completed: false,
        },
      ],
    },
  ],
};

const savedTask: StoredTask = {
  id: "task-1",
  taskDescription: "Ship the Deadline AI MVP",
  deadline: "2026-07-01",
  hoursPerDay: 2,
  createdAt: "2026-06-22T12:00:00.000Z",
  updatedAt: "2026-06-22T12:00:00.000Z",
  plan,
};

const taskInput: PlanRequest = {
  taskDescription: "Write hook tests",
  deadline: "2026-07-02",
  hoursPerDay: 1,
  currentDate: "2026-06-22",
  timeZone: "America/Los_Angeles",
};

const originalLocalStorage = window.localStorage;

function installThrowingStorage(): void {
  const throwingStorage: Storage = {
    get length() {
      return 0;
    },
    clear: vi.fn(),
    getItem: vi.fn(() => {
      throw new DOMException("Storage access denied", "SecurityError");
    }),
    key: vi.fn(() => null),
    removeItem: vi.fn(),
    setItem: vi.fn(() => {
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    }),
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: throwingStorage,
  });
}

describe("useTasks", () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("generated-id");
    window.localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("hydrates saved tasks from localStorage", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([savedTask]));

    const { result } = renderHook(() => useTasks());

    await waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(result.current.tasks).toEqual([savedTask]);
    expect(result.current.getTask("task-1")).toEqual(savedTask);
  });

  it("adds, updates, and deletes tasks while persisting the next task list", async () => {
    const { result } = renderHook(() => useTasks());

    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let createdTask: StoredTask | undefined;

    act(() => {
      createdTask = result.current.addTask(taskInput, plan);
    });

    expect(result.current.tasks).toEqual([createdTask]);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual([
      createdTask,
    ]);

    if (!createdTask) {
      throw new Error("Task was not created");
    }

    const renamedTask = {
      ...createdTask,
      taskDescription: "Write hook tests and storage guards",
    };

    let updatedTask: StoredTask | undefined;

    act(() => {
      updatedTask = result.current.updateTask(renamedTask);
    });

    expect(result.current.tasks).toEqual([updatedTask]);
    expect(updatedTask?.taskDescription).toBe(
      "Write hook tests and storage guards",
    );

    act(() => {
      result.current.deleteTask(updatedTask?.id ?? "");
    });

    expect(result.current.tasks).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual(
      [],
    );
  });

  it("keeps hook state usable when localStorage throws", async () => {
    installThrowingStorage();

    const { result } = renderHook(() => useTasks());

    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let createdTask: StoredTask | undefined;

    expect(() => {
      act(() => {
        createdTask = result.current.addTask(taskInput, plan);
      });
    }).not.toThrow();

    expect(result.current.tasks).toEqual([createdTask]);

    const renamedTask = {
      ...createdTask!,
      taskDescription: "Still works without persistence",
    };

    expect(() => {
      act(() => {
        result.current.updateTask(renamedTask);
      });
    }).not.toThrow();

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].taskDescription).toBe(
      "Still works without persistence",
    );

    expect(() => {
      act(() => {
        result.current.deleteTask(createdTask?.id ?? "");
      });
    }).not.toThrow();

    expect(result.current.tasks).toEqual([]);
  });
});
