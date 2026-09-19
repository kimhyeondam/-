import { Card } from "@/components/Card";

/** 불러오는 동안 보여 주는 자리 표시 (회색 줄이 반짝임). 오류가 있으면 빨간 글씨로 */
export default function LoadingCard({ error }: { error?: string | null }) {
  if (error) return <Card className="p-8 text-center text-sm text-red-600">데이터를 불러오지 못했습니다: {error}</Card>;
  return (
    <Card className="p-5 space-y-3" aria-busy="true" aria-label="불러오는 중">
      <div className="h-4 w-1/3 rounded skeleton" />
      <div className="h-3 w-2/3 rounded skeleton" />
      <div className="h-3 w-1/2 rounded skeleton" />
      <div className="mt-2 h-24 rounded-xl skeleton" />
    </Card>
  );
}
