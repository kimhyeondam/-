import ProductionManager from "./ProductionManager";

type Params = Promise<{ open?: string }>;

export default async function ProductionPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  return <ProductionManager key={sp.open ?? ""} openId={sp.open} />;
}
