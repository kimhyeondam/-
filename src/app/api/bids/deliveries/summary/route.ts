// 납품 현황 첫 화면용 집계 (전체 자료를 보내지 않음)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { loadCompany } from "@/lib/branding";
import { readDeliveries } from "@/lib/bids/deliveryStore";
import { summarize } from "@/lib/bids/deliveryQuery";
import { normCompany } from "@/lib/bids/deliveries";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const t0 = Date.now();
  const g = globalThis as unknown as { __deliveryCache?: unknown };
  const wasCached = Boolean(g.__deliveryCache);
  const [file, company] = await Promise.all([readDeliveries(), loadCompany()]);
  const tRead = Date.now() - t0;
  const me = normCompany(company.name);
  const isMe = (c: string) => me.length >= 2 && normCompany(c).includes(me);
  const s = summarize(file.items, { year: sp.get("year") || undefined, related: sp.get("related") === "1", region: sp.get("region") || undefined, company: sp.get("company") || undefined }, isMe);
  const ms = Date.now() - t0;
  if (ms > 1500) console.warn(`[deliveries] 집계 ${ms}ms (읽기 ${tRead}ms, 캐시 ${wasCached ? "사용" : "새로 읽음"}, ${file.items.length}건)`);
  return NextResponse.json({ ...s, all: file.items.length, updatedAt: file.updatedAt, files: file.files ?? [], myCompany: company.name, timing: { ms, read: tRead, cached: wasCached } });
}
