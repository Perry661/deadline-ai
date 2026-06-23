# Deadline AI

Turn pressure into a plan.

Deadline AI turns a task, its deadline, and your available hours per day into a practical day-by-day execution plan. It is built as an English-first competition MVP: no account, no database, and no calendar integration — just task input, AI planning, local progress tracking, and a polished demo flow.

## What it does

- Generates a dated execution plan from a task, deadline, and daily available hours.
- Classifies feasibility as `on_track`, `at_risk`, or `unrealistic`.
- Shows risk explanation and scope-reduction advice.
- Keeps each planned day within the user's stated capacity.
- Lets users check off steps and persist progress locally.
- Supports stopping generation without losing form input.

## MVP limitations

- English only.
- Data is stored in this browser's `localStorage`.
- Clearing browser storage removes saved tasks.
- There are no user accounts, cloud sync, reminders, calendar integrations, or manual step editing.
- Stopping generation aborts the browser request, but an upstream OpenRouter request that already started may still complete and may still be billed by the provider.

## Tech stack

- Next.js App Router
- React
- TypeScript
- Zod
- Vitest
- React Testing Library
- Playwright
- OpenRouter Chat Completions
- Vercel

## Local development

Prerequisite: Node.js `>=22.13 <23`.

Install dependencies:

```bash
npm install
```

Create local environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
OPENROUTER_API_KEY=your_openrouter_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Name | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `OPENROUTER_API_KEY` | Yes | Server only | Authenticates server-side requests to OpenRouter. Never expose this in browser code. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public | Absolute app origin used for metadata and social previews. Use the final Vercel URL in production. |

The OpenRouter key is read only by the Next.js API route. Browser code calls `/api/plans`; it never calls OpenRouter directly.

## Testing

Run unit and integration tests:

```bash
npm test
```

Run lint:

```bash
npm run lint
```

Run TypeScript checks:

```bash
npx tsc --noEmit
```

Install the Playwright Chromium browser once:

```bash
npm run test:e2e:install
```

Run desktop E2E tests:

```bash
npm run test:e2e -- --project=chromium
```

Run mobile E2E tests:

```bash
npm run test:e2e -- --project=mobile
```

Build production assets:

```bash
npm run build
```

Optional live OpenRouter contract test:

```bash
RUN_LIVE_OPENROUTER_TEST=1 npm test -- src/features/plans/live-contract.test.ts
```

This calls the real OpenRouter API and may incur provider charges.

## Deployment on Vercel

1. Import the GitHub repository into Vercel.
2. Set environment variables for Preview and Production:
   - `OPENROUTER_API_KEY`
   - `NEXT_PUBLIC_APP_URL`
3. Deploy.
4. Smoke test the public URL:
   - generate a real plan;
   - stop generation and submit again;
   - verify risk and scope advice;
   - check and uncheck steps;
   - reload and confirm progress persists;
   - create multiple tasks;
   - delete and regenerate a task;
   - verify desktop and mobile layouts.

Before sharing the demo, confirm the OpenRouter key is not present in browser source, network responses, or the production bundle.
