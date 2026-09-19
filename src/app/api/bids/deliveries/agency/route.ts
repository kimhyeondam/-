// 한 기관의 납품 요약 (리드 만들기용)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { readDeliveries } from "@/lib/bids/deliveryStore";
import { agencyDigest } from "@/lib/bids/deliveryQuery";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const file = await readDeliveries();
  return NextResponse.json(agencyDigest(file.items, sp.get("name") ?? "", { year: sp.get("year") || undefined, related: sp.get("related") === "1" }));
}
