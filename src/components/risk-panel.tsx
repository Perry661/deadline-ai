import type { StoredTask } from "../features/tasks/task";

type RiskPanelProps = {
  plan: StoredTask["plan"];
};

const feasibilityLabels: Record<StoredTask["plan"]["feasibility"], string> = {
  on_track: "On track",
  at_risk: "At risk",
  unrealistic: "Unrealistic",
};

export function RiskPanel({ plan }: RiskPanelProps) {
  return (
    <aside
      aria-labelledby="planning-assessment-title"
      className="riskPanel card"
    >
      <p className="eyebrow">Planning assessment</p>
      <h2 id="planning-assessment-title">Risk and scope</h2>
      <dl className="assessmentList">
        <div>
          <dt>Feasibility</dt>
          <dd>{feasibilityLabels[plan.feasibility]}</dd>
        </div>
        <div>
          <dt>Risk explanation</dt>
          <dd>{plan.riskExplanation}</dd>
        </div>
        <div>
          <dt>Scope recommendation</dt>
          <dd>{plan.scopeRecommendation}</dd>
        </div>
      </dl>
    </aside>
  );
}
