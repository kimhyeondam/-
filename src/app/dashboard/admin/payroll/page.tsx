import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { getCurrentUser } from "@/lib/session";
import PayrollManager from "./PayrollManager";

type Params = Promise<{ month?: string }>;

export default async function PayrollPage({ searchParams }: { searchParams: Params }) {
  const me = await getCurrentUser();
  if (!me || me.role !== "관리자") {
    return (
      <>
        <PageHeader title="급여 집계" description="출근부로 월 급여 집계표를 만듭니다." />
        <Card className="p-12 text-center text-sm text-slate-500">관리자만 볼 수 있는 화면입니다.</Card>
      </>
    );
  }
  const sp = await searchParams;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : undefined;
  return <PayrollManager key={month ?? ""} initialMonth={month} />;
}
