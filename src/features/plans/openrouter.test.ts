import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { PlanError } from "./errors";
import { requestPlanCompletion } from "./openrouter";
import { type PlanningMessage } from "./prompt";
import { generatedPlanSchema } from "./schema";

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
      reasoning: { enabled: true },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "generated_plan",
          strict: true,
          schema: z.toJSONSchema(generatedPlanSchema),
        },
      },
    });
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
      vi.fn().mockResolvedValue(jsonResponse({ secret: "do not expose" }, 429)),
    );

    await expect(
      requestPlanCompletion({ apiKey: "secret-key", messages }),
    ).rejects.toMatchObject({
      name: "PlanError",
      code: "UPSTREAM_ERROR",
      status: 502,
      message: "Planning service is temporarily unavailable.",
    });
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

      await expect(
        requestPlanCompletion({ apiKey: "secret-key", messages }),
      ).rejects.toMatchObject({
        name: "PlanError",
        code: "INVALID_MODEL_OUTPUT",
        status: 502,
        message: "Planning service returned an invalid response.",
      });
    },
  );

  it("converts a malformed response envelope without leaking Zod errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ choices: "invalid" })),
    );

    try {
      await requestPlanCompletion({ apiKey: "secret-key", messages });
      expect.unreachable("Expected requestPlanCompletion to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(PlanError);
      expect(error).not.toBeInstanceOf(z.ZodError);
      expect(error).toMatchObject({
        code: "INVALID_MODEL_OUTPUT",
        status: 502,
        message: "Planning service returned an invalid response.",
      });
    }
  });

  it("maps network failures to a safe upstream error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("socket exposed details")),
    );

    await expect(
      requestPlanCompletion({ apiKey: "secret-key", messages }),
    ).rejects.toMatchObject({
      name: "PlanError",
      code: "UPSTREAM_ERROR",
      status: 502,
      message: "Planning service is temporarily unavailable.",
    });
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
});
