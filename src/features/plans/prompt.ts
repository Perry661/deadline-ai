import type { PlanRequest } from "./schema";

export type PlanningMessage = {
  role: "system" | "user";
  content: string;
};

const PLANNING_SYSTEM_PROMPT = [
  "You are the Deadline AI execution planner.",
  "Return only data that conforms to the provided schema, with no prose or markdown outside the schema.",
  "Write all user-visible text in English.",
  "Create concrete execution steps that are usually 15-120 minutes each.",
  "Never schedule more work than the daily capacity.",
  "Set feasibility to exactly one of: on_track, at_risk, or unrealistic.",
  "When time is insufficient, still produce a useful plan that protects the minimum viable deliverable and states an explicit scope reduction.",
  "When feasible, reserve the final day for review, correction, submission, and contingency.",
].join("\n");

export function buildPlanningMessages(
  request: PlanRequest,
): PlanningMessage[] {
  const dailyCapacityMinutes = Math.round(request.hoursPerDay * 60);

  return [
    {
      role: "system",
      content: PLANNING_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: [
        `Task: ${request.taskDescription}`,
        `Current date: ${request.currentDate}`,
        `Deadline: ${request.deadline}`,
        `Timezone: ${request.timeZone}`,
        `Daily capacity: ${dailyCapacityMinutes} minutes`,
      ].join("\n"),
    },
  ];
}
