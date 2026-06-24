import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { StoredTask } from "../features/tasks/task";
import { Dashboard } from "./dashboard";
import { formatRemainingDays } from "./task-card";

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

const secondStoredTask: StoredTask = {
  ...storedTask,
  id: "task-2",
  taskDescription: "Record a hackathon demo video",
  deadline: "2026-07-02",
  plan: {
    ...storedTask.plan,
    title: "Record the demo video",
    feasibility: "on_track",
  },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("shows the empty dashboard state", () => {
  render(<Dashboard tasks={[]} onDeleteTask={() => undefined} />);

  expect(
    screen.getByRole("heading", {
      level: 1,
      name: "Turn pressure into a plan.",
    }),
  ).toBeVisible();
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
  expect(screen.getByRole("article")).toHaveClass("taskCard");
  expect(screen.getByRole("heading", { name: "Ship the MVP" })).toHaveClass(
    "taskCardTitle",
  );
  expect(screen.getByText(/deadline:/i).closest("p")).toHaveClass(
    "taskCardMeta",
  );
  expect(
    screen.getByRole("progressbar", { name: "Progress for Ship the MVP" })
      .parentElement,
  ).toHaveClass("taskCardProgress");

  await user.click(screen.getByRole("button", { name: "Delete Ship the MVP" }));

  expect(deleteTask).toHaveBeenCalledWith("task-1");
});

it("lets users select tasks and delete the selected set", async () => {
  const user = userEvent.setup();
  const deleteTask = vi.fn();

  render(
    <Dashboard
      tasks={[storedTask, secondStoredTask]}
      onDeleteTask={deleteTask}
    />,
  );

  await user.click(screen.getByLabelText("Select Ship the MVP"));
  await user.click(screen.getByLabelText("Select Record the demo video"));

  expect(screen.getByText("2 tasks selected")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Delete selected" }));

  expect(deleteTask).toHaveBeenCalledWith("task-1");
  expect(deleteTask).toHaveBeenCalledWith("task-2");
});

it("exports selected tasks as JSON and Markdown", async () => {
  const user = userEvent.setup();
  const deleteTask = vi.fn();
  const createObjectUrl = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:deadline-ai-export");
  const revokeObjectUrl = vi
    .spyOn(URL, "revokeObjectURL")
    .mockImplementation(() => undefined);
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => undefined);

  render(<Dashboard tasks={[storedTask]} onDeleteTask={deleteTask} />);

  await user.click(screen.getByLabelText("Select Ship the MVP"));
  await user.click(screen.getByRole("button", { name: "Export JSON" }));
  await user.click(screen.getByRole("button", { name: "Export Markdown" }));

  expect(createObjectUrl).toHaveBeenCalledTimes(2);
  expect(click).toHaveBeenCalledTimes(2);
  expect(revokeObjectUrl).toHaveBeenCalledWith("blob:deadline-ai-export");

  click.mockRestore();
  createObjectUrl.mockRestore();
  revokeObjectUrl.mockRestore();
});

it.each([
  ["2026-07-01", "2026-07-01", "Due today"],
  ["2026-07-02", "2026-07-01", "1 day remaining"],
  ["2026-07-04", "2026-07-01", "3 days remaining"],
  ["2026-06-30", "2026-07-01", "Past deadline"],
])(
  "formats remaining days for deadline %s from today %s",
  (deadline, today, expected) => {
    expect(formatRemainingDays(deadline, new Date(`${today}T12:00:00Z`))).toBe(
      expected,
    );
  },
);
