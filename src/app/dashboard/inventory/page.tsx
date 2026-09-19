import InventoryManager from "./InventoryManager";

type Params = Promise<{ tab?: string; open?: string }>;

export default async function InventoryPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  return <InventoryManager key={`${sp.tab ?? ""}-${sp.open ?? ""}`} initialTab={sp.tab === "moves" ? "moves" : "stock"} openId={sp.open} />;
}
