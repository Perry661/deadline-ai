import Link from "next/link";

import {
  calculateProgress,
  type StoredTask,
} from "../features/tasks/task";

type TaskCardProps = {
  isSelected?: boolean;
  task: StoredTask;
  onDeleteTask: (taskId: string) => void;
  onSelectionChange?: (taskId: string, selected: boolean) => void;
};

const deadlineFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDeadline(deadline: string): string {
  return deadlineFormatter.format(new Date(`${deadline}T00:00:00.000Z`));
}

export function formatRemainingDays(
  deadline: string,
  today = new Date(),
): string {
  const startOfToday = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const deadlineDate = new Date(`${deadline}T00:00:00.000Z`);
  const remainingDays = Math.ceil(
    (deadlineDate.getTime() - startOfToday) / 86_400_000,
  );

  if (remainingDays < 0) {
    return "Past deadline";
  }

  if (remainingDays === 0) {
    return "Due today";
  }

  if (remainingDays === 1) {
    return "1 day remaining";
  }

  return `${remainingDays} days remaining`;
}

function formatFeasibility(feasibility: StoredTask["plan"]["feasibility"]) {
  return feasibility.replaceAll("_", " ").toUpperCase();
}

export function TaskCard({
  isSelected = false,
  task,
  onDeleteTask,
  onSelectionChange,
}: TaskCardProps) {
  const title = task.plan.title;
  const progress = calculateProgress(task);

  return (
    <article className="card taskCard" aria-labelledby={`${task.id}-title`}>
      <label className="taskCardSelect">
        <input
          aria-label={`Select ${title}`}
          checked={isSelected}
          onChange={(event) =>
            onSelectionChange?.(task.id, event.currentTarget.checked)
          }
          type="checkbox"
        />
        <span>Select</span>
      </label>

      <div>
        <p className="eyebrow">{formatFeasibility(task.plan.feasibility)}</p>
        <h2 className="taskCardTitle" id={`${task.id}-title`}>
          <Link href={`/tasks/${task.id}`}>{title}</Link>
        </h2>
      </div>

      <p className="taskCardMeta">
        <span>Deadline: </span>
        <span>{formatDeadline(task.deadline)}</span>
        <span aria-hidden="true"> · </span>
        <span>{formatRemainingDays(task.deadline)}</span>
      </p>

      <div className="taskCardProgress">
        <progress
          aria-label={`Progress for ${title}`}
          max={100}
          value={progress}
        />
        <span>{progress}%</span>
      </div>

      <button
        className="button"
        type="button"
        aria-label={`Delete ${title}`}
        onClick={() => onDeleteTask(task.id)}
      >
        Delete
      </button>
    </article>
  );
}
