"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { PlanRequest } from "../features/plans/schema";
import {
  type Plan,
  type StoredTask,
  toggleStep,
} from "../features/tasks/task";
import { useTasks } from "../features/tasks/use-tasks";
import { DayPlan } from "./day-plan";
import { ErrorMessage } from "./error-message";
import { PlanHeader } from "./plan-header";
import { RiskPanel } from "./risk-panel";

type PlanResponse = {
  plan?: Plan;
  message?: string;
};

type Status = "idle" | "regenerating";

type PlanDetailProps = {
  task?: StoredTask;
  onUpdate: (task: StoredTask) => void;
  onDelete: (taskId: string) => void;
  onRegenerate?: (input: PlanRequest) => Promise<Plan>;
};

type PlanDetailPageProps = {
  taskId: string;
};

const GENERIC_REGENERATION_ERROR = "Unable to regenerate the plan.";

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException
      ? error.name === "AbortError"
      : error instanceof Error && error.name === "AbortError"
  );
}

async function parsePlanResponse(response: Response): Promise<PlanResponse> {
  try {
    return (await response.json()) as PlanResponse;
  } catch {
    return {};
  }
}

async function requestRegeneratedPlan(
  input: PlanRequest,
  signal: AbortSignal,
): Promise<Plan> {
  const response = await fetch("/api/plans", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    signal,
  });
  const result = await parsePlanResponse(response);

  if (!response.ok || !result.plan) {
    throw new Error(result.message || GENERIC_REGENERATION_ERROR);
  }

  return result.plan;
}

function createPlanRequest(task: StoredTask): PlanRequest {
  return {
    taskDescription: task.taskDescription,
    deadline: task.deadline,
    hoursPerDay: task.hoursPerDay,
    currentDate: formatLocalDate(new Date()),
    timeZone: getTimeZone(),
  };
}

function MissingPlanState() {
  return (
    <section className="card recoveryState" aria-labelledby="missing-plan-title">
      <p className="eyebrow">Missing plan</p>
      <h1 id="missing-plan-title">Plan not found</h1>
      <p className="intro">
        This plan may have been deleted or saved in a different browser.
      </p>
      <Link className="button buttonPrimary" href="/">
        Return to dashboard
      </Link>
    </section>
  );
}

function PlanDetailSkeleton() {
  return (
    <section className="card" aria-label="Loading plan">
      <p className="eyebrow">Loading</p>
      <h1>Loading your plan…</h1>
      <p className="intro">Checking this browser for the saved task.</p>
    </section>
  );
}

export function PlanDetail({
  task,
  onUpdate,
  onDelete,
  onRegenerate,
}: PlanDetailProps) {
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] =
    useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [regenerationError, setRegenerationError] = useState<string>();
  const activeRequest = useRef<
    { id: number; controller: AbortController } | undefined
  >(undefined);
  const requestSequence = useRef(0);

  if (!task) {
    return <MissingPlanState />;
  }

  const currentTask = task;
  const isRegenerating = status === "regenerating";
  const sortedDays = [...currentTask.plan.days].sort((firstDay, secondDay) =>
    firstDay.date.localeCompare(secondDay.date),
  );

  function isActiveRequest(requestId: number): boolean {
    return activeRequest.current?.id === requestId;
  }

  function handleToggleStep(stepId: string) {
    onUpdate(toggleStep(currentTask, stepId));
  }

  function handleDelete() {
    if (!deleteConfirmationVisible) {
      setDeleteConfirmationVisible(true);
      return;
    }

    onDelete(currentTask.id);
  }

  async function handleRegenerate() {
    const input = createPlanRequest(currentTask);
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    const controller = new AbortController();

    activeRequest.current?.controller.abort();
    activeRequest.current = { id: requestId, controller };
    setStatus("regenerating");
    setRegenerationError(undefined);

    try {
      const plan = onRegenerate
        ? await onRegenerate(input)
        : await requestRegeneratedPlan(input, controller.signal);

      if (!isActiveRequest(requestId)) {
        return;
      }

      activeRequest.current = undefined;
      setStatus("idle");
      onUpdate({
        ...currentTask,
        updatedAt: new Date().toISOString(),
        plan,
      });
    } catch (error) {
      if (!isActiveRequest(requestId)) {
        return;
      }

      activeRequest.current = undefined;
      setStatus("idle");

      if (isAbortError(error)) {
        return;
      }

      setRegenerationError(GENERIC_REGENERATION_ERROR);
    }
  }

  function handleStopRegeneration() {
    activeRequest.current?.controller.abort();
    activeRequest.current = undefined;
    setStatus("idle");
  }

  return (
    <article className="planDetail">
      <PlanHeader task={currentTask} />

      <div className="planDetailActions">
        {isRegenerating ? (
          <button
            aria-label="Stop regeneration"
            className="button stopButton"
            onClick={handleStopRegeneration}
            type="button"
          >
            <span aria-hidden="true" className="stopIcon" />
          </button>
        ) : (
          <button
            className="button buttonPrimary"
            onClick={handleRegenerate}
            type="button"
          >
            Regenerate plan
          </button>
        )}
        <button className="button" onClick={handleDelete} type="button">
          {deleteConfirmationVisible ? "Confirm delete" : "Delete plan"}
        </button>
      </div>

      {deleteConfirmationVisible ? (
        <p className="confirmationText">
          This cannot be undone. Click confirm to delete.
        </p>
      ) : null}

      {regenerationError ? (
        <ErrorMessage
          message={regenerationError}
          title="Regeneration failed"
        />
      ) : null}

      <div className="planDetailGrid">
        <RiskPanel plan={currentTask.plan} />
        <section aria-labelledby="daily-plan-title" className="dailyPlanList">
          <div className="sectionHeading">
            <p className="eyebrow">Daily plan</p>
            <h2 id="daily-plan-title">Work by day</h2>
          </div>
          {sortedDays.map((day) => (
            <DayPlan
              day={day}
              key={day.date}
              onToggleStep={handleToggleStep}
            />
          ))}
        </section>
      </div>
    </article>
  );
}

export function PlanDetailPage({ taskId }: PlanDetailPageProps) {
  const router = useRouter();
  const { hydrated, getTask, updateTask, deleteTask } = useTasks();

  if (!hydrated) {
    return <PlanDetailSkeleton />;
  }

  function handleDelete(taskIdToDelete: string) {
    deleteTask(taskIdToDelete);
    router.push("/");
  }

  return (
    <PlanDetail
      task={getTask(taskId)}
      onUpdate={updateTask}
      onDelete={handleDelete}
    />
  );
}
