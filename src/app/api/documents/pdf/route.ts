// 양식 문서 PDF 만들기: POST { doc } → PDF 파일
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { loadCompany } from "@/lib/branding";
import { audit } from "@/lib/audit";
import { buildPdf } from "@/lib/documents/pdf";
import { buildStatementPdf, buildQuotePdf } from "@/lib/documents/statementPdf";
import { getStore } from "@/lib/store";
import type { Customer, Deposit, Revenue } from "@/data/sample";
import type { FormDoc } from "@/data/sample";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const body = (await req.json()) as { doc?: FormDoc };
  const doc = body.doc;
  if (!doc || !doc.type || !Array.isArray(doc.items)) return NextResponse.json({ error: "문서 내용이 없습니다." }, { status: 400 });
  const company = await loadCompany();
  try {
    let pdf: Buffer;
    if (doc.type === "거래명세표") {
      // 전잔금: 이 거래처의 이전 매출 중 아직 못 받은 돈 (이 명세표의 매출은 제외)
      const store = getStore();
      const [revRow, depRow, custRow] = await Promise.all([store.get<Revenue[]>("revenues"), store.get<Deposit[]>("deposits"), store.get<Customer[]>("customers")]);
      const revenues = Array.isArray(revRow?.data) ? revRow!.data : [];
      const deposits = Array.isArray(depRow?.data) ? depRow!.data : [];
      const customers = Array.isArray(custRow?.data) ? custRow!.data : [];
      const mine = revenues.filter((r) => r.customer === doc.customer && r.id !== doc.revenueId && r.docId !== doc.id && (!r.date || r.date <= doc.date));
      const paid = (id: string) => deposits.filter((d) => d.revenueId === id).reduce((s, d) => s + d.amount, 0);
      const prevBalance = mine.reduce((s, r) => s + Math.max(r.amount - paid(r.id), 0), 0);
      const cust = customers.find((c) => c.name === doc.customer);
      pdf = await buildStatementPdf(doc, company, { prevBalance, customerPhone: cust?.phone, customerAddress: cust?.address, customerBizNo: cust?.bizNo });
    } else if (doc.type === "견적서") {
      pdf = await buildQuotePdf(doc, company);
    } else {
      pdf = await buildPdf(doc, company);
    }
    await audit({ user: user.name, userId: user.id, action: "PDF 생성", target: `${doc.type} ${doc.number}`, detail: doc.customer });
    const filename = encodeURIComponent(`${doc.type}_${doc.number}_${doc.customer}.pdf`);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename*=UTF-8''${filename}` },
    });
  } catch (e) {
    return NextResponse.json({ error: `PDF 생성 실패: ${(e as Error).message}` }, { status: 500 });
  }
}
