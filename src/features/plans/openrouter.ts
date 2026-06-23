import { z } from "zod";

import { PlanError } from "./errors";
import type { PlanningMessage } from "./prompt";
import { generatedPlanSchema } from "./schema";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const UPSTREAM_ERROR_MESSAGE =
  "Planning service is temporarily unavailable.";
const INVALID_OUTPUT_MESSAGE =
  "Planning service returned an invalid response.";

const completionEnvelopeSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable(),
        }),
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
  return new PlanError("UPSTREAM_ERROR", 502, UPSTREAM_ERROR_MESSAGE);
}

function invalidOutputError(): PlanError {
  return new PlanError(
    "INVALID_MODEL_OUTPUT",
    502,
    INVALID_OUTPUT_MESSAGE,
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
        reasoning: { enabled: true },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "generated_plan",
            strict: true,
            schema: z.toJSONSchema(generatedPlanSchema),
          },
        },
      }),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw upstreamError();
  }

  if (!response.ok) {
    throw upstreamError();
  }

  let envelope: z.infer<typeof completionEnvelopeSchema>;

  try {
    envelope = completionEnvelopeSchema.parse(await response.json());
  } catch {
    throw invalidOutputError();
  }

  const content = envelope.choices[0].message.content;
  if (content === null || content.trim() === "") {
    throw invalidOutputError();
  }

  return content;
}
