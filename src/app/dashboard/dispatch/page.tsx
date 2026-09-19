import DispatchManager from "./DispatchManager";

type Params = Promise<{ from?: string; open?: string }>;

export default async function DispatchPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  return <DispatchManager key={`${sp.from ?? ""}-${sp.open ?? ""}`} fromRevenueId={sp.from} openId={sp.open} />;
}
