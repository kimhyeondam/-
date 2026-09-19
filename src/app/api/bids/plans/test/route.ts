import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { hasApiKey } from "@/lib/bids/g2b";
import { probePlans } from "@/lib/bids/plans";
import { readPlans } from "@/lib/bids/planStore";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!hasApiKey()) return NextResponse.json({ ok: false, status: 0, body: "서버에 DATA_GO_KR_KEY 가 없습니다." });
  const prev = await readPlans();
  return NextResponse.json(await probePlans(undefined, prev.endpoint));
}
