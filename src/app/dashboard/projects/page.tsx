import ProjectManager from "./ProjectManager";
import { projectStatuses } from "./projectMeta";

type Params = Promise<{ status?: string; open?: string }>;

export default async function ProjectsPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const status = (projectStatuses as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof projectStatuses)[number]) : "all";
  return <ProjectManager key={`${status}-${sp.open ?? ""}`} initialStatus={status} openId={sp.open} />;
}
