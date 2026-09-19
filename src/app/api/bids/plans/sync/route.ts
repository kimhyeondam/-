import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { syncPlans } from "@/lib/bids/planStore";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { from?: string; to?: string };
  try {
    const file = await syncPlans(body.from, body.to);
    await audit({ user: user.name, action: "가져오기", target: `발주계획 ${file.fetchedFrom}~${file.fetchedTo} (${file.items.length}건 보관)` });
    return NextResponse.json({ ...file, hasKey: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 }); }
}
