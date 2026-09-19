import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import AssistantPanel from "@/components/AssistantPanel";
import { getCurrentUser } from "@/lib/session";
import { brandOf, loadCompany } from "@/lib/branding";
import { BrandProvider } from "@/lib/brand";
import { getStore } from "@/lib/store";
import type { MenuPrefs } from "@/lib/theme";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login"); // proxy가 먼저 막지만, 만약을 위해 한 번 더 확인
  const company = await loadCompany();
  let menuPrefs: MenuPrefs = {};
  try { const row = await getStore().get<{ menu?: MenuPrefs }>("settings"); menuPrefs = row?.data?.menu ?? {}; } catch {}

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <MobileNav user={{ name: user.name, role: user.role }} brand={{ name: company.name, logo: company.logo, logoMark: company.logoMark }} menuPrefs={menuPrefs} />
      <Sidebar user={{ name: user.name, role: user.role }} brand={{ name: company.name, logo: company.logo, logoMark: company.logoMark }} menuPrefs={menuPrefs} />
      <main className="flex-1 min-w-0 p-3 md:p-6 space-y-4 md:space-y-5"><BrandProvider value={brandOf(company)}>{children}</BrandProvider></main>
      <AssistantPanel />
    </div>
  );
}
