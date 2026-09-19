import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { loadCompany } from "@/lib/branding";
import { buildContractPdf } from "@/lib/contracts/pdf";
import { getContracts } from "@/lib/contracts/store";
import type { Contract } from "@/data/sample";

/** POST { id } 또는 { contract } → PDF */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const body = (await req.json()) as { id?: string; contract?: Contract };
  const contract = body.contract ?? (await getContracts()).find((c) => c.id === body.id);
  if (!contract) return NextResponse.json({ error: "계약을 찾을 수 없습니다." }, { status: 404 });
  const pdf = await buildContractPdf(contract, await loadCompany());
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(contract.title + ".pdf")}` } });
}
