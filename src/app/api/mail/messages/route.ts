import { NextResponse } from "next/server";
import { requireUser, requireAccount, friendlyMailError } from "@/lib/mail/api";
import { listMessages, type Folder } from "@/lib/mail/service";

export async function GET(req: Request) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const url = new URL(req.url);
  const acc = await requireAccount(url.searchParams.get("account"), r.user.id);
  if ("error" in acc) return acc.error;
  const folder = (url.searchParams.get("folder") === "sent" ? "sent" : "inbox") as Folder;
  try {
    const messages = await listMessages(acc.account, folder, { q: url.searchParams.get("q") ?? undefined, limit: 50 });
    return NextResponse.json({ messages });
  } catch (e) {
    return NextResponse.json({ error: friendlyMailError(e) }, { status: 502 });
  }
}
