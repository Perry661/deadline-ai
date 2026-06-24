import { calculateProgress, type StoredTask } from "./task";

type TaskExportPayload = {
  exportedAt: string;
  version: 1;
  tasks: StoredTask[];
};

function formatFeasibility(feasibility: StoredTask["plan"]["feasibility"]) {
  return feasibility.replaceAll("_", " ");
}

function formatChecked(completed: boolean): string {
  return completed ? "x" : " ";
}

export function buildTaskExportPayload(
  tasks: StoredTask[],
  exportedAt = new Date().toISOString(),
): TaskExportPayload {
  return {
    exportedAt,
    version: 1,
    tasks,
  };
}

export function serializeTasksToJson(
  tasks: StoredTask[],
  exportedAt?: string,
): string {
  return `${JSON.stringify(buildTaskExportPayload(tasks, exportedAt), null, 2)}\n`;
}

export function serializeTasksToMarkdown(tasks: StoredTask[]): string {
  const sections = tasks.map((task) => {
    const lines = [
      `## ${task.plan.title}`,
      "",
      `Original task: ${task.taskDescription}`,
      `Deadline: ${task.deadline}`,
      `Hours per day: ${task.hoursPerDay}`,
      `Feasibility: ${formatFeasibility(task.plan.feasibility)}`,
      `Progress: ${calculateProgress(task)}%`,
      "",
      "### Summary",
      "",
      task.plan.summary,
      "",
      "### Risk",
      "",
      task.plan.riskExplanation,
      "",
      "### Scope recommendation",
      "",
      task.plan.scopeRecommendation,
      "",
      "### Daily plan",
    ];

    for (const day of task.plan.days) {
      lines.push(
        "",
        `#### ${day.date}: ${day.dailyFocus}`,
        "",
        `Total: ${day.totalMinutes} minutes`,
        "",
      );

      for (const step of day.steps) {
        lines.push(
          `- [${formatChecked(step.completed)}] ${step.title} (${step.estimatedMinutes} min)`,
        );
      }
    }

    return lines.join("\n");
  });

  return ["# Deadline AI task export", "", ...sections].join("\n").trimEnd() + "\n";
}

export function createExportFilename(
  extension: "json" | "md",
  date = new Date(),
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `deadline-ai-tasks-${year}-${month}-${day}.${extension}`;
}
