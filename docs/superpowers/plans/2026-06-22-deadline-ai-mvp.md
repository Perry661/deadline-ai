# Deadline AI MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy an English-language Next.js application that converts a task, deadline, and daily time capacity into a validated day-by-day AI plan with local progress tracking.

**Architecture:** Use a Next.js App Router application with one server-only plan-generation route and browser-only local persistence. Shared Zod schemas define the boundary between form input, OpenRouter output, stored tasks, and rendered UI. The OpenRouter key stays server-side; the browser uses `AbortController` to stop generation and ignores superseded responses.

**Tech Stack:** Next.js, React, TypeScript, Zod, CSS variables/CSS modules, Vitest, React Testing Library, Playwright, OpenRouter Chat Completions, Vercel

---

## File Map

### Application shell and pages

- `app/layout.tsx` — root metadata, font setup, and global shell.
- `app/page.tsx` — dashboard route.
- `app/tasks/new/page.tsx` — task creation route.
- `app/tasks/[taskId]/page.tsx` — task plan route.
- `app/globals.css` — Energetic Editorial theme tokens and global responsive rules.
- `app/api/plans/route.ts` — validated server endpoint for OpenRouter plan generation.

### Planning domain

- `src/features/plans/schema.ts` — Zod schemas and inferred TypeScript types.
- `src/features/plans/validation.ts` — cross-field date, duration, and capacity validation.
- `src/features/plans/prompt.ts` — deterministic system/user prompt construction.
- `src/features/plans/openrouter.ts` — server-only OpenRouter client.
- `src/features/plans/service.ts` — orchestration: call model, parse, validate, assign step IDs.
- `src/features/plans/errors.ts` — stable internal error classes and API error codes.

### Task persistence and state

- `src/features/tasks/task.ts` — stored task schema, constructors, and progress calculation.
- `src/features/tasks/storage.ts` — guarded `localStorage` read/write/delete operations.
- `src/features/tasks/use-tasks.ts` — client hook exposing task collection actions.

### UI components

- `src/components/app-header.tsx` — product identity and primary navigation.
- `src/components/empty-state.tsx` — first-use dashboard state.
- `src/components/task-card.tsx` — dashboard task summary.
- `src/components/task-form.tsx` — form, request lifecycle, Stop generation control.
- `src/components/plan-header.tsx` — summary, progress, deadline, feasibility.
- `src/components/risk-panel.tsx` — risk explanation and scope recommendation.
- `src/components/day-plan.tsx` — one date group and its checkable steps.
- `src/components/error-message.tsx` — accessible actionable error display.

### Tests and configuration

- `vitest.config.ts`, `vitest.setup.ts` — unit/component test configuration.
- `playwright.config.ts` — browser test configuration.
- `src/**/*.test.ts` and `src/**/*.test.tsx` — domain and component tests.
- `app/api/plans/route.test.ts` — API route tests.
- `e2e/deadline-ai.spec.ts` — critical user journeys.
- `.env.example` — documented server environment variables.
- `README.md` — local setup, testing, API key, and Vercel deployment.

## Task 1: Scaffold the Next.js Application and Test Harness

**Files:**
- Create: `package.json`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Scaffold Next.js in the existing repository**

Run:

```bash
npx create-next-app@latest . --typescript --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

When prompted about overwriting `README.md` or `.gitignore`, keep the existing files and merge generated requirements manually. Expected: a Next.js App Router project is created without changing the product design documents.

- [ ] **Step 2: Install runtime and test dependencies**

Run:

```bash
npm install zod
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test vite-tsconfig-paths
```

Expected: dependencies are added to `package.json` and `package-lock.json`.

- [ ] **Step 3: Add test scripts to `package.json`**

Add:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    clearMocks: true,
  },
});
```

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Configure Playwright**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
```

- [ ] **Step 6: Verify the baseline**

Run:

```bash
npm run lint
npm test
npm run build
```

Expected: lint and build pass; Vitest exits successfully with no tests or a configured no-test result. If Vitest rejects an empty suite, add `--passWithNoTests` to the `test` script until Task 2 adds tests.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app vitest.config.ts vitest.setup.ts playwright.config.ts .gitignore
git commit -m "chore: scaffold Deadline AI application"
```

## Task 2: Define and Validate the Planning Contract

**Files:**
- Create: `src/features/plans/schema.ts`
- Create: `src/features/plans/validation.ts`
- Create: `src/features/plans/validation.test.ts`

- [ ] **Step 1: Write failing schema and cross-field validation tests**

Create `src/features/plans/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validatePlanAgainstRequest } from "./validation";

const request = {
  taskDescription: "Build and publish a portfolio website",
  deadline: "2026-06-27",
  hoursPerDay: 2,
  currentDate: "2026-06-22",
  timeZone: "America/Los_Angeles",
};

const plan = {
  title: "Publish portfolio website",
  summary: "Build a focused three-page portfolio and deploy it.",
  feasibility: "at_risk" as const,
  riskExplanation: "The deadline is close.",
  scopeRecommendation: "Limit the first release to three pages.",
  totalEstimatedMinutes: 210,
  days: [
    {
      date: "2026-06-23",
      dailyFocus: "Define and build the homepage",
      totalMinutes: 120,
      steps: [
        { title: "Define page structure", estimatedMinutes: 30 },
        { title: "Build homepage layout", estimatedMinutes: 90 },
      ],
    },
    {
      date: "2026-06-24",
      dailyFocus: "Build project content",
      totalMinutes: 90,
      steps: [{ title: "Build project page", estimatedMinutes: 90 }],
    },
  ],
};

describe("validatePlanAgainstRequest", () => {
  it("accepts a plan inside the deadline and daily capacity", () => {
    expect(validatePlanAgainstRequest(plan, request)).toEqual(plan);
  });

  it("rejects a day above the user's capacity", () => {
    const invalid = {
      ...plan,
      days: [{ ...plan.days[0], totalMinutes: 121 }],
    };
    expect(() => validatePlanAgainstRequest(invalid, request)).toThrow(
      "Daily plan exceeds available capacity",
    );
  });

  it("rejects a plan scheduled after the deadline", () => {
    const invalid = {
      ...plan,
      days: [{ ...plan.days[0], date: "2026-06-28" }],
    };
    expect(() => validatePlanAgainstRequest(invalid, request)).toThrow(
      "Plan contains a date after the deadline",
    );
  });

  it("rejects mismatched totals", () => {
    const invalid = { ...plan, totalEstimatedMinutes: 999 };
    expect(() => validatePlanAgainstRequest(invalid, request)).toThrow(
      "Plan total does not match step totals",
    );
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
npm test -- src/features/plans/validation.test.ts
```

Expected: FAIL because `./validation` does not exist.

- [ ] **Step 3: Define Zod schemas and types**

Create `src/features/plans/schema.ts`:

```ts
import { z } from "zod";

export const planRequestSchema = z.object({
  taskDescription: z.string().trim().min(1).max(4000),
  deadline: z.iso.date(),
  hoursPerDay: z.number().positive().max(24),
  currentDate: z.iso.date(),
  timeZone: z.string().trim().min(1).max(100),
});

export const generatedStepSchema = z.object({
  title: z.string().trim().min(1).max(240),
  estimatedMinutes: z.number().int().positive().max(720),
});

export const generatedDaySchema = z.object({
  date: z.iso.date(),
  dailyFocus: z.string().trim().min(1).max(240),
  totalMinutes: z.number().int().positive(),
  steps: z.array(generatedStepSchema).min(1),
});

export const generatedPlanSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(600),
  feasibility: z.enum(["on_track", "at_risk", "unrealistic"]),
  riskExplanation: z.string().trim().min(1).max(600),
  scopeRecommendation: z.string().trim().min(1).max(600),
  totalEstimatedMinutes: z.number().int().positive(),
  days: z.array(generatedDaySchema).min(1),
});

export type PlanRequest = z.infer<typeof planRequestSchema>;
export type GeneratedPlan = z.infer<typeof generatedPlanSchema>;
```

- [ ] **Step 4: Implement cross-field validation**

Create `src/features/plans/validation.ts`:

```ts
import {
  generatedPlanSchema,
  type GeneratedPlan,
  type PlanRequest,
} from "./schema";

export function validatePlanAgainstRequest(
  input: unknown,
  request: PlanRequest,
): GeneratedPlan {
  const plan = generatedPlanSchema.parse(input);
  const capacityMinutes = Math.round(request.hoursPerDay * 60);

  for (const day of plan.days) {
    if (day.date > request.deadline) {
      throw new Error("Plan contains a date after the deadline");
    }
    if (day.date < request.currentDate) {
      throw new Error("Plan contains a date before the current date");
    }
    const stepTotal = day.steps.reduce(
      (total, step) => total + step.estimatedMinutes,
      0,
    );
    if (day.totalMinutes !== stepTotal) {
      throw new Error("Daily total does not match step totals");
    }
    if (day.totalMinutes > capacityMinutes) {
      throw new Error("Daily plan exceeds available capacity");
    }
  }

  const total = plan.days.reduce((sum, day) => sum + day.totalMinutes, 0);
  if (total !== plan.totalEstimatedMinutes) {
    throw new Error("Plan total does not match step totals");
  }

  return plan;
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- src/features/plans/validation.test.ts
```

Expected: all four tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/plans
git commit -m "feat: define validated planning contract"
```

## Task 3: Build the Prompt and OpenRouter Boundary

**Files:**
- Create: `src/features/plans/prompt.ts`
- Create: `src/features/plans/prompt.test.ts`
- Create: `src/features/plans/errors.ts`
- Create: `src/features/plans/openrouter.ts`
- Create: `src/features/plans/openrouter.test.ts`
- Create: `.env.example`

- [ ] **Step 1: Write failing prompt tests**

Create `src/features/plans/prompt.test.ts`:

```ts
import { expect, it } from "vitest";
import { buildPlanningMessages } from "./prompt";

it("includes capacity, dates, timezone, and risk rules", () => {
  const messages = buildPlanningMessages({
    taskDescription: "Finish a science fair presentation",
    deadline: "2026-06-27",
    hoursPerDay: 2.5,
    currentDate: "2026-06-22",
    timeZone: "America/Los_Angeles",
  });
  const text = JSON.stringify(messages);
  expect(text).toContain("150 minutes");
  expect(text).toContain("2026-06-27");
  expect(text).toContain("America/Los_Angeles");
  expect(text).toContain("unrealistic");
  expect(text).toContain("scope");
});
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm test -- src/features/plans/prompt.test.ts
```

Expected: FAIL because `buildPlanningMessages` is missing.

- [ ] **Step 3: Implement deterministic prompt construction**

Create `src/features/plans/prompt.ts` with:

```ts
import type { PlanRequest } from "./schema";

export function buildPlanningMessages(request: PlanRequest) {
  const capacityMinutes = Math.round(request.hoursPerDay * 60);
  return [
    {
      role: "system" as const,
      content: [
        "You are Deadline AI, an expert execution planner.",
        "Return only data matching the supplied JSON schema.",
        "Write all user-facing text in English.",
        "Split work into concrete steps, normally 15-120 minutes.",
        "Never schedule more than the user's daily capacity.",
        "Classify feasibility as on_track, at_risk, or unrealistic.",
        "Always produce a plan. If time is insufficient, protect the minimum viable deliverable and recommend explicit scope reductions.",
        "When practical, reserve final-day capacity for review, correction, submission, or contingency.",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        `Task: ${request.taskDescription}`,
        `Current date: ${request.currentDate}`,
        `Deadline: ${request.deadline}`,
        `Timezone: ${request.timeZone}`,
        `Daily capacity: ${capacityMinutes} minutes`,
      ].join("\n"),
    },
  ];
}
```

- [ ] **Step 4: Write failing OpenRouter client tests**

Create `src/features/plans/openrouter.test.ts`:

```ts
import { afterEach, expect, it, vi } from "vitest";
import { requestPlanCompletion } from "./openrouter";

afterEach(() => vi.unstubAllGlobals());

it("sends a server-side structured-output request", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "{\"title\":\"Example\"}" } }],
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);

  await requestPlanCompletion({
    apiKey: "secret",
    messages: [{ role: "user", content: "Plan this" }],
    signal: undefined,
  });

  expect(fetchMock).toHaveBeenCalledWith(
    "https://openrouter.ai/api/v1/chat/completions",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
      }),
    }),
  );
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.model).toBe("deepseek/deepseek-v4-pro");
  expect(body.reasoning).toEqual({ enabled: true });
  expect(body.response_format.type).toBe("json_schema");
});

it("throws a stable upstream error for non-2xx responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })),
  );
  await expect(
    requestPlanCompletion({
      apiKey: "secret",
      messages: [],
      signal: undefined,
    }),
  ).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
});
```

- [ ] **Step 5: Implement stable errors and the OpenRouter client**

Create `src/features/plans/errors.ts`:

```ts
export class PlanError extends Error {
  constructor(
    public readonly code:
      | "INVALID_REQUEST"
      | "UPSTREAM_ERROR"
      | "INVALID_MODEL_OUTPUT"
      | "MISSING_CONFIGURATION",
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
```

Create `src/features/plans/openrouter.ts`:

```ts
import { z } from "zod";
import { PlanError } from "./errors";
import { generatedPlanSchema } from "./schema";

const completionSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
});

export async function requestPlanCompletion({
  apiKey,
  messages,
  signal,
}: {
  apiKey: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  signal?: AbortSignal;
}): Promise<string> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "Deadline AI",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-v4-pro",
        messages,
        reasoning: { enabled: true },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "deadline_ai_plan",
            strict: true,
            schema: z.toJSONSchema(generatedPlanSchema),
          },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new PlanError(
      "UPSTREAM_ERROR",
      "The planning service is temporarily unavailable.",
      502,
    );
  }

  const completion = completionSchema.parse(await response.json());
  const content = completion.choices[0].message.content;
  if (!content) {
    throw new PlanError(
      "INVALID_MODEL_OUTPUT",
      "The planning service returned an empty result.",
      502,
    );
  }
  return content;
}
```

- [ ] **Step 6: Document environment variables**

Create `.env.example`:

```dotenv
OPENROUTER_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm test -- src/features/plans/prompt.test.ts src/features/plans/openrouter.test.ts
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/plans .env.example package.json package-lock.json
git commit -m "feat: add OpenRouter planning boundary"
```

## Task 4: Implement the Plan Service and API Route

**Files:**
- Create: `src/features/plans/service.ts`
- Create: `src/features/plans/service.test.ts`
- Create: `app/api/plans/route.ts`
- Create: `app/api/plans/route.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/features/plans/service.test.ts` with a valid JSON plan string and an injected completion function. Assert that:

```ts
expect(result.days[0].steps[0].id).toMatch(/^step-/);
expect(result.days[0].steps[0].completed).toBe(false);
```

Also assert malformed JSON and capacity violations reject with:

```ts
expect(error).toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm test -- src/features/plans/service.test.ts
```

Expected: FAIL because `generatePlan` does not exist.

- [ ] **Step 3: Implement service orchestration**

Create `src/features/plans/service.ts`:

```ts
import { randomUUID } from "node:crypto";
import { PlanError } from "./errors";
import { requestPlanCompletion } from "./openrouter";
import { buildPlanningMessages } from "./prompt";
import { planRequestSchema, type PlanRequest } from "./schema";
import { validatePlanAgainstRequest } from "./validation";

export type CompletionFn = typeof requestPlanCompletion;

export async function generatePlan(
  rawRequest: unknown,
  options: {
    apiKey: string;
    signal?: AbortSignal;
    complete?: CompletionFn;
  },
) {
  const request = planRequestSchema.parse(rawRequest);
  const complete = options.complete ?? requestPlanCompletion;

  try {
    const content = await complete({
      apiKey: options.apiKey,
      messages: buildPlanningMessages(request),
      signal: options.signal,
    });
    const generated = validatePlanAgainstRequest(JSON.parse(content), request);
    return {
      ...generated,
      days: generated.days.map((day) => ({
        ...day,
        steps: day.steps.map((step) => ({
          ...step,
          id: `step-${randomUUID()}`,
          completed: false,
        })),
      })),
    };
  } catch (error) {
    if (error instanceof PlanError || error instanceof DOMException) throw error;
    throw new PlanError(
      "INVALID_MODEL_OUTPUT",
      "The generated plan was invalid. Please try again.",
      502,
    );
  }
}
```

- [ ] **Step 4: Write failing API route tests**

In `app/api/plans/route.test.ts`, mock `generatePlan` and test:

- valid requests return `200` and `{ plan }`;
- invalid input returns `400` with `code: "INVALID_REQUEST"`;
- missing `OPENROUTER_API_KEY` returns `500` with `code: "MISSING_CONFIGURATION"`;
- a `PlanError` preserves its safe status and code.

Use direct calls:

```ts
const request = new Request("http://localhost/api/plans", {
  method: "POST",
  body: JSON.stringify(validRequest),
});
const response = await POST(request);
```

- [ ] **Step 5: Implement `POST /api/plans`**

Create `app/api/plans/route.ts`:

```ts
import { ZodError } from "zod";
import { PlanError } from "@/src/features/plans/errors";
import { generatePlan } from "@/src/features/plans/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        code: "MISSING_CONFIGURATION",
        message: "The planning service is not configured.",
      },
      { status: 500 },
    );
  }

  try {
    const plan = await generatePlan(await request.json(), {
      apiKey,
      signal: request.signal,
    });
    return Response.json({ plan });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return Response.json(
        { code: "INVALID_REQUEST", message: "Check the task details." },
        { status: 400 },
      );
    }
    if (error instanceof PlanError) {
      return Response.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    return Response.json(
      { code: "UPSTREAM_ERROR", message: "Unable to generate a plan." },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- src/features/plans/service.test.ts app/api/plans/route.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/plans app/api/plans
git commit -m "feat: expose validated plan generation API"
```

## Task 5: Implement Stored Tasks and Progress

**Files:**
- Create: `src/features/tasks/task.ts`
- Create: `src/features/tasks/task.test.ts`
- Create: `src/features/tasks/storage.ts`
- Create: `src/features/tasks/storage.test.ts`
- Create: `src/features/tasks/use-tasks.ts`

- [ ] **Step 1: Write failing task-domain tests**

Test creation and progress:

```ts
expect(calculateProgress(task)).toBe(50);
expect(toggleStep(task, "step-1").plan.days[0].steps[0].completed).toBe(true);
```

Use two steps, one completed. Also test that an empty plan reports `0`.

- [ ] **Step 2: Write failing storage tests**

Use an in-memory `Storage` stub and assert:

- valid tasks round-trip;
- malformed JSON returns `[]`;
- one invalid task does not remove valid tasks;
- deleting a task preserves other tasks.

- [ ] **Step 3: Run and verify failures**

Run:

```bash
npm test -- src/features/tasks/task.test.ts src/features/tasks/storage.test.ts
```

Expected: FAIL because task and storage modules do not exist.

- [ ] **Step 4: Implement the task domain**

In `src/features/tasks/task.ts`, define `storedTaskSchema` from the generated plan shape plus:

```ts
{
  id: string;
  taskDescription: string;
  deadline: string;
  hoursPerDay: number;
  createdAt: string;
  updatedAt: string;
}
```

Implement:

```ts
export function calculateProgress(task: StoredTask): number;
export function toggleStep(task: StoredTask, stepId: string): StoredTask;
export function createStoredTask(input: PlanRequest, plan: Plan): StoredTask;
```

`calculateProgress` returns the rounded percentage of completed steps. `toggleStep` performs immutable nested updates and refreshes `updatedAt`.

- [ ] **Step 5: Implement guarded storage**

In `src/features/tasks/storage.ts`, use key `deadline-ai.tasks.v1` and expose:

```ts
export function loadTasks(storage: Storage): StoredTask[];
export function saveTasks(storage: Storage, tasks: StoredTask[]): void;
export function upsertTask(storage: Storage, task: StoredTask): StoredTask[];
export function removeTask(storage: Storage, taskId: string): StoredTask[];
```

Parse the top-level value defensively, validate each entry independently with `storedTaskSchema.safeParse`, and preserve valid entries.

- [ ] **Step 6: Implement the client hook**

`src/features/tasks/use-tasks.ts` must start with `"use client"` and expose:

```ts
{
  tasks,
  hydrated,
  addTask,
  updateTask,
  deleteTask,
  getTask
}
```

Only access `window.localStorage` inside effects or event handlers.

- [ ] **Step 7: Run tests**

Run:

```bash
npm test -- src/features/tasks
```

Expected: all task and storage tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/tasks
git commit -m "feat: add local task persistence and progress"
```

## Task 6: Build the Energetic Editorial Design System

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `src/components/app-header.tsx`
- Create: `src/components/error-message.tsx`
- Create: `src/components/app-header.test.tsx`

- [ ] **Step 1: Write a failing accessible header test**

Create `src/components/app-header.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { AppHeader } from "./app-header";

it("shows the product identity and new-task action", () => {
  render(<AppHeader />);
  expect(screen.getByText("Deadline AI")).toBeVisible();
  expect(screen.getByRole("link", { name: /new task/i })).toHaveAttribute(
    "href",
    "/tasks/new",
  );
});
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm test -- src/components/app-header.test.tsx
```

Expected: FAIL because `AppHeader` does not exist.

- [ ] **Step 3: Define global tokens**

In `app/globals.css`, define CSS variables:

```css
:root {
  --canvas: #fff6e6;
  --surface: #fffdf7;
  --ink: #211f1b;
  --muted: #6f685e;
  --coral: #ff7350;
  --gold: #ffd764;
  --indigo: #6468e8;
  --danger: #c94432;
  --border: 2px solid var(--ink);
  --radius-sm: 10px;
  --radius-md: 16px;
  --shadow-hard: 4px 4px 0 var(--ink);
  --shadow-soft: 0 14px 36px rgb(57 43 20 / 10%);
  --content-width: 1120px;
}
```

Add a box-sizing reset, accessible focus styles, responsive typography, body colors, and reusable `.button`, `.buttonPrimary`, `.card`, `.eyebrow`, and `.pageShell` classes. At widths below `720px`, reduce hard shadows and collapse multi-column grids.

- [ ] **Step 4: Implement the root layout and components**

Set metadata in `app/layout.tsx`:

```ts
export const metadata = {
  title: "Deadline AI",
  description: "Turn pressure into a plan.",
};
```

Implement `AppHeader` with a home link, tagline, and `+ New task` link. Implement `ErrorMessage` with `role="alert"` and an optional retry action.

- [ ] **Step 5: Run checks**

Run:

```bash
npm test -- src/components/app-header.test.tsx
npm run lint
```

Expected: test and lint PASS.

- [ ] **Step 6: Commit**

```bash
git add app src/components
git commit -m "feat: add Deadline AI visual foundation"
```

## Task 7: Build the Dashboard

**Files:**
- Modify: `app/page.tsx`
- Create: `src/components/task-card.tsx`
- Create: `src/components/empty-state.tsx`
- Create: `src/components/dashboard.tsx`
- Create: `src/components/dashboard.test.tsx`

- [ ] **Step 1: Write failing dashboard tests**

Test:

```tsx
expect(screen.getByText("Turn pressure into a plan.")).toBeVisible();
expect(screen.getByRole("link", { name: /create your first plan/i })).toBeVisible();
```

With one injected stored task, assert its title, formatted deadline, `50%`, and `AT RISK` are visible. Click Delete and assert the provided delete callback receives the task ID.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm test -- src/components/dashboard.test.tsx
```

Expected: FAIL because dashboard components do not exist.

- [ ] **Step 3: Implement dashboard components**

`Dashboard` receives tasks and callbacks as props for testability. `TaskCard` links to `/tasks/{id}` and renders:

- title;
- deadline and remaining-day label;
- feasibility badge;
- native progress element plus visible percentage;
- delete button with an explicit accessible name.

`EmptyState` explains that tasks are saved only in this browser and links to `/tasks/new`.

- [ ] **Step 4: Connect `app/page.tsx`**

Use a small client `DashboardPage` wrapper or make `Dashboard` own `useTasks`. Show a neutral skeleton until `hydrated` is true to avoid server/client storage mismatch.

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm test -- src/components/dashboard.test.tsx
npm run build
```

Expected: tests and build PASS.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx src/components
git commit -m "feat: add local task dashboard"
```

## Task 8: Build Task Creation and Stop Generation

**Files:**
- Create: `app/tasks/new/page.tsx`
- Create: `src/components/task-form.tsx`
- Create: `src/components/task-form.test.tsx`

- [ ] **Step 1: Write failing form validation tests**

Assert:

- blank task displays `Describe what you need to finish.`;
- a past deadline displays `Choose today or a future date.`;
- zero or over-24 hours displays `Enter a value between 0 and 24 hours.`;
- no request is sent for invalid input.

- [ ] **Step 2: Write failing generation lifecycle tests**

Mock `fetch` with a deferred promise. Submit valid data and assert:

```tsx
expect(screen.getByRole("button", { name: /stop generation/i })).toBeVisible();
expect(screen.getByLabelText(/task description/i)).toBeDisabled();
```

Click Stop and assert the captured request signal is aborted, fields retain their values, and `Generate plan` returns.

Add a supersession test: resolve a canceled first request after a successful second request and assert only the second task is saved and navigated to.

- [ ] **Step 3: Run and verify failures**

Run:

```bash
npm test -- src/components/task-form.test.tsx
```

Expected: FAIL because `TaskForm` does not exist.

- [ ] **Step 4: Implement `TaskForm`**

Use controlled fields and refs:

```ts
const activeRequest = useRef<{ id: number; controller: AbortController }>();
const requestSequence = useRef(0);
```

On submit:

1. validate and normalize local date/timezone;
2. increment the request ID;
3. create an `AbortController`;
4. `POST /api/plans`;
5. before saving, verify the response ID is still active;
6. create and persist the stored task;
7. navigate to `/tasks/{taskId}`.

On Stop:

```ts
activeRequest.current?.controller.abort();
activeRequest.current = undefined;
setStatus("idle");
```

Do not clear inputs. Treat `AbortError` as a user cancellation, not an error. Render a square Stop button containing a visible square icon and accessible name `Stop generation`.

- [ ] **Step 5: Implement the page**

`app/tasks/new/page.tsx` renders the app header, a concise explanation, and `TaskForm`.

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- src/components/task-form.test.tsx
npm run lint
```

Expected: tests and lint PASS.

- [ ] **Step 7: Commit**

```bash
git add app/tasks/new src/components/task-form.tsx src/components/task-form.test.tsx
git commit -m "feat: add task generation form and stop control"
```

## Task 9: Build Plan Detail, Completion, Delete, and Regeneration

**Files:**
- Create: `app/tasks/[taskId]/page.tsx`
- Create: `src/components/plan-detail.tsx`
- Create: `src/components/plan-header.tsx`
- Create: `src/components/risk-panel.tsx`
- Create: `src/components/day-plan.tsx`
- Create: `src/components/plan-detail.test.tsx`

- [ ] **Step 1: Write failing plan-detail tests**

With an injected stored task, assert:

- title, summary, deadline, capacity, risk explanation, and scope recommendation render;
- daily groups appear in ascending date order;
- checking a step calls `onUpdate` with the step completed and updated progress;
- deleting requires confirmation and calls `onDelete`;
- regenerate calls the generation callback with original task inputs;
- missing task renders a recovery link to the dashboard.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm test -- src/components/plan-detail.test.tsx
```

Expected: FAIL because plan detail components do not exist.

- [ ] **Step 3: Implement presentation components**

`PlanHeader` renders semantic progress and feasibility. `RiskPanel` always shows a concise planning assessment and uses distinct labels, not color alone. `DayPlan` renders a `<fieldset>` containing checkboxes with labels and estimated times.

- [ ] **Step 4: Implement stateful plan detail**

`PlanDetail` receives the task plus update/delete/regenerate callbacks. Toggle steps through `toggleStep`; never mutate props. Regeneration uses the same request lifecycle rules as `TaskForm` and replaces the plan only after a valid success. Preserve the current plan on failure or cancellation.

- [ ] **Step 5: Connect the dynamic page**

Because tasks are browser-local, `app/tasks/[taskId]/page.tsx` passes the URL parameter to a client component that waits for storage hydration, looks up the task, and renders a not-found recovery state when absent.

- [ ] **Step 6: Run tests and build**

Run:

```bash
npm test -- src/components/plan-detail.test.tsx
npm run build
```

Expected: tests and build PASS.

- [ ] **Step 7: Commit**

```bash
git add app/tasks src/components src/features/tasks
git commit -m "feat: add plan tracking and regeneration"
```

## Task 10: Add End-to-End Coverage

**Files:**
- Create: `e2e/deadline-ai.spec.ts`
- Create: `e2e/fixtures/plan.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Write the critical happy-path browser test**

Intercept `**/api/plans` and return a valid fixture. Test:

1. dashboard starts empty;
2. user opens New task;
3. user enters task, deadline, and hours;
4. plan generates and detail page opens;
5. user checks a step and progress changes;
6. page reload preserves the checked step;
7. dashboard shows the saved task;
8. user deletes the task.

- [ ] **Step 2: Write cancellation and error tests**

For cancellation, hold the route response, click Stop generation, then verify inputs remain and the user can submit again. For error handling, return `502` and verify the actionable error and retry control.

- [ ] **Step 3: Install Playwright browser**

Run:

```bash
npx playwright install chromium
```

Expected: Chromium test browser installs successfully.

- [ ] **Step 4: Run E2E tests**

Run:

```bash
npm run test:e2e -- --project=chromium
```

Expected: happy path, cancellation, and error tests PASS.

- [ ] **Step 5: Run mobile project**

Run:

```bash
npm run test:e2e -- --project=mobile
```

Expected: critical flow remains usable at the configured mobile viewport.

- [ ] **Step 6: Commit**

```bash
git add e2e playwright.config.ts
git commit -m "test: cover Deadline AI user journeys"
```

## Task 11: Integrate the Real API and Harden Production Behavior

**Files:**
- Modify: `src/features/plans/openrouter.ts`
- Modify: `src/features/plans/service.ts`
- Modify: `app/api/plans/route.ts`
- Modify: `.env.example`
- Create: `src/features/plans/live-contract.test.ts`

- [ ] **Step 1: Obtain the OpenRouter API key from the user**

Do not commit or print the key. Put it in `.env.local`:

```dotenv
OPENROUTER_API_KEY=<user-provided-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Verify `.env.local` is ignored:

```bash
git check-ignore .env.local
```

Expected: `.env.local` is printed as ignored.

- [ ] **Step 2: Verify model capability before relying on strict schema**

Use the OpenRouter models endpoint or model page to verify that `deepseek/deepseek-v4-pro` currently supports `response_format`. If strict `json_schema` is not supported by its active provider, switch the request to:

```ts
response_format: { type: "json_object" },
plugins: [{ id: "response-healing" }],
```

Keep server-side Zod validation in both cases. Record the selected mode in a code comment beside `response_format`.

- [ ] **Step 3: Add an opt-in live contract test**

Create `src/features/plans/live-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generatePlan } from "./service";

const runLive = process.env.RUN_LIVE_OPENROUTER_TEST === "1";

describe.skipIf(!runLive)("OpenRouter live contract", () => {
  it("returns a capacity-safe plan", async () => {
    const plan = await generatePlan(
      {
        taskDescription: "Prepare a five-slide product pitch",
        currentDate: "2026-06-22",
        deadline: "2026-06-24",
        hoursPerDay: 1,
        timeZone: "America/Los_Angeles",
      },
      { apiKey: process.env.OPENROUTER_API_KEY! },
    );
    expect(plan.days.length).toBeGreaterThan(0);
    expect(plan.days.every((day) => day.totalMinutes <= 60)).toBe(true);
  });
});
```

- [ ] **Step 4: Run the live test once**

Run:

```bash
RUN_LIVE_OPENROUTER_TEST=1 npm test -- src/features/plans/live-contract.test.ts
```

Expected: PASS with a valid, capacity-safe English plan. This call may incur API charges.

- [ ] **Step 5: Test upstream failure without exposing details**

Temporarily use an invalid local key and call the API. Expected: the browser receives a stable `UPSTREAM_ERROR` message without provider metadata, request headers, or the key.

- [ ] **Step 6: Commit code-only hardening**

```bash
git add src/features/plans app/api/plans .env.example
git commit -m "fix: harden production plan generation"
```

Confirm `.env.local` is not staged:

```bash
git status --short
```

## Task 12: Documentation, Full Verification, and Vercel Deployment

**Files:**
- Modify: `README.md`
- Modify: `app/layout.tsx`
- Create: `public/og-image.png` or generate equivalent metadata asset

- [ ] **Step 1: Document local development**

Update `README.md` with:

- product purpose and MVP limitations;
- prerequisites;
- `npm install`;
- copying `.env.example` to `.env.local`;
- `npm run dev`;
- unit, E2E, lint, and build commands;
- localStorage privacy/data-loss note;
- OpenRouter model and server-only key handling.

- [ ] **Step 2: Add competition-ready metadata**

Set title, description, Open Graph metadata, and a simple branded social image. Ensure no API key or private URL is embedded.

- [ ] **Step 3: Run the complete verification suite**

Run:

```bash
npm run lint
npm test
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=mobile
npm run build
```

Expected: every command exits `0`.

- [ ] **Step 4: Inspect the production bundle for the key**

Run:

```bash
rg -n "$OPENROUTER_API_KEY" .next
```

Expected: no matches. Do not paste command output containing the key into chat or logs.

- [ ] **Step 5: Create the Vercel project**

Import the Git repository in Vercel or run:

```bash
npx vercel
```

Set `OPENROUTER_API_KEY` as a Vercel environment variable for Preview and Production. Set `NEXT_PUBLIC_APP_URL` to the final public origin.

- [ ] **Step 6: Deploy production**

Run:

```bash
npx vercel --prod
```

Expected: Vercel returns a public HTTPS URL.

- [ ] **Step 7: Perform production smoke tests**

At the public URL verify:

- create and stop generation;
- successful real plan generation;
- risk and scope advice;
- check/uncheck persistence after reload;
- multiple tasks;
- delete and regenerate;
- desktop and mobile layouts;
- no API key in browser source or network responses.

- [ ] **Step 8: Commit documentation**

```bash
git add README.md app/layout.tsx public
git commit -m "docs: add setup and deployment guide"
```

## Suggested Five-Day Schedule

- **Day 1:** Tasks 1–4 — scaffold, schemas, prompt, OpenRouter boundary, API route.
- **Day 2:** Tasks 5–7 — persistence, design foundation, dashboard.
- **Day 3:** Tasks 8–9 — generation lifecycle, Stop control, plan detail and progress.
- **Day 4:** Tasks 10–11 — E2E coverage, real API integration, hardening.
- **Day 5:** Task 12 — polish, full verification, Vercel deployment, competition rehearsal.

## Official References

- OpenRouter API reference: <https://openrouter.ai/docs/api/reference/overview>
- OpenRouter structured outputs: <https://openrouter.ai/docs/guides/features/structured-outputs>
- OpenRouter reasoning: <https://openrouter.ai/docs/guides/best-practices/reasoning-tokens>
- Next.js route handlers: <https://nextjs.org/docs/app/getting-started/route-handlers>
- Next.js Vitest guide: <https://nextjs.org/docs/app/guides/testing/vitest>
- Vercel environment variables: <https://vercel.com/docs/environment-variables>
