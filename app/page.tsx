"use client";

import { Dashboard } from "../src/components/dashboard";
import { useTasks } from "../src/features/tasks/use-tasks";

function DashboardSkeleton() {
  return (
    <section className="card" aria-label="Loading dashboard">
      <p className="eyebrow">Loading</p>
      <h1>Loading your plans…</h1>
      <p className="intro">Checking this browser for saved tasks.</p>
    </section>
  );
}

export default function Home() {
  const { tasks, hydrated, deleteTask } = useTasks();

  return (
    <main>
      {hydrated ? (
        <Dashboard tasks={tasks} onDeleteTask={deleteTask} />
      ) : (
        <DashboardSkeleton />
      )}
    </main>
  );
}
