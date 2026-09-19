import { NextResponse } from "next/server";
import { requireUser, friendlyMailError } from "@/lib/mail/api";
import { getMailAccounts, saveMailAccounts, toPublic, visibleTo, encryptPassword, providerPresets, type MailAccount, type MailProvider } from "@/lib/mail/accounts";
import { testConnection } from "@/lib/mail/service";
import { audit } from "@/lib/audit";

export async function GET() {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const accounts = visibleTo(await getMailAccounts(), r.user.id).map(toPublic);
  return NextResponse.json({ accounts, me: r.user.id, isAdmin: r.user.role === "관리자" });
}

export async function POST(req: Request) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const b = (await req.json()) as Partial<MailAccount> & { password?: string; provider?: MailProvider };
  const provider = (b.provider ?? "naver") as MailProvider;
  const preset = providerPresets[provider];
  if (!preset) return NextResponse.json({ error: "지원하지 않는 메일 종류입니다." }, { status: 400 });
  const email = (b.email ?? "").trim();
  const user = (b.user ?? "").trim() || email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "이메일 주소를 확인하세요." }, { status: 400 });
  if (!b.password) return NextResponse.json({ error: "비밀번호(또는 애플리케이션 비밀번호)를 입력하세요." }, { status: 400 });

  const account: MailAccount = {
    id: `ma${Date.now()}`,
    label: (b.label ?? "").trim() || email,
    email,
    provider,
    imapHost: (b.imapHost ?? "").trim() || preset.imapHost,
    imapPort: Number(b.imapPort) || preset.imapPort,
    smtpHost: (b.smtpHost ?? "").trim() || preset.smtpHost,
    smtpPort: Number(b.smtpPort) || preset.smtpPort,
    user,
    passwordEnc: encryptPassword(provider === "custom" ? b.password : b.password.replace(/\s+/g, "")),
    ownerId: r.user.id,
    shared: b.shared !== false, // 기본은 공용(직원 모두 사용). 대표 메일은 false로 등록
    createdAt: new Date().toISOString(),
  };
  if (!account.imapHost || !account.smtpHost) return NextResponse.json({ error: "IMAP/SMTP 서버 주소를 입력하세요." }, { status: 400 });

  try {
    await testConnection(account);
  } catch (e) {
    const err = e as { step?: string; message?: string; serverText?: string };
    console.error(`[mail] 계정 연동 실패 ${email} (${provider}) step=${err.step ?? "?"} host=${err.step === "smtp" ? account.smtpHost : account.imapHost} msg=${err.message} server=${err.serverText ?? ""}`);
    return NextResponse.json({ error: friendlyMailError(e, provider) }, { status: 422 });
  }
  const list = await getMailAccounts();
  if (list.some((a) => a.email === email)) return NextResponse.json({ error: "이미 등록된 메일 주소입니다." }, { status: 409 });
  await saveMailAccounts([...list, account]);
  await audit({ user: r.user.name, userId: r.user.id, action: "메일 계정 연동", target: account.email, detail: account.shared ? "공용" : "비공개" });
  return NextResponse.json({ account: toPublic(account) });
}

export async function DELETE(req: Request) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const id = new URL(req.url).searchParams.get("id");
  const list = await getMailAccounts();
  const target = list.find((a) => a.id === id);
  if (!target) return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  if (target.ownerId !== r.user.id && r.user.role !== "관리자") return NextResponse.json({ error: "본인이 등록한 계정이나 관리자만 삭제할 수 있습니다." }, { status: 403 });
  await saveMailAccounts(list.filter((a) => a.id !== id));
  await audit({ user: r.user.name, userId: r.user.id, action: "메일 계정 해제", target: target.email });
  return NextResponse.json({ ok: true });
}
