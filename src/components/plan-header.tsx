import { calculateProgress, type StoredTask } from "../features/tasks/task";

type PlanHeaderProps = {
  task: StoredTask;
};

const deadlineFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const feasibilityLabels: Record<StoredTask["plan"]["feasibility"], string> = {
  on_track: "On track",
  at_risk: "At risk",
  unrealistic: "Unrealistic",
};

function formatDeadline(deadline: string): string {
  return deadlineFormatter.format(new Date(`${deadline}T00:00:00.000Z`));
}

function formatHours(hoursPerDay: number): string {
  return `${hoursPerDay.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} ${hoursPerDay === 1 ? "hour" : "hours"}/day`;
}

export function PlanHeader({ task }: PlanHeaderProps) {
  const progress = calculateProgress(task);
  const title = task.plan.title;

  return (
    <header className="planHeader card">
      <p className="eyebrow">
        Feasibility: {feasibilityLabels[task.plan.feasibility]}
      </p>
      <h1>{title}</h1>
      <p className="intro">{task.plan.summary}</p>

      <dl className="planFacts">
        <div>
          <dt>Deadline:</dt>
          <dd>{formatDeadline(task.deadline)}</dd>
        </div>
        <div>
          <dt>Capacity:</dt>
          <dd>{formatHours(task.hoursPerDay)}</dd>
        </div>
      </dl>

      <div className="progressSummary">
        <progress
          aria-label={`Progress for ${title}`}
          max={100}
          value={progress}
        />
        <span>{progress}% complete</span>
      </div>
    </header>
  );
}
