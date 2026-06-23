import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { StoredTask } from "../features/tasks/task";
import { Dashboard } from "./dashboard";

const storedTask: StoredTask = {
  id: "task-1",
  taskDescription: "Ship the Deadline AI MVP",
  deadline: "2026-07-01",
  hoursPerDay: 2,
  createdAt: "2026-06-22T12:00:00.000Z",
  updatedAt: "2026-06-22T12:00:00.000Z",
  plan: {
    title: "Ship the MVP",
    summary: "Finish the core planning workflow.",
    feasibility: "at_risk",
    riskExplanation: "The work is tight for the available time.",
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

it("shows the empty dashboard state", () => {
  render(<Dashboard tasks={[]} onDeleteTask={() => undefined} />);

  expect(screen.getByText("Turn pressure into a plan.")).toBeVisible();
  expect(
    screen.getByRole("link", { name: /create your first plan/i }),
  ).toBeVisible();
});

it("shows stored tasks and lets users delete one", async () => {
  const user = userEvent.setup();
  const deleteTask = vi.fn();

  render(<Dashboard tasks={[storedTask]} onDeleteTask={deleteTask} />);

  expect(screen.getByText("Ship the MVP")).toBeVisible();
  expect(screen.getByText("Jul 1, 2026")).toBeVisible();
  expect(screen.getByText("50%")).toBeVisible();
  expect(screen.getByText("AT RISK")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Delete Ship the MVP" }));

  expect(deleteTask).toHaveBeenCalledWith("task-1");
});
