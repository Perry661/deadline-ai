import "server-only";

import { z } from "zod";

import { PlanError } from "./errors";
import type { PlanningMessage } from "./prompt";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const UPSTREAM_ERROR_MESSAGE =
  "Planning service is temporarily unavailable.";
const INVALID_OUTPUT_MESSAGE =
  "Planning service returned an invalid response.";

export const PLAN_RESPONSE_JSON_SCHEMA = {
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
    riskExplanation: { type: "string", minLength: 1, maxLength: 600 },
    scopeRecommendation: {
      type: "string",
      minLength: 1,
      maxLength: 600,
    },
    totalEstimatedMinutes: { type: "integer", minimum: 1 },
    days: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "dailyFocus", "totalMinutes", "steps"],
        properties: {
          date: {
            type: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          },
          dailyFocus: { type: "string", minLength: 1, maxLength: 240 },
          totalMinutes: { type: "integer", minimum: 1 },
          steps: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "estimatedMinutes"],
              properties: {
                title: { type: "string", minLength: 1, maxLength: 240 },
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
} as const;

const completionEnvelopeSchema = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable().optional(),
        error: z.unknown().optional(),
        message: z
          .object({
            content: z.string().nullable(),
          })
          .optional(),
      }),
    )
    .min(1),
});

type RequestPlanCompletionInput = {
  apiKey: string;
  messages: PlanningMessage[];
  signal?: AbortSignal;
};

function upstreamError(): PlanError {
  return new PlanError("UPSTREAM_ERROR", UPSTREAM_ERROR_MESSAGE, 502);
}

function invalidOutputError(): PlanError {
  return new PlanError(
    "INVALID_MODEL_OUTPUT",
    INVALID_OUTPUT_MESSAGE,
    502,
  );
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export async function requestPlanCompletion({
  apiKey,
  messages,
  signal,
}: RequestPlanCompletionInput): Promise<string> {
  let response: Response;

  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "Deadline AI",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-v4-pro",
        messages,
        max_tokens: 2000,
        reasoning: { enabled: true },
        provider: { require_parameters: true },
        temperature: 0.2,
        // OpenRouter models endpoint verified on 2026-06-23:
        // deepseek/deepseek-v4-pro supports response_format + structured_outputs.
        // Keep strict json_schema here and retain server-side Zod validation.
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "generated_plan",
            strict: true,
            schema: PLAN_RESPONSE_JSON_SCHEMA,
          },
        },
      }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      if (signal.reason !== undefined) {
        throw signal.reason;
      }

      throw error;
    }

    if (isAbortError(error)) {
      throw error;
    }

    throw upstreamError();
  }

  if (!response.ok) {
    throw upstreamError();
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw upstreamError();
  }

  let envelope: z.infer<typeof completionEnvelopeSchema>;

  try {
    envelope = completionEnvelopeSchema.parse(body);
  } catch {
    throw invalidOutputError();
  }

  const choice = envelope.choices[0];
  if (
    choice.finish_reason === "error" ||
    (choice.error !== undefined && choice.error !== null)
  ) {
    throw upstreamError();
  }

  const content = choice.message?.content;
  if (content === undefined || content === null || content.trim() === "") {
    throw invalidOutputError();
  }

  return content;
}
