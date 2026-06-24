import { describe, expect, it } from "vitest";

import type { StoredTask } from "./task";
import {
  createExportFilename,
  parseTasksFromJsonExport,
  serializeTasksToJson,
  serializeTasksToMarkdown,
} from "./export";

const task: StoredTask = {
  id: "task-1",
  taskDescription: "Record a hackathon demo video",
  deadline: "2026-06-25",
  hoursPerDay: 2,
  createdAt: "2026-06-23T12:00:00.000Z",
  updatedAt: "2026-06-23T12:00:00.000Z",
  plan: {
    title: "Hackathon Demo Video Recording Plan",
    summary: "Create and rehearse a concise project demo.",
    feasibility: "on_track",
    riskExplanation: "The work fits the available time.",
    scopeRecommendation: "Keep the video focused on the core workflow.",
    totalEstimatedMinutes: 90,
    days: [
      {
        date: "2026-06-24",
        dailyFocus: "Prepare and record",
        totalMinutes: 90,
        steps: [
          {
            id: "step-1",
            title: "Write the demo script",
            estimatedMinutes: 45,
            completed: true,
          },
          {
            id: "step-2",
            title: "Record the screen demo",
            estimatedMinutes: 45,
            completed: false,
          },
        ],
      },
    ],
  },
};

describe("task export", () => {
  it("serializes selected tasks as restorable JSON", () => {
    const json = serializeTasksToJson(
      [task],
      "2026-06-23T12:30:00.000Z",
    );

    expect(JSON.parse(json)).toEqual({
      exportedAt: "2026-06-23T12:30:00.000Z",
      version: 1,
      tasks: [task],
    });
  });

  it("serializes selected tasks as readable Markdown", () => {
    expect(serializeTasksToMarkdown([task])).toContain(
      "# Deadline AI task export",
    );
    expect(serializeTasksToMarkdown([task])).toContain(
      "## Hackathon Demo Video Recording Plan",
    );
    expect(serializeTasksToMarkdown([task])).toContain(
      "- [x] Write the demo script (45 min)",
    );
    expect(serializeTasksToMarkdown([task])).toContain(
      "- [ ] Record the screen demo (45 min)",
    );
  });

  it("creates dated export filenames", () => {
    const date = new Date("2026-06-23T12:00:00");

    expect(createExportFilename("json", date)).toBe(
      "deadline-ai-tasks-2026-06-23.json",
    );
    expect(createExportFilename("md", date)).toBe(
      "deadline-ai-tasks-2026-06-23.md",
    );
  });

  it("parses exported JSON as new local task copies", () => {
    const importedTasks = parseTasksFromJsonExport(
      serializeTasksToJson([task], "2026-06-23T12:30:00.000Z"),
      () => "generated-id",
    );

    expect(importedTasks).toHaveLength(1);
    expect(importedTasks[0]).toMatchObject({
      ...task,
      id: "task-generated-id",
      plan: {
        ...task.plan,
        days: [
          {
            ...task.plan.days[0],
            steps: [
              {
                ...task.plan.days[0].steps[0],
                id: "step-generated-id",
              },
              {
                ...task.plan.days[0].steps[1],
                id: "step-generated-id",
              },
            ],
          },
        ],
      },
    });
  });

  it("rejects invalid import files", () => {
    expect(() => parseTasksFromJsonExport("not json")).toThrow(
      "Invalid Deadline AI export",
    );
    expect(() =>
      parseTasksFromJsonExport(JSON.stringify({ version: 2, tasks: [task] })),
    ).toThrow("Invalid Deadline AI export");
    expect(() =>
      parseTasksFromJsonExport(JSON.stringify({ version: 1, tasks: [{}] })),
    ).toThrow("Invalid Deadline AI export");
  });
});
