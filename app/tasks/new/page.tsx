import { TaskForm } from "@/src/components/task-form";

export default function NewTaskPage() {
  return (
    <main className="pageShell newTaskPage">
      <section className="newTaskIntro">
        <p className="eyebrow">New task</p>
        <h1>Build a plan before the deadline bites.</h1>
        <p className="intro">
          Describe the outcome, choose a deadline, and set the daily time you
          can spend. Deadline AI will turn that pressure into a day-by-day plan.
        </p>
      </section>
      <TaskForm />
    </main>
  );
}
