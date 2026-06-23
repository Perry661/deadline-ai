import Link from "next/link";

export function EmptyState() {
  return (
    <section className="card" aria-labelledby="empty-dashboard-title">
      <p className="eyebrow">No plans yet</p>
      <h1 id="empty-dashboard-title">Turn pressure into a plan.</h1>
      <p className="intro">
        Your tasks are saved only in this browser, so you can plan privately
        and pick up from the same device.
      </p>
      <Link className="button buttonPrimary" href="/tasks/new">
        Create your first plan
      </Link>
    </section>
  );
}
