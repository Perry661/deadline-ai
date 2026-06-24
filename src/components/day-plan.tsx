import type { StoredTask } from "../features/tasks/task";

type PlanDay = StoredTask["plan"]["days"][number];

type DayPlanProps = {
  day: PlanDay;
  onToggleStep: (stepId: string) => void;
};

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDay(date: string): string {
  return dayFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }

  const hours = minutes / 60;

  return `${hours.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} ${hours === 1 ? "hour" : "hours"}`;
}

export function DayPlan({ day, onToggleStep }: DayPlanProps) {
  return (
    <fieldset className="dayPlan card">
      <legend>
        <span>{formatDay(day.date)}</span>
        <span className="dayPlanMeta">
          {day.dailyFocus} · {formatMinutes(day.totalMinutes)}
        </span>
      </legend>

      <div className="stepList">
        {day.steps.map((step) => {
          const label = `${step.title}, ${formatMinutes(step.estimatedMinutes)}`;

          return (
            <label className="stepItem" key={step.id}>
              <input
                checked={step.completed}
                onChange={() => onToggleStep(step.id)}
                type="checkbox"
              />
              <span className={step.completed ? "stepItemTextCompleted" : ""}>
                {label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
