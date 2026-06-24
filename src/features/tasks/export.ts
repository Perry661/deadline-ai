import { calculateProgress, type StoredTask } from "./task";
import { storedTaskSchema } from "./task";

type TaskExportPayload = {
  exportedAt: string;
  version: 1;
  tasks: StoredTask[];
};

const INVALID_EXPORT_MESSAGE = "Invalid Deadline AI export";

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

function createLocalTaskCopy(
  task: StoredTask,
  createId: () => string,
): StoredTask {
  return {
    ...task,
    id: `task-${createId()}`,
    plan: {
      ...task.plan,
      days: task.plan.days.map((day) => ({
        ...day,
        steps: day.steps.map((step) => ({
          ...step,
          id: `step-${createId()}`,
        })),
      })),
    },
  };
}

export function parseTasksFromJsonExport(
  content: string,
  createId = () => globalThis.crypto.randomUUID(),
): StoredTask[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(INVALID_EXPORT_MESSAGE);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    parsed.version !== 1 ||
    !("tasks" in parsed) ||
    !Array.isArray(parsed.tasks)
  ) {
    throw new Error(INVALID_EXPORT_MESSAGE);
  }

  const tasks = parsed.tasks.map((task) => {
    const result = storedTaskSchema.safeParse(task);

    if (!result.success) {
      throw new Error(INVALID_EXPORT_MESSAGE);
    }

    return result.data;
  });

  return tasks.map((task) => createLocalTaskCopy(task, createId));
}
