// 회사 소개 페이지의 파일 내려받기 (로그인 없이). ?view=1 이면 브라우저에서 바로 열기
import { NextResponse } from "next/server";
import { openPublicFile } from "@/lib/publicPage";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await openPublicFile(id);
  if (!found) return NextResponse.json({ error: "파일이 없습니다." }, { status: 404 });
  const view = new URL(req.url).searchParams.get("view") === "1";
  const name = found.file.fileName.replace(/["\r\n]/g, "");
  const ascii = name.replace(/[^\x20-\x7E]/g, "_");
  return new NextResponse(new Uint8Array(found.data), {
    headers: {
      "Content-Type": found.file.type,
      "Content-Length": String(found.data.length),
      "Content-Disposition": `${view ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
