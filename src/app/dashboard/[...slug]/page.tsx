import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { findMenuItem } from "@/data/menu";

export default async function PlaceholderPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const item = findMenuItem("/dashboard/" + slug.join("/"));
  if (!item) notFound();

  return (
    <>
      <PageHeader title={item.label} description={item.description} />
      <Card className="p-16 text-center border-dashed">
        <div className="text-4xl mb-4">🚧</div>
        <div className="text-lg font-semibold text-slate-800">{item.label} 화면은 준비 중입니다</div>
        <p className="mt-2 text-sm text-slate-500">다음 단계에서 순서대로 만들 예정입니다.</p>
      </Card>
    </>
  );
}
