import { describe, expect, it } from "vitest";

import {
  generatedPlanSchema,
  planRequestSchema,
} from "./schema";
import { validatePlanAgainstRequest } from "./validation";

const request = {
  taskDescription: "Ship the Deadline AI MVP",
  deadline: "2026-07-03",
  hoursPerDay: 2,
  currentDate: "2026-07-01",
  timeZone: "America/Los_Angeles",
};

const validPlan = {
  title: "Ship the MVP",
  summary: "Implement and verify the core planning workflow.",
  feasibility: "on_track",
  riskExplanation: "The scope fits the available time.",
  scopeRecommendation: "Keep the first release focused on the core flow.",
  totalEstimatedMinutes: 180,
  days: [
    {
      date: "2026-07-01",
      dailyFocus: "Define the contract",
      totalMinutes: 120,
      steps: [
        { title: "Write schemas", estimatedMinutes: 60 },
        { title: "Add validation", estimatedMinutes: 60 },
      ],
    },
    {
      date: "2026-07-02",
      dailyFocus: "Verify the implementation",
      totalMinutes: 60,
      steps: [{ title: "Run quality checks", estimatedMinutes: 60 }],
    },
  ],
} as const;

describe("validatePlanAgainstRequest", () => {
  it("returns a valid parsed plan", () => {
    expect(validatePlanAgainstRequest(validPlan, request)).toEqual(validPlan);
  });

  it("rejects a day that exceeds the available capacity", () => {
    const plan = structuredClone(validPlan);
    plan.days[0].steps[0].estimatedMinutes = 61;
    plan.days[0].totalMinutes = 121;
    plan.totalEstimatedMinutes = 181;

    expect(() => validatePlanAgainstRequest(plan, request)).toThrow(
      "Daily plan exceeds available capacity",
    );
  });

  it("rejects a date after the deadline", () => {
    const plan = structuredClone(validPlan);
    plan.days[1].date = "2026-07-04";

    expect(() => validatePlanAgainstRequest(plan, request)).toThrow(
      "Plan contains a date after the deadline",
    );
  });

  it("rejects a date before the current date", () => {
    const plan = structuredClone(validPlan);
    plan.days[0].date = "2026-06-30";

    expect(() => validatePlanAgainstRequest(plan, request)).toThrow(
      "Plan contains a date before the current date",
    );
  });

  it("rejects a daily total that does not match its steps", () => {
    const plan = structuredClone(validPlan);
    plan.days[0].totalMinutes = 119;
    plan.totalEstimatedMinutes = 179;

    expect(() => validatePlanAgainstRequest(plan, request)).toThrow(
      "Daily total does not match step totals",
    );
  });

  it("rejects a plan total that does not match its days", () => {
    const plan = structuredClone(validPlan);
    plan.totalEstimatedMinutes = 179;

    expect(() => validatePlanAgainstRequest(plan, request)).toThrow(
      "Plan total does not match step totals",
    );
  });

  it("parses and trims request strings", () => {
    expect(
      planRequestSchema.parse({
        ...request,
        taskDescription: "  Ship the MVP  ",
        timeZone: "  America/Los_Angeles  ",
      }),
    ).toMatchObject({
      taskDescription: "Ship the MVP",
      timeZone: "America/Los_Angeles",
    });
  });

  it.each([
    ["a missing required field", { ...validPlan, summary: undefined }],
    ["an invalid feasibility", { ...validPlan, feasibility: "possible" }],
    [
      "a non-positive step duration",
      {
        ...validPlan,
        days: [
          {
            ...validPlan.days[0],
            steps: [
              { ...validPlan.days[0].steps[0], estimatedMinutes: 0 },
            ],
          },
        ],
      },
    ],
  ])("rejects %s at the schema boundary", (_label, input) => {
    expect(() => generatedPlanSchema.parse(input)).toThrow();
  });
});
