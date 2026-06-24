import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { DayPlan } from "./day-plan";

afterEach(() => {
  cleanup();
});

it("marks completed steps with a completed visual class", () => {
  render(
    <DayPlan
      day={{
        date: "2026-06-23",
        dailyFocus: "Polish checked task styling",
        totalMinutes: 60,
        steps: [
          {
            id: "step-complete",
            title: "Finished step",
            estimatedMinutes: 20,
            completed: true,
          },
          {
            id: "step-open",
            title: "Open step",
            estimatedMinutes: 40,
            completed: false,
          },
        ],
      }}
      onToggleStep={vi.fn()}
    />,
  );

  expect(screen.getByText("Finished step, 20 minutes")).toHaveClass(
    "stepItemTextCompleted",
  );
  expect(screen.getByText("Open step, 40 minutes")).not.toHaveClass(
    "stepItemTextCompleted",
  );
});
