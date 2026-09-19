// 관급 공고 목록. 보관된 자료를 바로 주고, 오래되었고 인증키가 있으면 뒤에서 새로 가져옵니다 (화면이 기다리지 않게).
// ?poll=1 : 뒤 가져오기가 끝났는지만 확인 (새로 시작하지 않음)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { hasApiKey } from "@/lib/bids/g2b";
import { isStale, readBids, startBackgroundSync, backgroundSyncStatus } from "@/lib/bids/store";
import { serverProfile } from "@/lib/bids/regions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const poll = new URL(req.url).searchParams.get("poll") === "1";
  const file = await readBids();
  let status = backgroundSyncStatus();
  if (!poll && hasApiKey() && isStale(file) && !status.running) { startBackgroundSync(7); status = backgroundSyncStatus(); }
  const autoError = !status.running && status.error && status.finishedAt && Date.now() - new Date(status.finishedAt).getTime() < 60_000 ? status.error : undefined;
  return NextResponse.json({ ...file, hasKey: hasApiKey(), autoError, syncing: status.running, regionKey: serverProfile().key });
}
