import Link from "next/link";

export function AppHeader() {
  return (
    <header className="appHeader">
      <div className="appHeaderInner">
        <div>
          <Link className="brandLink" href="/">
            <span className="brandMark" aria-hidden="true">
              +
            </span>
            Deadline AI
          </Link>
          <p className="headerTagline">Turn pressure into a plan.</p>
        </div>
        <Link className="button buttonPrimary" href="/tasks/new">
          + New task
        </Link>
      </div>
    </header>
  );
}
