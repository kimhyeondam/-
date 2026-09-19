import TaskManager from "./TaskManager";

type Params = Promise<{ due?: string; open?: string; status?: string }>;

export default async function TasksPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const due = sp.due === "today" || sp.due === "overdue" ? sp.due : "all";
  return <TaskManager key={`${due}-${sp.open ?? ""}`} initialDue={due} openId={sp.open} />;
}
