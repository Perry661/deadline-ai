import { PlanDetailPage } from "@/src/components/plan-detail";

type TaskPageProps = {
  params: Promise<{
    taskId: string;
  }>;
};

export default async function TaskPage({ params }: TaskPageProps) {
  const { taskId } = await params;

  return (
    <main className="pageShell">
      <PlanDetailPage taskId={taskId} />
    </main>
  );
}
