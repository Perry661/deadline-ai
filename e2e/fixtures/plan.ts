export const planFixture = {
  title: "Ship the Deadline AI MVP",
  summary:
    "A focused plan to finish the launch-ready Deadline AI experience before the deadline.",
  feasibility: "on_track",
  riskExplanation:
    "The workload fits the available capacity when the scope stays focused.",
  scopeRecommendation:
    "Prioritize the critical planning flow and defer polish that does not affect launch readiness.",
  totalEstimatedMinutes: 240,
  days: [
    {
      date: "2026-06-28",
      dailyFocus: "Lock the user journey",
      totalMinutes: 120,
      steps: [
        {
          id: "fixture-step-1",
          title: "Draft MVP launch checklist",
          estimatedMinutes: 45,
          completed: false,
        },
        {
          id: "fixture-step-2",
          title: "Review deadline risks",
          estimatedMinutes: 75,
          completed: false,
        },
      ],
    },
    {
      date: "2026-06-29",
      dailyFocus: "Prepare the release path",
      totalMinutes: 120,
      steps: [
        {
          id: "fixture-step-3",
          title: "Validate saved progress",
          estimatedMinutes: 60,
          completed: false,
        },
        {
          id: "fixture-step-4",
          title: "Package final notes",
          estimatedMinutes: 60,
          completed: false,
        },
      ],
    },
  ],
} as const;

export const alternatePlanFixture = {
  ...planFixture,
  title: "Ship the Deadline AI MVP after retry",
  summary: "A regenerated fixture returned after the user retries generation.",
  days: planFixture.days.map((day) => ({
    ...day,
    steps: day.steps.map((step) => ({ ...step })),
  })),
} as const;
