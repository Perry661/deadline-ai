import type { StoredTask } from "../features/tasks/task";
import { EmptyState } from "./empty-state";
import { TaskCard } from "./task-card";

type DashboardProps = {
  tasks: StoredTask[];
  onDeleteTask: (taskId: string) => void;
};

export function Dashboard({ tasks, onDeleteTask }: DashboardProps) {
  if (tasks.length === 0) {
    return <EmptyState />;
  }

  return (
    <section aria-labelledby="dashboard-title">
      <div className="hero">
        <p className="eyebrow">Dashboard</p>
        <h1 id="dashboard-title">Your active plans</h1>
        <p className="intro">
          Track progress, watch deadline pressure, and keep each plan moving.
        </p>
      </div>

      <div className="cardGrid">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>
    </section>
  );
}
