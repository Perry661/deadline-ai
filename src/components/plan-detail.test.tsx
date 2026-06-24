import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Plan, StoredTask } from "../features/tasks/task";
import { calculateProgress } from "../features/tasks/task";
import { PlanDetail } from "./plan-detail";

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
    feasibility: "at_risk",
    riskExplanation: "The work is tight for the available time.",
    scopeRecommendation: "Keep the release focused on planning.",
    totalEstimatedMinutes: 180,
    days: [
      {
        date: "2026-06-25",
        dailyFocus: "Polish detail interactions",
        totalMinutes: 60,
        steps: [
          {
            id: "step-3",
            title: "Verify regeneration fallback",
            estimatedMinutes: 60,
            completed: false,
          },
        ],
      },
      {
        date: "2026-06-24",
        dailyFocus: "Render plan detail",
        totalMinutes: 120,
        steps: [
          {
            id: "step-1",
            title: "Create the detail page",
            estimatedMinutes: 45,
            completed: false,
          },
          {
            id: "step-2",
            title: "Render daily plan groups",
            estimatedMinutes: 75,
            completed: true,
          },
        ],
      },
    ],
  },
};

function planWithTitle(title: string): Plan {
  return {
    ...task.plan,
    title,
    summary: `Updated plan for ${title}.`,
    days: [
      {
        date: "2026-06-26",
        dailyFocus: "Continue with the refreshed plan",
        totalMinutes: 90,
        steps: [
          {
            id: "new-step-1",
            title: "Start the regenerated plan",
            estimatedMinutes: 90,
            completed: false,
          },
        ],
      },
    ],
  };
}

function deferredPlan(plan: Plan): {
  promise: Promise<Plan>;
  resolve: () => void;
  reject: (error: unknown) => void;
} {
  let resolvePromise: (plan: Plan) => void;
  let rejectPromise: (error: unknown) => void;
  const promise = new Promise<Plan>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: () => resolvePromise(plan),
    reject: (error) => rejectPromise(error),
  };
}

describe("PlanDetail", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-06-23T12:00:00"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders the stored plan overview and daily groups in ascending date order", () => {
    render(
      <PlanDetail
        task={task}
        onUpdate={() => undefined}
        onDelete={() => undefined}
        onRegenerate={async () => planWithTitle("Regenerated Plan")}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Ship the MVP" }),
    ).toBeVisible();
    expect(screen.getByText("Finish the core planning workflow.")).toBeVisible();
    expect(screen.getByText("Deadline:")).toBeVisible();
    expect(screen.getByText("Jul 1, 2026")).toBeVisible();
    expect(screen.getByText("Capacity:")).toBeVisible();
    expect(screen.getByText("2 hours/day")).toBeVisible();
    expect(
      screen.getByRole("progressbar", { name: /progress for ship the mvp/i }),
    ).toHaveAccessibleName("Progress for Ship the MVP");
    expect(screen.getByText("33% complete")).toBeVisible();
    expect(screen.getByText("Feasibility: At risk")).toBeVisible();
    expect(
      screen.getByText("The work is tight for the available time."),
    ).toBeVisible();
    expect(
      screen.getByText("Keep the release focused on planning."),
    ).toBeVisible();

    const dayGroups = screen.getAllByRole("group");
    expect(dayGroups).toHaveLength(2);
    expect(within(dayGroups[0]).getByText("Jun 24, 2026")).toBeVisible();
    expect(within(dayGroups[1]).getByText("Jun 25, 2026")).toBeVisible();
  });

  it("moves fully completed daily groups below incomplete daily groups", () => {
    const taskWithCompletedFirstDay: StoredTask = {
      ...task,
      plan: {
        ...task.plan,
        days: task.plan.days.map((day) =>
          day.date === "2026-06-24"
            ? {
                ...day,
                steps: day.steps.map((step) => ({
                  ...step,
                  completed: true,
                })),
              }
            : day,
        ),
      },
    };

    render(
      <PlanDetail
        task={taskWithCompletedFirstDay}
        onUpdate={() => undefined}
        onDelete={() => undefined}
        onRegenerate={async () => planWithTitle("Regenerated Plan")}
      />,
    );

    const dayGroups = screen.getAllByRole("group");
    expect(within(dayGroups[0]).getByText("Jun 25, 2026")).toBeVisible();
    expect(within(dayGroups[1]).getByText("Jun 24, 2026")).toBeVisible();
  });

  it("calls onUpdate with a completed step and recalculated progress when a step is checked", async () => {
    const user = userEvent.setup();
    const updateTask = vi.fn();

    render(
      <PlanDetail
        task={task}
        onUpdate={updateTask}
        onDelete={() => undefined}
        onRegenerate={async () => planWithTitle("Regenerated Plan")}
      />,
    );

    await user.click(screen.getByLabelText("Create the detail page, 45 minutes"));

    expect(updateTask).toHaveBeenCalledTimes(1);
    const updatedTask = updateTask.mock.calls[0][0] as StoredTask;
    expect(updatedTask).not.toBe(task);
    expect(
      updatedTask.plan.days
        .flatMap((day) => day.steps)
        .find((step) => step.id === "step-1"),
    ).toMatchObject({ completed: true });
    expect(calculateProgress(updatedTask)).toBe(67);
  });

  it("deletes the task after confirming the browser prompt", async () => {
    const user = userEvent.setup();
    const deleteTask = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <PlanDetail
        task={task}
        onUpdate={() => undefined}
        onDelete={deleteTask}
        onRegenerate={async () => planWithTitle("Regenerated Plan")}
      />,
    );

    await user.click(screen.getByRole("button", { name: /delete plan/i }));

    expect(confirm).toHaveBeenCalledWith(
      "Are you sure you want to delete this plan?",
    );
    expect(deleteTask).toHaveBeenCalledWith("task-1");
  });

  it("keeps the task when the browser delete prompt is canceled", async () => {
    const user = userEvent.setup();
    const deleteTask = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <PlanDetail
        task={task}
        onUpdate={() => undefined}
        onDelete={deleteTask}
        onRegenerate={async () => planWithTitle("Regenerated Plan")}
      />,
    );

    await user.click(screen.getByRole("button", { name: /delete plan/i }));

    expect(deleteTask).not.toHaveBeenCalled();
  });

  it("regenerates with the original task inputs and only updates after a successful plan", async () => {
    const user = userEvent.setup();
    const updateTask = vi.fn();
    const regenerate = vi.fn(async () => planWithTitle("Regenerated Plan"));

    render(
      <PlanDetail
        task={task}
        onUpdate={updateTask}
        onDelete={() => undefined}
        onRegenerate={regenerate}
      />,
    );

    await user.click(screen.getByRole("button", { name: /regenerate plan/i }));

    expect(regenerate).toHaveBeenCalledWith({
      input: {
        taskDescription: "Ship the Deadline AI MVP",
        deadline: "2026-07-01",
        hoursPerDay: 2,
        currentDate: "2026-06-23",
        timeZone: expect.any(String),
      },
      signal: expect.any(AbortSignal),
    });
    await waitFor(() => {
      expect(updateTask).toHaveBeenCalledTimes(1);
    });
    expect(updateTask.mock.calls[0][0]).toMatchObject({
      id: "task-1",
      taskDescription: "Ship the Deadline AI MVP",
      deadline: "2026-07-01",
      hoursPerDay: 2,
      plan: {
        title: "Regenerated Plan",
      },
    });
  });

  it("preserves the current plan when regeneration fails", async () => {
    const user = userEvent.setup();
    const updateTask = vi.fn();
    const regenerate = vi.fn(async () => {
      throw new Error("No plan available");
    });

    render(
      <PlanDetail
        task={task}
        onUpdate={updateTask}
        onDelete={() => undefined}
        onRegenerate={regenerate}
      />,
    );

    await user.click(screen.getByRole("button", { name: /regenerate plan/i }));

    expect(
      await screen.findByText("Unable to regenerate the plan."),
    ).toBeVisible();
    expect(updateTask).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { level: 1, name: "Ship the MVP" }),
    ).toBeVisible();
  });

  it("lets users stop regeneration and ignores the stopped result", async () => {
    const user = userEvent.setup();
    const updateTask = vi.fn();
    const pendingPlan = deferredPlan(planWithTitle("Stopped Plan"));
    let capturedSignal: AbortSignal | undefined;
    const regenerate = vi.fn(({ signal }: { signal: AbortSignal }) => {
      capturedSignal = signal;
      return pendingPlan.promise;
    });

    render(
      <PlanDetail
        task={task}
        onUpdate={updateTask}
        onDelete={() => undefined}
        onRegenerate={regenerate}
      />,
    );

    await user.click(screen.getByRole("button", { name: /regenerate plan/i }));
    expect(
      screen.getByRole("button", { name: /stop regeneration/i }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: /stop regeneration/i }));

    expect(capturedSignal?.aborted).toBe(true);
    pendingPlan.resolve();
    await Promise.resolve();
    expect(updateTask).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { level: 1, name: "Ship the MVP" }),
    ).toBeVisible();
  });

  it("aborts regeneration when a confirmed delete happens", async () => {
    const user = userEvent.setup();
    const updateTask = vi.fn();
    const deleteTask = vi.fn();
    const pendingPlan = deferredPlan(planWithTitle("Deleted Plan"));
    let capturedSignal: AbortSignal | undefined;
    const regenerate = vi.fn(({ signal }: { signal: AbortSignal }) => {
      capturedSignal = signal;
      return pendingPlan.promise;
    });

    render(
      <PlanDetail
        task={task}
        onUpdate={updateTask}
        onDelete={deleteTask}
        onRegenerate={regenerate}
      />,
    );

    await user.click(screen.getByRole("button", { name: /regenerate plan/i }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: /delete plan/i }));

    expect(capturedSignal?.aborted).toBe(true);
    expect(deleteTask).toHaveBeenCalledWith("task-1");
    pendingPlan.resolve();
    await Promise.resolve();
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("shows a safe error for malformed API regeneration responses", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("not json", {
          status: 502,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    render(
      <PlanDetail
        task={task}
        onUpdate={() => undefined}
        onDelete={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: /regenerate plan/i }));

    expect(
      await screen.findByText("Unable to regenerate the plan."),
    ).toBeVisible();
    expect(screen.queryByText(/json/i)).not.toBeInTheDocument();
  });

  it("renders a dashboard recovery link when the task is missing", () => {
    render(
      <PlanDetail
        task={undefined}
        onUpdate={() => undefined}
        onDelete={() => undefined}
        onRegenerate={async () => planWithTitle("Regenerated Plan")}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Plan not found" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /return to dashboard/i }),
    ).toHaveAttribute("href", "/");
  });
});
