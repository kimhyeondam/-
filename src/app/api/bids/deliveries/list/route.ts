// 납품요구 목록 (필터 + 200건씩)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { readDeliveries } from "@/lib/bids/deliveryStore";
import { listItems } from "@/lib/bids/deliveryQuery";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const file = await readDeliveries();
  return NextResponse.json(listItems(file.items, { year: sp.get("year") || undefined, related: sp.get("related") === "1", region: sp.get("region") || undefined, company: sp.get("company") || undefined, q: sp.get("q") || undefined }, Number(sp.get("page") || 1), 200));
}
