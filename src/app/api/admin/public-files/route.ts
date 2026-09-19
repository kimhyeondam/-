// 회사 소개 페이지 관리 (관리자만)
// - GET   : 파일 목록·문구
// - POST  : 파일 올리기 (multipart: file, kind, title)
// - PATCH : 문구·생산품목 보이기 저장 { intro, showProducts } 또는 파일 종류·이름 바꾸기 { fileId, kind, title }
// - DELETE: ?id=파일 → 삭제
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { readPublicPage, savePublicFile, deletePublicFile, updatePublicPage, type PublicFileKind } from "@/lib/publicPage";
import { audit } from "@/lib/audit";

async function admin() { const u = await getCurrentUser(); return u && u.role === "관리자" ? u : null; }
const deny = () => NextResponse.json({ error: "관리자만 할 수 있습니다." }, { status: 403 });

export async function GET() {
  if (!(await admin())) return deny();
  return NextResponse.json(await readPublicPage());
}

export async function POST(req: Request) {
  const user = await admin(); if (!user) return deny();
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "파일을 골라 주세요." }, { status: 400 });
    const kindRaw = String(form.get("kind") ?? "기타");
    const kind: PublicFileKind = kindRaw === "승인서" || kindRaw === "카탈로그" ? kindRaw : "기타";
    const saved = await savePublicFile(Buffer.from(await file.arrayBuffer()), { kind, title: String(form.get("title") ?? ""), fileName: file.name, type: file.type });
    await audit({ user: user.name, userId: user.id, action: "소개 페이지 파일 올림", target: saved.title, detail: `${kind} · ${Math.round(saved.size / 1024)}KB` });
    return NextResponse.json({ ok: true, file: saved, page: await readPublicPage() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "올리지 못했습니다." }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const user = await admin(); if (!user) return deny();
  const body = (await req.json().catch(() => ({}))) as { intro?: string; showProducts?: boolean; fileId?: string; kind?: string; title?: string };
  if (body.fileId) {
    const kind: PublicFileKind | undefined = body.kind === "승인서" || body.kind === "카탈로그" || body.kind === "기타" ? body.kind : undefined;
    await updatePublicPage((p) => ({ ...p, files: (p.files ?? []).map((f) => (f.id === body.fileId ? { ...f, kind: kind ?? f.kind, title: typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 100) : f.title } : f)) }));
    return NextResponse.json({ ok: true, page: await readPublicPage() });
  }
  await updatePublicPage((p) => ({ ...p, intro: typeof body.intro === "string" ? body.intro.slice(0, 300) : p.intro, showProducts: typeof body.showProducts === "boolean" ? body.showProducts : p.showProducts }));
  return NextResponse.json({ ok: true, page: await readPublicPage() });
}

export async function DELETE(req: Request) {
  const user = await admin(); if (!user) return deny();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  try { await deletePublicFile(id); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "지우지 못했습니다." }, { status: 400 }); }
  await audit({ user: user.name, userId: user.id, action: "소개 페이지 파일 삭제", target: id });
  return NextResponse.json({ ok: true, page: await readPublicPage() });
}
