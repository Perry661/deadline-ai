import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Plan } from "../features/tasks/task";
import { TaskForm } from "./task-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

const today = "2026-06-23";
const tomorrow = "2026-06-24";

const generatedPlan = (title: string): Plan => ({
  title,
  summary: `Plan for ${title}.`,
  feasibility: "on_track",
  riskExplanation: "The work fits in the available time.",
  scopeRecommendation: "Keep the task focused.",
  totalEstimatedMinutes: 60,
  days: [
    {
      date: tomorrow,
      dailyFocus: "Make progress",
      totalMinutes: 60,
      steps: [
        {
          id: `${title.toLowerCase().replaceAll(" ", "-")}-step-1`,
          title: "Start the work",
          estimatedMinutes: 60,
          completed: false,
        },
      ],
    },
  ],
});

function deferredResponse(plan: Plan): {
  promise: Promise<Response>;
  resolve: () => void;
  reject: (error: unknown) => void;
} {
  let resolvePromise: (response: Response) => void;
  let rejectPromise: (error: unknown) => void;
  const promise = new Promise<Response>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: () => {
      resolvePromise(
        new Response(JSON.stringify({ plan }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    },
    reject: (error) => rejectPromise(error),
  };
}

async function fillValidForm(
  user: ReturnType<typeof userEvent.setup>,
  taskDescription = "Ship the Deadline AI MVP",
): Promise<void> {
  await user.clear(screen.getByLabelText(/task description/i));
  await user.type(screen.getByLabelText(/task description/i), taskDescription);
  await user.clear(screen.getByLabelText(/deadline/i));
  await user.type(screen.getByLabelText(/deadline/i), tomorrow);
  await user.clear(screen.getByLabelText(/hours per day/i));
  await user.type(screen.getByLabelText(/hours per day/i), "2");
}

describe("TaskForm", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(`${today}T12:00:00`));
    localStorage.clear();
    push.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows validation errors and does not request a plan for invalid input", async () => {
    const user = userEvent.setup();

    render(<TaskForm />);

    await user.click(screen.getByRole("button", { name: /generate plan/i }));

    expect(
      screen.getByText("Describe what you need to finish."),
    ).toBeVisible();
    expect(screen.getByLabelText(/task description/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();

    await user.type(
      screen.getByLabelText(/task description/i),
      "Ship the Deadline AI MVP",
    );
    await user.type(screen.getByLabelText(/deadline/i), "2026-06-22");
    await user.click(screen.getByRole("button", { name: /generate plan/i }));

    expect(screen.getByText("Choose today or a future date.")).toBeVisible();
    expect(globalThis.fetch).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/deadline/i));
    await user.type(screen.getByLabelText(/deadline/i), tomorrow);
    await user.type(screen.getByLabelText(/hours per day/i), "0");
    await user.click(screen.getByRole("button", { name: /generate plan/i }));

    expect(
      screen.getByText("Enter a value between 0 and 24 hours."),
    ).toBeVisible();
    expect(globalThis.fetch).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/hours per day/i));
    await user.type(screen.getByLabelText(/hours per day/i), "25");
    await user.click(screen.getByRole("button", { name: /generate plan/i }));

    expect(
      screen.getByText("Enter a value between 0 and 24 hours."),
    ).toBeVisible();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("lets users stop generation without clearing their input", async () => {
    const user = userEvent.setup();
    const response = deferredResponse(generatedPlan("Stopped Plan"));
    let capturedSignal: AbortSignal | null | undefined;

    vi.mocked(fetch).mockImplementation((_url, init) => {
      capturedSignal = init?.signal;
      return response.promise;
    });

    render(<TaskForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /generate plan/i }));

    expect(
      screen.getByRole("button", { name: /stop generation/i }),
    ).toBeVisible();
    expect(screen.getByLabelText(/task description/i)).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /stop generation/i }));
    response.reject(new DOMException("Aborted", "AbortError"));

    expect(capturedSignal?.aborted).toBe(true);
    expect(screen.getByLabelText(/task description/i)).toHaveValue(
      "Ship the Deadline AI MVP",
    );
    expect(screen.getByLabelText(/deadline/i)).toHaveValue(tomorrow);
    expect(screen.getByLabelText(/hours per day/i)).toHaveValue(2);
    expect(
      screen.getByRole("button", { name: /generate plan/i }),
    ).toBeVisible();
    await waitFor(() => {
      expect(push).not.toHaveBeenCalled();
    });
    expect(localStorage.getItem("deadline-ai.tasks.v1")).toBeNull();
  });

  it("aborts an active request when a newer submit supersedes it", async () => {
    const firstResponse = deferredResponse(generatedPlan("First Active Plan"));
    const secondResponse = deferredResponse(generatedPlan("Second Active Plan"));
    const capturedSignals: AbortSignal[] = [];

    vi.mocked(fetch)
      .mockImplementationOnce((_url, init) => {
        if (init?.signal) {
          capturedSignals.push(init.signal);
        }

        return firstResponse.promise;
      })
      .mockImplementationOnce((_url, init) => {
        if (init?.signal) {
          capturedSignals.push(init.signal);
        }

        return secondResponse.promise;
      });

    const { container } = render(<TaskForm />);
    const form = container.querySelector("form");

    if (!form) {
      throw new Error("Expected TaskForm to render a form");
    }

    fireEvent.change(screen.getByLabelText(/task description/i), {
      target: { value: "Active task" },
    });
    fireEvent.change(screen.getByLabelText(/deadline/i), {
      target: { value: tomorrow },
    });
    fireEvent.change(screen.getByLabelText(/hours per day/i), {
      target: { value: "2" },
    });
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(capturedSignals[0]?.aborted).toBe(true);

    secondResponse.resolve();

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/tasks\//));
    });

    firstResponse.resolve();

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("deadline-ai.tasks.v1") ?? "[]",
      ) as Array<{ taskDescription: string; plan: { title: string } }>;

      expect(storedTasks).toHaveLength(1);
      expect(storedTasks[0]).toMatchObject({
        taskDescription: "Active task",
        plan: { title: "Second Active Plan" },
      });
    });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("shows a safe error for malformed API responses", async () => {
    const user = userEvent.setup();

    vi.mocked(fetch).mockResolvedValue(
      new Response("not json", {
        status: 502,
        headers: { "Content-Type": "text/plain" },
      }),
    );

    render(<TaskForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /generate plan/i }));

    expect(
      await screen.findByText("Unable to generate a plan."),
    ).toBeVisible();
    expect(screen.queryByText(/json/i)).not.toBeInTheDocument();
  });

  it("ignores a canceled request that resolves after a newer successful request", async () => {
    const user = userEvent.setup();
    const firstResponse = deferredResponse(generatedPlan("First Plan"));
    const secondResponse = deferredResponse(generatedPlan("Second Plan"));
    const capturedSignals: AbortSignal[] = [];

    vi.mocked(fetch)
      .mockImplementationOnce((_url, init) => {
        if (init?.signal) {
          capturedSignals.push(init.signal);
        }

        return firstResponse.promise;
      })
      .mockImplementationOnce((_url, init) => {
        if (init?.signal) {
          capturedSignals.push(init.signal);
        }

        return secondResponse.promise;
      });

    render(<TaskForm />);

    await fillValidForm(user, "First task");
    await user.click(screen.getByRole("button", { name: /generate plan/i }));
    await user.click(screen.getByRole("button", { name: /stop generation/i }));

    await fillValidForm(user, "Second task");
    await user.click(screen.getByRole("button", { name: /generate plan/i }));

    secondResponse.resolve();

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/tasks\//));
    });

    firstResponse.resolve();

    await waitFor(() => {
      const storedTasks = JSON.parse(
        localStorage.getItem("deadline-ai.tasks.v1") ?? "[]",
      ) as Array<{ taskDescription: string; plan: { title: string } }>;

      expect(storedTasks).toHaveLength(1);
      expect(storedTasks[0]).toMatchObject({
        taskDescription: "Second task",
        plan: { title: "Second Plan" },
      });
    });
    expect(push).toHaveBeenCalledTimes(1);
    expect(capturedSignals[0]?.aborted).toBe(true);
  });
});
