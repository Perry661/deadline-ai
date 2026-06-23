"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { PlanRequest } from "../features/plans/schema";
import type { Plan } from "../features/tasks/task";
import { useTasks } from "../features/tasks/use-tasks";
import { ErrorMessage } from "./error-message";

type FormErrors = {
  taskDescription?: string;
  deadline?: string;
  hoursPerDay?: string;
};

type Status = "idle" | "generating";

type PlanResponse = {
  plan?: Plan;
  message?: string;
};

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function validateForm(
  taskDescription: string,
  deadline: string,
  hoursPerDay: string,
  currentDate: string,
): { errors: FormErrors; input?: PlanRequest } {
  const errors: FormErrors = {};
  const normalizedDescription = taskDescription.trim();
  const normalizedDeadline = deadline.trim();
  const normalizedHours = Number(hoursPerDay);

  if (!normalizedDescription) {
    errors.taskDescription = "Describe what you need to finish.";
  }

  if (!normalizedDeadline || normalizedDeadline < currentDate) {
    errors.deadline = "Choose today or a future date.";
  }

  if (
    !Number.isFinite(normalizedHours) ||
    normalizedHours <= 0 ||
    normalizedHours > 24
  ) {
    errors.hoursPerDay = "Enter a value between 0 and 24 hours.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    errors,
    input: {
      taskDescription: normalizedDescription,
      deadline: normalizedDeadline,
      hoursPerDay: normalizedHours,
      currentDate,
      timeZone: getTimeZone(),
    },
  };
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException
      ? error.name === "AbortError"
      : error instanceof Error && error.name === "AbortError"
  );
}

export function TaskForm() {
  const router = useRouter();
  const { addTask } = useTasks();
  const [taskDescription, setTaskDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [submitError, setSubmitError] = useState<string | undefined>();
  const activeRequest = useRef<
    { id: number; controller: AbortController } | undefined
  >(undefined);
  const requestSequence = useRef(0);

  const isGenerating = status === "generating";

  function isActiveRequest(requestId: number): boolean {
    return activeRequest.current?.id === requestId;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const currentDate = formatLocalDate(new Date());
    const validation = validateForm(
      taskDescription,
      deadline,
      hoursPerDay,
      currentDate,
    );

    setErrors(validation.errors);
    setSubmitError(undefined);

    if (!validation.input) {
      return;
    }

    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    const controller = new AbortController();

    activeRequest.current = { id: requestId, controller };
    setStatus("generating");

    try {
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.input),
        signal: controller.signal,
      });

      if (!isActiveRequest(requestId)) {
        return;
      }

      const result = (await response.json()) as PlanResponse;

      if (!response.ok || !result.plan) {
        throw new Error(result.message || "Unable to generate a plan.");
      }

      if (!isActiveRequest(requestId)) {
        return;
      }

      const task = addTask(validation.input, result.plan);

      activeRequest.current = undefined;
      setStatus("idle");
      router.push(`/tasks/${task.id}`);
    } catch (error) {
      if (!isActiveRequest(requestId)) {
        return;
      }

      activeRequest.current = undefined;
      setStatus("idle");

      if (isAbortError(error)) {
        return;
      }

      setSubmitError(
        error instanceof Error ? error.message : "Unable to generate a plan.",
      );
    }
  }

  function handleStop() {
    activeRequest.current?.controller.abort();
    activeRequest.current = undefined;
    setStatus("idle");
  }

  return (
    <form className="taskForm card" onSubmit={handleSubmit}>
      <div className="fieldGroup">
        <label className="fieldLabel" htmlFor="task-description">
          Task description
        </label>
        <textarea
          aria-describedby={
            errors.taskDescription ? "task-description-error" : undefined
          }
          className="fieldControl textareaControl"
          disabled={isGenerating}
          id="task-description"
          name="taskDescription"
          onChange={(event) => setTaskDescription(event.target.value)}
          placeholder="Example: finish the launch checklist and investor update"
          rows={5}
          value={taskDescription}
        />
        {errors.taskDescription ? (
          <p className="fieldError" id="task-description-error">
            {errors.taskDescription}
          </p>
        ) : null}
      </div>

      <div className="taskFormGrid">
        <div className="fieldGroup">
          <label className="fieldLabel" htmlFor="deadline">
            Deadline
          </label>
          <input
            aria-describedby={errors.deadline ? "deadline-error" : undefined}
            className="fieldControl"
            disabled={isGenerating}
            id="deadline"
            name="deadline"
            onChange={(event) => setDeadline(event.target.value)}
            type="date"
            value={deadline}
          />
          {errors.deadline ? (
            <p className="fieldError" id="deadline-error">
              {errors.deadline}
            </p>
          ) : null}
        </div>

        <div className="fieldGroup">
          <label className="fieldLabel" htmlFor="hours-per-day">
            Hours per day
          </label>
          <input
            aria-describedby={
              errors.hoursPerDay ? "hours-per-day-error" : undefined
            }
            className="fieldControl"
            disabled={isGenerating}
            id="hours-per-day"
            inputMode="decimal"
            min="0"
            name="hoursPerDay"
            onChange={(event) => setHoursPerDay(event.target.value)}
            step="0.25"
            type="number"
            value={hoursPerDay}
          />
          {errors.hoursPerDay ? (
            <p className="fieldError" id="hours-per-day-error">
              {errors.hoursPerDay}
            </p>
          ) : null}
        </div>
      </div>

      {submitError ? (
        <ErrorMessage
          message={submitError}
          title="Plan generation failed"
        />
      ) : null}

      <div className="formActions">
        {isGenerating ? (
          <button
            aria-label="Stop generation"
            className="button stopButton"
            onClick={handleStop}
            type="button"
          >
            <span aria-hidden="true" className="stopIcon" />
          </button>
        ) : (
          <button className="button buttonPrimary" type="submit">
            Generate plan
          </button>
        )}
      </div>
    </form>
  );
}
