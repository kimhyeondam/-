import { NextResponse } from "next/server";
import { requireUser, requireAccount, friendlyMailError } from "@/lib/mail/api";
import { sendMail, type Attachment } from "@/lib/mail/service";
import { appendMailLog } from "@/lib/mail/log";
import { audit } from "@/lib/audit";

const MAX_ATTACH_BYTES = 10 * 1024 * 1024; // 첨부 합계 10MB

export async function POST(req: Request) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const b = (await req.json()) as { account?: string; to?: string; cc?: string; subject?: string; text?: string; attachments?: Attachment[] };
  const acc = await requireAccount(b.account ?? null, r.user.id);
  if ("error" in acc) return acc.error;
  const to = (b.to ?? "").trim();
  if (!to) return NextResponse.json({ error: "받는 사람을 입력하세요." }, { status: 400 });
  if (!(b.subject ?? "").trim()) return NextResponse.json({ error: "제목을 입력하세요." }, { status: 400 });
  const attachments = (b.attachments ?? []).filter((a) => a.filename && a.contentBase64);
  const bytes = attachments.reduce((s, a) => s + Math.floor((a.contentBase64.length * 3) / 4), 0);
  if (bytes > MAX_ATTACH_BYTES) return NextResponse.json({ error: "첨부 파일은 합쳐서 10MB까지 보낼 수 있습니다." }, { status: 413 });

  const base = { at: new Date().toISOString(), accountId: acc.account.id, accountEmail: acc.account.email, sentBy: r.user.name, to, subject: b.subject!.trim(), attachments: attachments.length };
  try {
    // 대신 보내는 경우, 본문 끝에 누가 보냈는지 남깁니다.
    const onBehalf = acc.account.ownerId !== r.user.id ? `\n\n(${r.user.name} 발송)` : "";
    await sendMail(acc.account, { to, cc: b.cc?.trim(), subject: base.subject, text: (b.text ?? "") + onBehalf, attachments, fromName: acc.account.label });
    await appendMailLog({ ...base, ok: true });
    await audit({ user: r.user.name, userId: r.user.id, action: "메일 발송", target: to, detail: `${base.subject}${acc.account.ownerId !== r.user.id ? ` (${acc.account.label} 계정으로 대신 발송)` : ""}` });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const error = friendlyMailError(e);
    await appendMailLog({ ...base, ok: false, error });
    return NextResponse.json({ error }, { status: 502 });
  }
}
