import BidManager from "./BidManager";
import { loadCompany } from "@/lib/branding";
import { serverProfile } from "@/lib/bids/regions";

type Params = Promise<{ region?: string; tab?: string }>;

export default async function BidsPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const company = await loadCompany();
  const tab = sp.tab === "list" ? "list" : sp.tab === "forecast" ? "forecast" : sp.tab === "deliveries" ? "deliveries" : "regions";
  return <BidManager key={`${sp.tab ?? ""}-${sp.region ?? ""}`} initialTab={tab} initialRegion={sp.region} companyName={company.name} regionKey={serverProfile().key} />;
}
