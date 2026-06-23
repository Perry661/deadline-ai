import {
  generatedPlanSchema,
  type GeneratedPlan,
  type PlanRequest,
} from "./schema";

export class GeneratedPlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeneratedPlanValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function validatePlanAgainstRequest(
  input: unknown,
  request: PlanRequest,
): GeneratedPlan {
  const plan = generatedPlanSchema.parse(input);
  const dailyCapacity = Math.round(request.hoursPerDay * 60);

  for (const day of plan.days) {
    if (day.date > request.deadline) {
      throw new GeneratedPlanValidationError(
        "Plan contains a date after the deadline",
      );
    }

    if (day.date < request.currentDate) {
      throw new GeneratedPlanValidationError(
        "Plan contains a date before the current date",
      );
    }

    const stepTotal = day.steps.reduce(
      (total, step) => total + step.estimatedMinutes,
      0,
    );

    if (day.totalMinutes !== stepTotal) {
      throw new GeneratedPlanValidationError(
        "Daily total does not match step totals",
      );
    }

    if (day.totalMinutes > dailyCapacity) {
      throw new GeneratedPlanValidationError(
        "Daily plan exceeds available capacity",
      );
    }
  }

  const planTotal = plan.days.reduce(
    (total, day) => total + day.totalMinutes,
    0,
  );

  if (plan.totalEstimatedMinutes !== planTotal) {
    throw new GeneratedPlanValidationError(
      "Plan total does not match step totals",
    );
  }

  return plan;
}
