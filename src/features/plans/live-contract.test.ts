import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generatePlan } from "./service";

const runLive = process.env.RUN_LIVE_OPENROUTER_TEST === "1";

describe.skipIf(!runLive)("OpenRouter live contract", () => {
  it("returns a capacity-safe plan", async () => {
    const plan = await generatePlan(
      {
        taskDescription: "Prepare a five-slide product pitch",
        currentDate: "2026-06-22",
        deadline: "2026-06-24",
        hoursPerDay: 1,
        timeZone: "America/Los_Angeles",
      },
      { apiKey: process.env.OPENROUTER_API_KEY! },
    );

    expect(plan.days.length).toBeGreaterThan(0);
    expect(plan.days.every((day) => day.totalMinutes <= 60)).toBe(true);
  }, 180_000);
});
