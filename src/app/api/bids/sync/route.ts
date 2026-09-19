// 「나라장터에서 가져오기」 버튼: 최근 N일치 공고를 다시 가져옵니다.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { hasApiKey } from "@/lib/bids/g2b";
import { designJobStatus, readBids, startDesignHistory, syncBids } from "@/lib/bids/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!hasApiKey()) return NextResponse.json({ error: "공공데이터포털 인증키(DATA_GO_KR_KEY)가 서버에 설정되지 않았습니다. 시스템 설정 안내를 확인해 주세요." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { days?: number; mode?: string; monthsBack?: number };
  const days = Math.min(Math.max(Number(body.days) || 7, 1), 31);
  try {
    if (body.mode === "design") {
      // 오래 걸리므로 서버가 뒤에서 처리하고, 화면은 GET 으로 진행 상황을 봅니다
      const monthsBack = Math.min(Math.max(Number(body.monthsBack) || 16, 4), 36);
      const job = startDesignHistory(monthsBack);
      await audit({ user: user.name, action: "가져오기 시작", target: `지난 설계용역 ${monthsBack}개월치` });
      return NextResponse.json({ job });
    }
    const file = await syncBids(days);
    await audit({ user: user.name, action: "가져오기", target: `관급 공고 ${days}일치 (${file.items.length}건 보관)` });
    return NextResponse.json({ ...file, hasKey: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

/** 지난 설계용역 가져오기 진행 상황. 끝났으면 공고 목록도 함께 돌려줍니다 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const job = designJobStatus();
  if (job.running) return NextResponse.json({ job });
  const file = await readBids();
  return NextResponse.json({ job, items: file.items });
}
