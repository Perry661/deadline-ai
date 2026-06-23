import { describe, expect, it } from "vitest";

import {
  calculateProgress,
  toggleStep,
  type StoredTask,
} from "./task";

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

describe("task domain", () => {
  it("calculates rounded completion progress from plan steps", () => {
    expect(calculateProgress(task)).toBe(50);
  });

  it("reports 0 progress for an empty plan", () => {
    expect(
      calculateProgress({
        ...task,
        plan: {
          ...task.plan,
          days: [],
        },
      }),
    ).toBe(0);
  });

  it("toggles a matching step without mutating the original task", () => {
    const updated = toggleStep(task, "step-1");

    expect(updated.plan.days[0].steps[0].completed).toBe(true);
    expect(task.plan.days[0].steps[0].completed).toBe(false);
    expect(updated).not.toBe(task);
    expect(updated.plan.days[0]).not.toBe(task.plan.days[0]);
  });
});
