import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { getCurrentUser } from "@/lib/session";
import { storeKind } from "@/lib/store";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const me = await getCurrentUser();
  if (!me || me.role !== "관리자") {
    return (
      <>
        <PageHeader title="시스템 설정" description="회사 정보, 로고, 기본 설정을 변경합니다." />
        <Card className="p-12 text-center text-sm text-slate-500">관리자만 볼 수 있는 화면입니다.</Card>
      </>
    );
  }
  return <SettingsForm storeKind={storeKind()} hasAiKey={!!process.env.ANTHROPIC_API_KEY} />;
}
