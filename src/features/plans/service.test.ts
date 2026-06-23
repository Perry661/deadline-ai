import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PlanError } from "./errors";
import { generatePlan, type CompletionFn } from "./service";

const validRequest = {
  taskDescription: "Ship the Deadline AI MVP",
  deadline: "2026-07-01",
  hoursPerDay: 2,
  currentDate: "2026-07-01",
  timeZone: "America/Los_Angeles",
};

const validGeneratedPlan = {
  title: "Ship the MVP",
  summary: "Finish the core planning workflow.",
  feasibility: "on_track",
  riskExplanation: "The work fits in the available time.",
  scopeRecommendation: "Keep the release focused on planning.",
  totalEstimatedMinutes: 60,
  days: [
    {
      date: "2026-07-01",
      dailyFocus: "Finish the API",
      totalMinutes: 60,
      steps: [{ title: "Implement plan generation", estimatedMinutes: 60 }],
    },
  ],
};

describe("generatePlan", () => {
  it("requests a completion and adds application-owned step state", async () => {
    const complete = vi
      .fn<CompletionFn>()
      .mockResolvedValue(JSON.stringify(validGeneratedPlan));

    const result = await generatePlan(validRequest, {
      apiKey: "test-api-key",
      complete,
    });

    expect(complete).toHaveBeenCalledOnce();
    expect(result.days[0].steps[0].id).toMatch(/^step-/);
    expect(result.days[0].steps[0].completed).toBe(false);
  });

  it("maps malformed completion JSON to an invalid model output error", async () => {
    const complete = vi.fn<CompletionFn>().mockResolvedValue("{not json");

    await expect(
      generatePlan(validRequest, { apiKey: "test-api-key", complete }),
    ).rejects.toMatchObject({
      code: "INVALID_MODEL_OUTPUT",
    });
  });

  it("maps generated plans that violate capacity to an invalid model output error", async () => {
    const overCapacityPlan = {
      ...validGeneratedPlan,
      totalEstimatedMinutes: 121,
      days: [
        {
          ...validGeneratedPlan.days[0],
          totalMinutes: 121,
          steps: [
            { title: "Attempt too much work", estimatedMinutes: 121 },
          ],
        },
      ],
    };
    const complete = vi
      .fn<CompletionFn>()
      .mockResolvedValue(JSON.stringify(overCapacityPlan));

    await expect(
      generatePlan(
        { ...validRequest, hoursPerDay: 2 },
        { apiKey: "test-api-key", complete },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_MODEL_OUTPUT",
    });
  });

  it("rethrows existing plan errors without changing their safe details", async () => {
    const expectedError = new PlanError(
      "UPSTREAM_ERROR",
      "Planning service is temporarily unavailable.",
      502,
    );
    const complete = vi.fn<CompletionFn>().mockRejectedValue(expectedError);

    await expect(
      generatePlan(validRequest, { apiKey: "test-api-key", complete }),
    ).rejects.toBe(expectedError);
  });
});
