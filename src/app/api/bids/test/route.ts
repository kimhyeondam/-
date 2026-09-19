// 「연결 확인」: 나라장터에 1건만 요청해 보고 상태코드와 답장 내용을 그대로 보여 줍니다.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { hasApiKey, probe } from "@/lib/bids/g2b";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!hasApiKey()) return NextResponse.json({ ok: false, status: 0, body: "서버에 DATA_GO_KR_KEY 가 없습니다.", keyLength: 0 });
  return NextResponse.json(await probe());
}
