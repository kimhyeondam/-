import ScheduleManager from "./ScheduleManager";

type Params = Promise<{ view?: string; open?: string }>;

export default async function SchedulePage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const view = sp.view === "week" || sp.view === "day" || sp.view === "month" ? sp.view : undefined;
  return <ScheduleManager key={`${view ?? ""}-${sp.open ?? ""}`} initialView={view} openId={sp.open} />;
}
