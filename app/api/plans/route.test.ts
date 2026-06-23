import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/features/plans/service", () => ({
  generatePlan: vi.fn(),
}));

import { PlanError } from "@/src/features/plans/errors";
import { generatePlan } from "@/src/features/plans/service";
import { planRequestSchema } from "@/src/features/plans/schema";
import { POST } from "./route";

const mockedGeneratePlan = vi.mocked(generatePlan);
const originalApiKey = process.env.OPENROUTER_API_KEY;

const validRequest = {
  taskDescription: "Ship the Deadline AI MVP",
  deadline: "2026-07-01",
  hoursPerDay: 2,
  currentDate: "2026-07-01",
  timeZone: "America/Los_Angeles",
};

const generatedPlan: Awaited<ReturnType<typeof generatePlan>> = {
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
      steps: [
        {
          id: "step-123",
          title: "Implement plan generation",
          estimatedMinutes: 60,
          completed: false,
        },
      ],
    },
  ],
};

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/plans", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = "test-api-key";
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
      return;
    }

    process.env.OPENROUTER_API_KEY = originalApiKey;
  });

  it("returns a generated plan for valid requests", async () => {
    mockedGeneratePlan.mockResolvedValue(generatedPlan);
    const request = postRequest(validRequest);

    const response = await POST(request);

    await expect(response.json()).resolves.toEqual({ plan: generatedPlan });
    expect(response.status).toBe(200);
    expect(mockedGeneratePlan).toHaveBeenCalledWith(validRequest, {
      apiKey: "test-api-key",
      signal: request.signal,
    });
  });

  it("returns an invalid request error for invalid input", async () => {
    const parsed = planRequestSchema.safeParse({});
    expect(parsed.success).toBe(false);
    mockedGeneratePlan.mockRejectedValue(parsed.error);

    const response = await POST(postRequest({}));

    await expect(response.json()).resolves.toEqual({
      code: "INVALID_REQUEST",
      message: "Check the task details.",
    });
    expect(response.status).toBe(400);
  });

  it("returns a configuration error when the API key is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;

    const response = await POST(postRequest(validRequest));

    await expect(response.json()).resolves.toEqual({
      code: "MISSING_CONFIGURATION",
      message: "The planning service is not configured.",
    });
    expect(response.status).toBe(500);
    expect(mockedGeneratePlan).not.toHaveBeenCalled();
  });

  it("preserves safe plan errors", async () => {
    mockedGeneratePlan.mockRejectedValue(
      new PlanError(
        "INVALID_MODEL_OUTPUT",
        "The generated plan was invalid. Please try again.",
        502,
      ),
    );

    const response = await POST(postRequest(validRequest));

    await expect(response.json()).resolves.toEqual({
      code: "INVALID_MODEL_OUTPUT",
      message: "The generated plan was invalid. Please try again.",
    });
    expect(response.status).toBe(502);
  });

  it("returns a generic upstream error without leaking unexpected error messages", async () => {
    mockedGeneratePlan.mockRejectedValue(
      new Error("secret provider token: sk-test"),
    );

    const response = await POST(postRequest(validRequest));

    await expect(response.json()).resolves.toEqual({
      code: "UPSTREAM_ERROR",
      message: "Unable to generate a plan.",
    });
    expect(response.status).toBe(502);
  });
});
