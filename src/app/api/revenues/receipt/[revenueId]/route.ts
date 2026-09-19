// 인수증 사진: POST { image: dataURL(jpeg), note? } 저장 · DELETE ?id= 삭제 (로그인한 직원)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { addReceipt, removeReceipt } from "@/lib/receipts";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ revenueId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { revenueId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { image?: string; note?: string };
  if (!body.image) return NextResponse.json({ error: "사진이 없습니다." }, { status: 400 });
  try {
    const rec = await addReceipt(revenueId, body.image, user.name, body.note);
    await audit({ user: user.name, userId: user.id, action: "인수증 저장", target: revenueId, detail: body.note ?? "" });
    return NextResponse.json({ ok: true, receipt: rec });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "저장하지 못했습니다." }, { status: 400 }); }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { revenueId } = await ctx.params;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  try { await removeReceipt(revenueId, id); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "지우지 못했습니다." }, { status: 400 }); }
  await audit({ user: user.name, userId: user.id, action: "인수증 삭제", target: revenueId, detail: id });
  return NextResponse.json({ ok: true });
}
