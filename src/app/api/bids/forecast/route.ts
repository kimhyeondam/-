// 발주 예측 ↔ 납품 현황 대조: 설계용역 공고마다 같은 사업으로 보이는 납품요구를 찾아 돌려줍니다
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { readBids } from "@/lib/bids/store";
import { readDeliveries } from "@/lib/bids/deliveryStore";
import { isDesignService } from "@/lib/bids/forecast";
import { matchDeliveries, prepareDeliveries, summarizeMatches, type MatchSummary } from "@/lib/bids/match";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const [bids, dl] = await Promise.all([readBids(), readDeliveries()]);
  const designs = bids.items.filter(isDesignService);
  // 같은 자료면 지난 계산 결과를 그대로 (공고·납품 자료가 바뀌면 키가 달라져 다시 계산)
  const key = `${bids.fetchedAt ?? ""}|${bids.items.length}|${designs.length}|${dl.updatedAt ?? ""}|${dl.items.length}`;
  const g = globalThis as unknown as { __forecastMatch?: { key: string; body: unknown } };
  if (g.__forecastMatch?.key === key) return NextResponse.json(g.__forecastMatch.body);
  const prepared = prepareDeliveries(dl.items.filter((d) => d.related && d.reqName));
  const matches: Record<string, MatchSummary> = {};
  for (const n of designs) { const m = matchDeliveries(n, prepared); if (m.length) matches[n.id] = summarizeMatches(m); }
  const body = { matches, designs: designs.length, deliveries: prepared.length };
  g.__forecastMatch = { key, body };
  return NextResponse.json(body);
}
