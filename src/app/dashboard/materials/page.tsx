import MaterialManager from "./MaterialManager";

type Params = Promise<{ tab?: string }>;

export default async function MaterialsPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  return <MaterialManager key={sp.tab ?? ""} initialTab={sp.tab === "moves" ? "moves" : "stock"} />;
}
