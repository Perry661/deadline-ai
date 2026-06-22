# Deadline AI MVP Design

## 1. Product Summary

Deadline AI is an English-language web application that turns a task, its deadline, and the user's available hours per day into a concrete daily execution plan.

The MVP is intended for a public competition demo and must be feasible to build in approximately five days. Its primary value is not generic task decomposition: it must evaluate whether the work fits the available time, schedule actionable steps by date, and clearly warn the user when the deadline is at risk.

Product name: **Deadline AI**

Tagline: **Turn pressure into a plan.**

## 2. Goals

- Generate a complete plan from one submission.
- Allocate work to specific dates without exceeding the user's stated daily capacity.
- Make every plan step concrete, time-bounded, and checkable.
- Show feasibility and scope-reduction advice when time is insufficient.
- Let users track progress across multiple tasks.
- Provide a polished public demo without requiring an account.
- Keep the OpenRouter API key secret.

## 3. Non-Goals for the MVP

- User accounts or cloud synchronization
- Chinese localization or language switching
- Multi-turn AI chat
- Calendar integrations and notifications
- Manual editing, reordering, adding, or deleting generated steps
- Drag-and-drop task management
- A settings page or runtime theme switcher
- Streaming partial plan content

These capabilities may be considered after the competition version is complete.

## 4. Target User Flow

### 4.1 Dashboard

The dashboard lists all locally saved tasks. Each card shows:

- Task title or summary
- Deadline
- Remaining days
- Overall completion percentage
- Feasibility status

Users can open a task, delete it, or start a new task.

### 4.2 Create a Task

The creation form has three required inputs:

- Task description
- Deadline
- Available hours per day

Submitting the form starts plan generation. While generation is active, the primary submit control changes into a square **Stop generation** button similar to the stop control in AI chat products.

Stopping generation:

- Aborts the browser request immediately.
- Preserves all form input.
- Restores the **Generate plan** action.
- Allows the user to modify the form or submit again.
- Prevents a late response from being saved or displayed.

The UI will describe this as stopping or canceling, not pausing, because generation cannot resume from the same point. Aborting the browser request may not prevent OpenRouter from completing or charging for an upstream request that has already started.

### 4.3 Plan Detail

The plan detail view shows:

- Task summary
- Deadline and daily capacity
- Feasibility status
- Risk explanation
- Scope recommendation
- Overall progress
- Daily groups with total scheduled time
- Checkable plan steps with estimated durations

Checking or unchecking a step updates overall progress immediately and persists it locally.

Users may regenerate the plan from the original task inputs. Regeneration replaces the generated plan only after a new valid result is received.

## 5. AI Planning Behavior

The server sends the task description, deadline, current date, timezone context, and daily available hours to the model.

The model must:

1. Calculate the total time capacity available before the deadline.
2. Break the task into concrete steps, normally between 15 and 120 minutes each.
3. Assign every step to a specific date.
4. Keep each day's total estimated time within the user's stated capacity.
5. Reserve part of the final day for review, correction, submission, or contingency when the task permits.
6. Classify feasibility as `on_track`, `at_risk`, or `unrealistic`.
7. Produce a plan even when the deadline is unrealistic.
8. For risky or unrealistic work, identify the most important deliverable and recommend explicit scope reductions.
9. Write all user-facing output in English.

The AI does not generate completion state. The application adds and owns that state.

## 6. Structured AI Contract

The OpenRouter response must be converted into and validated against a strict JSON schema containing:

- `title`: concise task title
- `summary`: short interpretation of the requested outcome
- `feasibility`: `on_track`, `at_risk`, or `unrealistic`
- `riskExplanation`: why the task received that classification
- `scopeRecommendation`: concrete scope advice, or a short confirmation that no reduction is required
- `totalEstimatedMinutes`: total estimated effort
- `days`: ordered list of daily plan groups
  - `date`: ISO calendar date
  - `dailyFocus`: short description of that day's objective
  - `totalMinutes`: sum of the day's step estimates
  - `steps`: ordered list of steps
    - `title`: concrete action
    - `estimatedMinutes`: positive integer

The server assigns a stable unique ID to each validated step before returning the plan to the browser.

Server validation must reject:

- Missing required fields
- Unknown feasibility values
- Invalid dates
- Empty daily groups or steps
- Non-positive durations
- A daily total that exceeds the user's capacity
- A daily total that does not equal the sum of its steps
- Plans scheduled after the deadline

If model output is invalid, the API returns a controlled generation error rather than passing malformed content to the UI.

## 7. Architecture

The MVP uses a single Next.js full-stack application deployed on Vercel.

### Browser

- Renders the dashboard, task form, and plan detail view.
- Stores tasks and completion state in `localStorage`.
- Sends task inputs to a server API route.
- Uses an `AbortController` to implement **Stop generation**.

### Next.js Server Route

- Validates user input.
- Builds the planning prompt.
- Calls OpenRouter.
- Uses the `deepseek/deepseek-v4-pro` model with reasoning enabled.
- Validates the structured result.
- Returns only the validated plan to the browser.

### OpenRouter

- Receives the planning prompt from the server.
- Never receives requests directly from browser code.

The OpenRouter API key is stored only in a Vercel environment variable and is never included in the client bundle.

The MVP does not require a database.

## 8. Local Data Model

Each locally stored task contains:

- Unique task ID
- Original task description
- Creation timestamp
- Deadline
- Available hours per day
- Validated AI plan
- Completion state for every generated step
- Last-updated timestamp

Overall progress is derived from completed steps divided by total steps rather than stored as an independent source of truth.

Data is scoped to the current browser. Clearing browser storage removes all saved tasks. The UI should make this limitation understandable without adding onboarding friction.

## 9. Error Handling and Reliability

### Input Validation

- Deadline cannot be earlier than the user's current date.
- Task description cannot be blank.
- Available hours must be greater than zero and no more than 24 hours per day.

### Request Failures

- Preserve form input after failures.
- Show a concise, actionable English error.
- Allow immediate retry.
- Disable conflicting controls while generation is active.
- Ignore responses belonging to canceled or superseded requests.

### Invalid AI Output

- Parse and validate on the server.
- Do not store or display partial or invalid plans.
- Return a controlled error that invites the user to generate again.

### Local Storage Failures

- Guard all parsing and writing operations.
- Ignore malformed records instead of preventing the application from loading.
- Keep valid records when one stored record is corrupt.

## 10. Visual Design

The MVP uses the previously selected **Energetic Editorial** direction:

- Warm, unified color palette
- Warm off-white page background
- Coral primary actions
- Golden highlight panels
- Dark text and outlines
- Bold borders
- Selective hard shadows
- Strong, friendly headlines
- Clear card-based information hierarchy

The interface should remain readable and controlled rather than becoming visually noisy. Color, spacing, border, radius, and shadow values will be defined through CSS variables so a calmer indigo theme can be added later. The MVP will not expose theme switching.

The design must work on desktop and mobile widths. The public competition demo should prioritize a polished desktop presentation while retaining functional responsive behavior.

## 11. Testing Strategy

### Unit Tests

- Input validation
- AI response schema validation
- Daily capacity and date constraints
- Progress calculation
- Local storage parsing and migration boundary

### Integration Tests

- Successful plan generation through the API route with a mocked OpenRouter response
- Controlled handling of upstream failure and malformed model output
- Request cancellation and suppression of late results

### UI Tests

- Create a task and render its generated plan
- Check and uncheck steps and verify progress
- Reload and restore locally saved tasks
- Delete a task
- Regenerate a plan

### Manual Deployment Checks

- API key is absent from browser assets and network responses.
- The production Vercel URL can generate, save, reload, and complete a task.
- Mobile layout remains usable.
- Error and cancellation states are understandable.

## 12. Delivery Scope

The first release is complete when:

- A public Vercel URL is available.
- A user can create multiple tasks.
- Each task produces a validated date-based plan using OpenRouter.
- Risk and scope advice are visible.
- Steps can be checked off and progress persists across reloads.
- Generation can be stopped without losing form input or accepting a late result.
- The OpenRouter key remains server-side.
- Core automated tests pass.
