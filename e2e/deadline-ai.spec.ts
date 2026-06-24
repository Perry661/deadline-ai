import { expect, test, type Page, type Route } from "@playwright/test";

import { alternatePlanFixture, planFixture } from "./fixtures/plan";

const TASK_DESCRIPTION = "Ship the Deadline AI MVP";
const HOURS_PER_DAY = "2";
const STORAGE_KEY = "deadline-ai.tasks.v1";

function futureDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const DEADLINE = futureDate(8);

async function openNewTaskFromEmptyDashboard(page: Page) {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Turn pressure into a plan." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /create your first plan/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: /create your first plan/i }).click();
  await expect(page).toHaveURL(/\/tasks\/new$/);
}

async function fillTaskForm(page: Page) {
  await page.getByLabel("Task description").fill(TASK_DESCRIPTION);
  await page.getByLabel("Deadline").fill(DEADLINE);
  await page.getByLabel("Hours per day").fill(HOURS_PER_DAY);
}

async function expectTaskInputsToRemain(page: Page) {
  await expect(page.getByLabel("Task description")).toHaveValue(
    TASK_DESCRIPTION,
  );
  await expect(page.getByLabel("Deadline")).toHaveValue(DEADLINE);
  await expect(page.getByLabel("Hours per day")).toHaveValue(HOURS_PER_DAY);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
});

test("generates, persists progress for, lists, and deletes a deadline plan", async ({
  page,
}) => {
  await page.route("**/api/plans", async (route) => {
    await route.fulfill({ json: { plan: planFixture } });
  });

  await openNewTaskFromEmptyDashboard(page);
  await fillTaskForm(page);
  await page.getByRole("button", { name: /generate plan/i }).click();

  await expect(page).toHaveURL(/\/tasks\/task-/);
  await expect(
    page.getByRole("heading", { name: planFixture.title }),
  ).toBeVisible();
  await expect(page.getByText("0% complete")).toBeVisible();

  const firstStep = page.getByLabel("Draft MVP launch checklist, 45 minutes");
  await firstStep.check();

  await expect(firstStep).toBeChecked();
  await expect(page.getByText("25% complete")).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("heading", { name: planFixture.title }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Draft MVP launch checklist, 45 minutes"),
  ).toBeChecked();
  await expect(page.getByText("25% complete")).toBeVisible();

  await page.getByRole("link", { name: "Deadline AI" }).click();

  await expect(
    page.getByRole("heading", { name: "Your active plans" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: planFixture.title })).toBeVisible();
  await expect(
    page.getByRole("progressbar", {
      name: `Progress for ${planFixture.title}`,
    }),
  ).toHaveAttribute("value", "25");

  await page
    .getByRole("button", { name: `Delete ${planFixture.title}` })
    .click();

  await expect(
    page.getByRole("heading", { name: "Turn pressure into a plan." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: planFixture.title })).toHaveCount(
    0,
  );
});

test("lets users stop generation without losing input and submit again", async ({
  page,
}) => {
  let requestCount = 0;
  let heldRoute: Route | undefined;
  let firstRequestSeen!: () => void;
  const firstRequest = new Promise<void>((resolve) => {
    firstRequestSeen = resolve;
  });

  await page.route("**/api/plans", async (route) => {
    requestCount += 1;

    if (requestCount === 1) {
      heldRoute = route;
      firstRequestSeen();
      return;
    }

    await route.fulfill({ json: { plan: alternatePlanFixture } });
  });

  await openNewTaskFromEmptyDashboard(page);
  await fillTaskForm(page);
  await page.getByRole("button", { name: /generate plan/i }).click();

  await firstRequest;
  await expect(
    page.getByRole("button", { name: /stop generation/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: /stop generation/i }).click();

  await expectTaskInputsToRemain(page);
  await expect(
    page.getByRole("button", { name: /generate plan/i }),
  ).toBeVisible();

  await heldRoute?.fulfill({ json: { plan: planFixture } }).catch(() => {
    // The browser may have already aborted the stopped request.
  });

  await page.getByRole("button", { name: /generate plan/i }).click();

  await expect(page).toHaveURL(/\/tasks\/task-/);
  await expect(
    page.getByRole("heading", { name: alternatePlanFixture.title }),
  ).toBeVisible();
});

test("shows an actionable generation error and lets users retry", async ({
  page,
}) => {
  let requestCount = 0;

  await page.route("**/api/plans", async (route) => {
    requestCount += 1;

    if (requestCount === 1) {
      await route.fulfill({
        status: 502,
        json: {
          code: "UPSTREAM_ERROR",
          message: "Unable to generate a plan.",
        },
      });
      return;
    }

    await route.fulfill({ json: { plan: planFixture } });
  });

  await openNewTaskFromEmptyDashboard(page);
  await fillTaskForm(page);
  await page.getByRole("button", { name: /generate plan/i }).click();

  await expect(page.getByText("Plan generation failed")).toBeVisible();
  await expect(page.getByText("Unable to generate a plan.")).toBeVisible();
  await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
  await expectTaskInputsToRemain(page);
  expect(requestCount).toBe(1);

  await page.getByRole("button", { name: /try again/i }).click();

  await expect(page).toHaveURL(/\/tasks\/task-/);
  await expect(
    page.getByRole("heading", { name: planFixture.title }),
  ).toBeVisible();
  expect(requestCount).toBe(2);
});

test("imports exported JSON as a new local task copy", async ({ page }) => {
  const exportedTaskId = "task-from-export";
  const exportedStepId = "step-from-export";
  const exportedTask = {
    id: exportedTaskId,
    taskDescription: TASK_DESCRIPTION,
    deadline: DEADLINE,
    hoursPerDay: Number(HOURS_PER_DAY),
    createdAt: "2026-06-23T12:00:00.000Z",
    updatedAt: "2026-06-23T12:00:00.000Z",
    plan: {
      ...planFixture,
      days: planFixture.days.map((day) => ({
        ...day,
        steps: day.steps.map((step, index) => ({
          ...step,
          id: index === 0 ? exportedStepId : step.id,
        })),
      })),
    },
  };

  await page.goto("/");
  await page.getByLabel("Import JSON").setInputFiles({
    name: "deadline-ai-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        exportedAt: "2026-06-23T12:30:00.000Z",
        tasks: [exportedTask],
      }),
    ),
  });

  await expect(
    page.getByText("Imported 1 task as a new local copy."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: planFixture.title })).toBeVisible();

  const savedTasks = await page.evaluate((key) => {
    return JSON.parse(window.localStorage.getItem(key) ?? "[]") as Array<{
      id: string;
      plan: { days: Array<{ steps: Array<{ id: string }> }> };
    }>;
  }, STORAGE_KEY);

  expect(savedTasks).toHaveLength(1);
  expect(savedTasks[0].id).not.toBe(exportedTaskId);
  expect(savedTasks[0].plan.days[0].steps[0].id).not.toBe(exportedStepId);
});
