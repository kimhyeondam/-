import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { getCurrentUser } from "@/lib/session";
import { getUsers, toPublic } from "@/lib/users";
import { getStore } from "@/lib/store";
import type { Worker } from "@/data/sample";
import { storeKind } from "@/lib/store";
import EmployeeManager from "./EmployeeManager";

export default async function EmployeesPage() {
  const me = await getCurrentUser();
  if (!me || me.role !== "관리자") {
    return (
      <>
        <PageHeader title="직원관리" description="직원 계정과 권한을 관리합니다." />
        <Card className="p-12 text-center text-sm text-slate-500">관리자만 볼 수 있는 화면입니다.</Card>
      </>
    );
  }
  const users = (await getUsers()).map(toPublic);
  const row = await getStore().get<Worker[]>("workers");
  const workers = Array.isArray(row?.data) ? row!.data : [];
  return <EmployeeManager initial={users} initialWorkers={workers.filter((w) => !users.some((u) => u.id === w.id))} meId={me.id} storeKind={storeKind()} />;
}
