import type { MetadataRoute } from "next";
import { loadCompany } from "@/lib/branding";

export const dynamic = "force-dynamic";

/** 휴대폰 "홈 화면에 추가" 시 앱처럼 보이게 하는 설정 (회사 이름·로고는 시스템 설정을 따릅니다) */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const c = await loadCompany().catch(() => null);
  const name = c?.name ?? "현담토목";
  const mark = c?.logoMark && !c.logoMark.startsWith("data:") ? c.logoMark : "/apple-icon.png";
  return {
    name: `${name} 업무관리`,
    short_name: name,
    description: `${name} 업무 관리 시스템`,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#171717",
    icons: [
      { src: mark, sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
