// 납품 사진 파일 내려주기. 로그인한 직원이거나, 그 배차의 기사 링크 token(?t=)이 맞으면 보여 줍니다.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getDispatches } from "@/lib/dispatch/store";
import { readPhotoFile } from "@/lib/dispatch/photos";

export async function GET(req: Request, ctx: { params: Promise<{ dispatchId: string; file: string }> }) {
  const { dispatchId, file } = await ctx.params;
  const photoId = file.replace(/\.jpg$/, "");
  const user = await getCurrentUser();
  if (!user) {
    const t = new URL(req.url).searchParams.get("t");
    const d = t && t.length >= 20 ? (await getDispatches()).find((x) => x.id === dispatchId) : null;
    if (!d || d.token !== t) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const buf = await readPhotoFile(dispatchId, photoId);
  if (!buf) return NextResponse.json({ error: "사진이 없습니다." }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" } });
}
