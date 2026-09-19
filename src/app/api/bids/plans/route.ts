import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { hasApiKey } from "@/lib/bids/g2b";
import { readPlans } from "@/lib/bids/planStore";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json({ ...(await readPlans()), hasKey: hasApiKey() });
}
