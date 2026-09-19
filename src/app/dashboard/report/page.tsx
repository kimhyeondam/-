import ReportView from "./ReportView";

type Params = Promise<{ month?: string }>;

export default async function ReportPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : undefined;
  return <ReportView key={month ?? ""} initialMonth={month} />;
}
