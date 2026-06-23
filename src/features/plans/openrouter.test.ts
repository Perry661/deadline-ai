import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import { PlanError } from "./errors";
import {
  PLAN_RESPONSE_JSON_SCHEMA,
  requestPlanCompletion,
} from "./openrouter";
import { type PlanningMessage } from "./prompt";

const messages: PlanningMessage[] = [
  { role: "system", content: "System instructions" },
  { role: "user", content: "Task details" },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function expectSafeError(
  error: unknown,
  expected: {
    code: "UPSTREAM_ERROR" | "INVALID_MODEL_OUTPUT";
    message: string;
  },
): void {
  expect(error).toBeInstanceOf(PlanError);
  expect(error).toMatchObject({
    name: "PlanError",
    code: expected.code,
    status: 502,
    message: expected.message,
  });

  const serialized = `${String(error)} ${JSON.stringify(error)}`;
  expect(serialized).not.toContain("secret-key");
  expect(serialized).not.toContain("sensitive upstream body");
  expect(serialized).not.toContain("reasoning_details");
}

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectKeys);
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...collectKeys(nestedValue),
  ]);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestPlanCompletion", () => {
  it("sends the complete OpenRouter request and returns message content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: '{"title":"Plan"}' } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestPlanCompletion({ apiKey: "secret-key", messages }),
    ).resolves.toBe('{"title":"Plan"}');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      Authorization: "Bearer secret-key",
      "Content-Type": "application/json",
      "X-OpenRouter-Title": "Deadline AI",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      model: "deepseek/deepseek-v4-pro",
      messages,
      max_tokens: 2000,
      reasoning: { enabled: true },
      provider: { require_parameters: true },
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "generated_plan",
          strict: true,
          schema: PLAN_RESPONSE_JSON_SCHEMA,
        },
      },
    });
  });

  it("uses a stable provider-friendly response schema", () => {
    expect(PLAN_RESPONSE_JSON_SCHEMA).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: [
        "title",
        "summary",
        "feasibility",
        "riskExplanation",
        "scopeRecommendation",
        "totalEstimatedMinutes",
        "days",
      ],
      properties: {
        title: { type: "string", minLength: 1, maxLength: 120 },
        summary: { type: "string", minLength: 1, maxLength: 600 },
        feasibility: {
          type: "string",
          enum: ["on_track", "at_risk", "unrealistic"],
        },
        riskExplanation: {
          type: "string",
          minLength: 1,
          maxLength: 600,
        },
        scopeRecommendation: {
          type: "string",
          minLength: 1,
          maxLength: 600,
        },
        totalEstimatedMinutes: {
          type: "integer",
          minimum: 1,
        },
        days: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "date",
              "dailyFocus",
              "totalMinutes",
              "steps",
            ],
            properties: {
              date: {
                type: "string",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              },
              dailyFocus: {
                type: "string",
                minLength: 1,
                maxLength: 240,
              },
              totalMinutes: {
                type: "integer",
                minimum: 1,
              },
              steps: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "estimatedMinutes"],
                  properties: {
                    title: {
                      type: "string",
                      minLength: 1,
                      maxLength: 240,
                    },
                    estimatedMinutes: {
                      type: "integer",
                      minimum: 1,
                      maximum: 720,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const keys = collectKeys(PLAN_RESPONSE_JSON_SCHEMA);
    expect(keys).not.toContain("$schema");
    expect(keys).not.toContain("format");
    expect(keys).not.toContain("exclusiveMinimum");
    expect(JSON.stringify(PLAN_RESPONSE_JSON_SCHEMA)).not.toContain(
      "9007199254740991",
    );
  });

  it("passes the abort signal to fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: "{}" } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await requestPlanCompletion({
      apiKey: "secret-key",
      messages,
      signal: controller.signal,
    });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      signal: controller.signal,
    });
  });

  it("maps non-success responses to a safe upstream error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            message: "sensitive upstream body",
            reasoning_details: "private reasoning",
          },
          429,
        ),
      ),
    );

    try {
      await requestPlanCompletion({ apiKey: "secret-key", messages });
      expect.unreachable("Expected requestPlanCompletion to reject");
    } catch (error) {
      expectSafeError(error, {
        code: "UPSTREAM_ERROR",
        message: "Planning service is temporarily unavailable.",
      });
    }
  });

  it.each([null, "", "   "])(
    "rejects empty model content safely",
    async (content) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse({
            choices: [{ message: { content } }],
          }),
        ),
      );

      try {
        await requestPlanCompletion({ apiKey: "secret-key", messages });
        expect.unreachable("Expected requestPlanCompletion to reject");
      } catch (error) {
        expectSafeError(error, {
          code: "INVALID_MODEL_OUTPUT",
          message: "Planning service returned an invalid response.",
        });
      }
    },
  );

  it("converts a malformed response envelope without leaking Zod errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          choices: "invalid",
          message: "sensitive upstream body",
          reasoning_details: "private reasoning",
        }),
      ),
    );

    try {
      await requestPlanCompletion({ apiKey: "secret-key", messages });
      expect.unreachable("Expected requestPlanCompletion to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(PlanError);
      expect(error).not.toBeInstanceOf(z.ZodError);
      expectSafeError(error, {
        code: "INVALID_MODEL_OUTPUT",
        message: "Planning service returned an invalid response.",
      });
    }
  });

  it("maps response body read failures to an upstream error", async () => {
    const response = {
      ok: true,
      json: vi
        .fn()
        .mockRejectedValue(
          new TypeError(
            "sensitive upstream body reasoning_details secret-key",
          ),
        ),
    } as unknown as Response;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    try {
      await requestPlanCompletion({ apiKey: "secret-key", messages });
      expect.unreachable("Expected requestPlanCompletion to reject");
    } catch (error) {
      expectSafeError(error, {
        code: "UPSTREAM_ERROR",
        message: "Planning service is temporarily unavailable.",
      });
    }
  });

  it.each([
    {
      label: "an error finish reason",
      choice: {
        finish_reason: "error",
      },
    },
    {
      label: "a choice error",
      choice: {
        finish_reason: "stop",
        error: {
          message: "sensitive upstream body",
          reasoning_details: "private reasoning",
        },
      },
    },
  ])("maps $label to a safe upstream error", async ({ choice }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ choices: [choice] })),
    );

    try {
      await requestPlanCompletion({ apiKey: "secret-key", messages });
      expect.unreachable("Expected requestPlanCompletion to reject");
    } catch (error) {
      expectSafeError(error, {
        code: "UPSTREAM_ERROR",
        message: "Planning service is temporarily unavailable.",
      });
    }
  });

  it("maps network failures to a safe upstream error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new TypeError(
            "sensitive upstream body reasoning_details secret-key",
          ),
        ),
    );

    try {
      await requestPlanCompletion({ apiKey: "secret-key", messages });
      expect.unreachable("Expected requestPlanCompletion to reject");
    } catch (error) {
      expectSafeError(error, {
        code: "UPSTREAM_ERROR",
        message: "Planning service is temporarily unavailable.",
      });
    }
  });

  it("rethrows AbortError without wrapping it", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    try {
      await requestPlanCompletion({ apiKey: "secret-key", messages });
      expect.unreachable("Expected requestPlanCompletion to reject");
    } catch (error) {
      expect(error).toBe(abortError);
    }
  });

  it("rethrows a custom abort reason when the signal is aborted", async () => {
    const customReason = { code: "caller_cancelled" };
    const controller = new AbortController();
    controller.abort(customReason);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch rejected after abort")),
    );

    try {
      await requestPlanCompletion({
        apiKey: "secret-key",
        messages,
        signal: controller.signal,
      });
      expect.unreachable("Expected requestPlanCompletion to reject");
    } catch (error) {
      expect(error).toBe(customReason);
    }
  });
});
