import { z } from "zod";

import type { PlanRequest } from "../plans/schema";
import type { GeneratedPlanWithState } from "../plans/service";

export type Plan = GeneratedPlanWithState;

const planStepWithStateSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(240),
  estimatedMinutes: z.number().int().positive().max(720),
  completed: z.boolean(),
});

const planDayWithStateSchema = z.object({
  date: z.iso.date(),
  dailyFocus: z.string().trim().min(1).max(240),
  totalMinutes: z.number().int().positive(),
  steps: z.array(planStepWithStateSchema).min(1),
});

const planWithStateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(600),
  feasibility: z.enum(["on_track", "at_risk", "unrealistic"]),
  riskExplanation: z.string().trim().min(1).max(600),
  scopeRecommendation: z.string().trim().min(1).max(600),
  totalEstimatedMinutes: z.number().int().positive(),
  days: z.array(planDayWithStateSchema).min(1),
});

export const storedTaskSchema = z.object({
  id: z.string().trim().min(1),
  taskDescription: z.string().trim().min(1),
  deadline: z.iso.date(),
  hoursPerDay: z.number().positive().max(24),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  plan: planWithStateSchema,
});

export type StoredTask = z.infer<typeof storedTaskSchema>;

function createId(): string {
  return `task-${globalThis.crypto.randomUUID()}`;
}

export function calculateProgress(task: StoredTask): number {
  const steps = task.plan.days.flatMap((day) => day.steps);

  if (steps.length === 0) {
    return 0;
  }

  const completedSteps = steps.filter((step) => step.completed).length;

  return Math.round((completedSteps / steps.length) * 100);
}

export function toggleStep(task: StoredTask, stepId: string): StoredTask {
  return {
    ...task,
    updatedAt: new Date().toISOString(),
    plan: {
      ...task.plan,
      days: task.plan.days.map((day) => ({
        ...day,
        steps: day.steps.map((step) =>
          step.id === stepId
            ? { ...step, completed: !step.completed }
            : step,
        ),
      })),
    },
  };
}

export function createStoredTask(
  input: PlanRequest,
  plan: Plan,
): StoredTask {
  const now = new Date().toISOString();

  return {
    id: createId(),
    taskDescription: input.taskDescription,
    deadline: input.deadline,
    hoursPerDay: input.hoursPerDay,
    createdAt: now,
    updatedAt: now,
    plan,
  };
}
