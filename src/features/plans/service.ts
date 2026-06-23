import { randomUUID } from "node:crypto";

import { z } from "zod";

import { PlanError } from "./errors";
import { requestPlanCompletion } from "./openrouter";
import { buildPlanningMessages } from "./prompt";
import { planRequestSchema, type GeneratedPlan } from "./schema";
import { validatePlanAgainstRequest } from "./validation";

export type CompletionFn = typeof requestPlanCompletion;

type GeneratePlanOptions = {
  apiKey: string;
  complete?: CompletionFn;
  signal?: AbortSignal;
};

type GeneratedStepWithState = GeneratedPlan["days"][number]["steps"][number] & {
  id: string;
  completed: false;
};

type GeneratedDayWithState = Omit<
  GeneratedPlan["days"][number],
  "steps"
> & {
  steps: GeneratedStepWithState[];
};

export type GeneratedPlanWithState = Omit<GeneratedPlan, "days"> & {
  days: GeneratedDayWithState[];
};

const INVALID_MODEL_OUTPUT_MESSAGE =
  "The generated plan was invalid. Please try again.";

function invalidModelOutputError(): PlanError {
  return new PlanError(
    "INVALID_MODEL_OUTPUT",
    INVALID_MODEL_OUTPUT_MESSAGE,
    502,
  );
}

function isDomException(error: unknown): error is DOMException {
  return error instanceof DOMException;
}

function addStepState(plan: GeneratedPlan): GeneratedPlanWithState {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      steps: day.steps.map((step) => ({
        ...step,
        id: `step-${randomUUID()}`,
        completed: false,
      })),
    })),
  };
}

export async function generatePlan(
  rawRequest: unknown,
  options: GeneratePlanOptions,
): Promise<GeneratedPlanWithState> {
  const request = planRequestSchema.parse(rawRequest);
  const complete = options.complete ?? requestPlanCompletion;

  try {
    const content = await complete({
      apiKey: options.apiKey,
      messages: buildPlanningMessages(request),
      signal: options.signal,
    });
    const parsed = JSON.parse(content) as unknown;
    const plan = validatePlanAgainstRequest(parsed, request);

    return addStepState(plan);
  } catch (error) {
    if (error instanceof PlanError || isDomException(error)) {
      throw error;
    }

    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      throw invalidModelOutputError();
    }

    throw invalidModelOutputError();
  }
}
