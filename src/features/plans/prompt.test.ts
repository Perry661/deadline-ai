import { describe, expect, it } from "vitest";

import { buildPlanningMessages } from "./prompt";

const request = {
  taskDescription: "Ship the Deadline AI MVP",
  deadline: "2026-07-03",
  hoursPerDay: 1.75,
  currentDate: "2026-07-01",
  timeZone: "America/Los_Angeles",
};

describe("buildPlanningMessages", () => {
  it("builds deterministic system and user messages with the planning rules", () => {
    const messages = buildPlanningMessages(request);

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Deadline AI execution planner");
    expect(messages[0].content).toContain("schema");
    expect(messages[0].content).toContain("English");
    expect(messages[0].content).toContain("15-120 minutes");
    expect(messages[0].content).toContain("daily capacity");
    expect(messages[0].content).toContain(
      "on_track, at_risk, or unrealistic",
    );
    expect(messages[0].content).toContain("minimum viable deliverable");
    expect(messages[0].content).toContain("scope reduction");
    expect(messages[0].content).toContain(
      "review, correction, submission, and contingency",
    );

    expect(messages[1]).toEqual({
      role: "user",
      content: [
        "Task: Ship the Deadline AI MVP",
        "Current date: 2026-07-01",
        "Deadline: 2026-07-03",
        "Timezone: America/Los_Angeles",
        "Daily capacity: 105 minutes",
      ].join("\n"),
    });
  });

  it("returns identical messages for identical requests", () => {
    expect(buildPlanningMessages(request)).toEqual(
      buildPlanningMessages(request),
    );
  });
});
