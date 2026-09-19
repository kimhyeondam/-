import { NextResponse } from "next/server";
import { requireUser, requireAccount, friendlyMailError } from "@/lib/mail/api";
import { getMessage, type Folder } from "@/lib/mail/service";

export async function GET(req: Request) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const url = new URL(req.url);
  const acc = await requireAccount(url.searchParams.get("account"), r.user.id);
  if ("error" in acc) return acc.error;
  const folder = (url.searchParams.get("folder") === "sent" ? "sent" : "inbox") as Folder;
  const uid = Number(url.searchParams.get("uid"));
  if (!uid) return NextResponse.json({ error: "메일을 지정하세요." }, { status: 400 });
  try {
    const message = await getMessage(acc.account, folder, uid);
    if (!message) return NextResponse.json({ error: "메일을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ message });
  } catch (e) {
    return NextResponse.json({ error: friendlyMailError(e) }, { status: 502 });
  }
}
