import { NextResponse } from "next/server";
import { requireUser } from "@/lib/mail/api";
import { getMailLog } from "@/lib/mail/log";
import { getMailAccounts, visibleTo } from "@/lib/mail/accounts";

/** 발송 기록: 내가 볼 수 있는 계정의 기록만 */
export async function GET() {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const ids = new Set(visibleTo(await getMailAccounts(), r.user.id).map((a) => a.id));
  const log = (await getMailLog()).filter((l) => ids.has(l.accountId)).slice(0, 200);
  return NextResponse.json({ log });
}
