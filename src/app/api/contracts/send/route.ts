// 계약서 발송: 서명 링크 만들기 + (계정이 있으면) 메일로 PDF와 링크 보내기
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { loadCompany } from "@/lib/branding";
import { buildContractPdf } from "@/lib/contracts/pdf";
import { getContracts, updateContract } from "@/lib/contracts/store";
import { getMailAccounts, canUse } from "@/lib/mail/accounts";
import { sendMail } from "@/lib/mail/service";
import { friendlyMailError } from "@/lib/mail/api";
import { appendMailLog } from "@/lib/mail/log";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const body = (await req.json()) as { id: string; accountId?: string; to?: string; message?: string };
  const contract = (await getContracts()).find((c) => c.id === body.id);
  if (!contract) return NextResponse.json({ error: "계약을 찾을 수 없습니다." }, { status: 404 });
  if (contract.status === "서명완료") return NextResponse.json({ error: "이미 서명이 완료된 계약입니다." }, { status: 400 });

  const token = contract.signToken ?? randomBytes(24).toString("hex");
  const origin = new URL(req.url).origin;
  const link = `${origin}/sign/${token}`;
  const company = await loadCompany();
  const to = (body.to ?? contract.customerEmail ?? "").trim();

  let mailed = false;
  if (body.accountId) {
    const account = (await getMailAccounts()).find((a) => a.id === body.accountId);
    if (!account || !canUse(account, user.id)) return NextResponse.json({ error: "이 메일 계정을 사용할 권한이 없습니다." }, { status: 403 });
    if (!to) return NextResponse.json({ error: "받는 사람 이메일을 입력하세요." }, { status: 400 });
    const pdf = await buildContractPdf({ ...contract, signToken: token }, company);
    const text = `${contract.customer} ${contract.customerRef ?? "담당자"}님, 안녕하세요.\n\n"${contract.title}" 계약서를 보내드립니다. 첨부된 PDF로 내용을 확인하신 뒤 아래 링크에서 전자서명을 부탁드립니다.\n\n서명 링크: ${link}\n\n${body.message?.trim() ? body.message.trim() + "\n\n" : ""}감사합니다.\n${company.name} 드림\n${company.phone}`;
    const base = { at: new Date().toISOString(), accountId: account.id, accountEmail: account.email, sentBy: user.name, to, subject: `[${company.name}] ${contract.title} 서명 요청`, attachments: 1 };
    try {
      await sendMail(account, { to, subject: base.subject, text, attachments: [{ filename: `${contract.title}.pdf`, contentBase64: pdf.toString("base64"), contentType: "application/pdf" }], fromName: account.label });
      await appendMailLog({ ...base, ok: true });
      mailed = true;
    } catch (e) {
      const error = friendlyMailError(e);
      await appendMailLog({ ...base, ok: false, error });
      return NextResponse.json({ error }, { status: 502 });
    }
  }

  const updated = await updateContract(contract.id, { signToken: token, status: "발송완료", sentAt: new Date().toISOString().slice(0, 10), customerEmail: to || contract.customerEmail });
  await audit({ user: user.name, userId: user.id, action: "계약 발송", target: contract.title, detail: mailed ? `${to}로 메일 발송` : "서명 링크 생성" });
  return NextResponse.json({ ok: true, link, mailed, contract: updated });
}
