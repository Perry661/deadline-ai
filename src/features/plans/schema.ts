import { z } from "zod";

export const planRequestSchema = z.object({
  taskDescription: z.string().trim().min(1).max(4000),
  deadline: z.iso.date(),
  hoursPerDay: z.number().positive().max(24),
  currentDate: z.iso.date(),
  timeZone: z.string().trim().min(1).max(100),
});

const planStepSchema = z.object({
  title: z.string().trim().min(1).max(240),
  estimatedMinutes: z.number().int().positive().max(720),
});

const planDaySchema = z.object({
  date: z.iso.date(),
  dailyFocus: z.string().trim().min(1).max(240),
  totalMinutes: z.number().int().positive(),
  steps: z.array(planStepSchema).min(1),
});

export const generatedPlanSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().min(1).max(600),
  feasibility: z.enum(["on_track", "at_risk", "unrealistic"]),
  riskExplanation: z.string().min(1).max(600),
  scopeRecommendation: z.string().min(1).max(600),
  totalEstimatedMinutes: z.number().int().positive(),
  days: z.array(planDaySchema).min(1),
});

export type PlanRequest = z.infer<typeof planRequestSchema>;
export type GeneratedPlan = z.infer<typeof generatedPlanSchema>;
