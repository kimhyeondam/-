import AttendanceManager from "./AttendanceManager";

type Params = Promise<{ month?: string }>;

export default async function AttendancePage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : undefined;
  return <AttendanceManager key={month ?? ""} initialMonth={month} />;
}
