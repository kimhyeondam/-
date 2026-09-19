import type { Metadata, Viewport } from "next";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { getStore } from "@/lib/store";
import { themeVars } from "@/lib/theme";
import { loadCompany } from "@/lib/branding";

/** 브라우저 탭 제목·홈 화면 이름은 시스템 설정의 회사 이름을 따릅니다 */
export async function generateMetadata(): Promise<Metadata> {
  const c = await loadCompany().catch(() => null);
  const name = c?.name ?? "현담토목";
  return {
    title: `${name} 업무관리`,
    description: `${name} 업무 관리 시스템 - 대시보드, 할일, 캘린더, 프로젝트, AI 비서`,
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    icons: { apple: c?.logoMark && !c.logoMark.startsWith("data:") ? c.logoMark : "/apple-icon.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#171717",
};

async function loadTheme() {
  try {
    const row = await getStore().get<{ theme?: { primary?: string } }>("settings");
    return themeVars(row?.data?.theme?.primary);
  } catch { return themeVars(); }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const t = await loadTheme();
  return (
    <html lang="ko" className={`h-full antialiased ${GeistSans.variable} ${GeistMono.variable}`} style={{ "--primary": t.primary, "--primary-dark": t.dark, "--primary-soft": t.soft } as React.CSSProperties}>
      <head>
        <meta name="theme-color" content={t.primary} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
