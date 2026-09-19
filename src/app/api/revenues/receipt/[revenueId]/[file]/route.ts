// 인수증 사진 파일 내려주기 (로그인한 직원만)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { readReceiptFile } from "@/lib/receipts";

export async function GET(_req: Request, ctx: { params: Promise<{ revenueId: string; file: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { revenueId, file } = await ctx.params;
  const buf = await readReceiptFile(revenueId, file.replace(/\.jpg$/, ""));
  if (!buf) return NextResponse.json({ error: "사진이 없습니다." }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" } });
}
