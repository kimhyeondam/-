// 고객 전자서명 (로그인 없이 링크의 token으로 접근)
import { NextResponse } from "next/server";
import { loadCompany } from "@/lib/branding";
import { getContracts, updateContract } from "@/lib/contracts/store";
import { audit } from "@/lib/audit";

async function findByToken(token: string | null) {
  if (!token || token.length < 20) return null;
  return (await getContracts()).find((c) => c.signToken === token) ?? null;
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const c = await findByToken(token);
  if (!c) return NextResponse.json({ error: "유효하지 않은 서명 링크입니다." }, { status: 404 });
  const company = await loadCompany();
  return NextResponse.json({
    contract: { id: c.id, title: c.title, customer: c.customer, customerRef: c.customerRef, body: c.body, amount: c.amount, status: c.status, signedAt: c.signedAt, signerName: c.signerName, sentAt: c.sentAt },
    company: { name: company.name, ceo: company.ceo, phone: company.phone, logo: company.logo },
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { token?: string; name?: string; signature?: string; agree?: boolean };
  const c = await findByToken(body.token ?? null);
  if (!c) return NextResponse.json({ error: "유효하지 않은 서명 링크입니다." }, { status: 404 });
  if (c.status === "서명완료") return NextResponse.json({ error: "이미 서명이 완료된 계약입니다." }, { status: 400 });
  if (c.status === "취소") return NextResponse.json({ error: "취소된 계약입니다." }, { status: 400 });
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "서명자 이름을 입력하세요." }, { status: 400 });
  if (!body.agree) return NextResponse.json({ error: "계약 내용에 동의해 주세요." }, { status: 400 });
  if (!body.signature?.startsWith("data:image/png;base64,") || body.signature.length > 300_000) return NextResponse.json({ error: "서명을 그려 주세요." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const updated = await updateContract(c.id, { status: "서명완료", signedAt: new Date().toISOString(), signerName: name, signature: body.signature, memo: [c.memo, ip ? `서명 IP ${ip}` : ""].filter(Boolean).join(" · ") || undefined });
  await audit({ user: `${name} (고객)`, action: "계약 서명", target: c.title, detail: `${c.customer}${ip ? ` · IP ${ip}` : ""}` });
  return NextResponse.json({ ok: true, signedAt: updated?.signedAt });
}
