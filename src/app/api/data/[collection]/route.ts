// 화면 데이터 읽기/쓰기 API (로그인한 사용자만)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getStore, isDataCollection } from "@/lib/store";
import { audit, collectionLabels } from "@/lib/audit";
import { getDispatches } from "@/lib/dispatch/store";
import { deleteDispatchPhotos } from "@/lib/dispatch/photos";
import { businessCards as sampleCards, type BusinessCard } from "@/data/sample";

type Ctx = { params: Promise<{ collection: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { collection } = await ctx.params;
  if (!isDataCollection(collection)) return NextResponse.json({ error: "없는 데이터입니다." }, { status: 404 });
  if (collection === "dispatches") return NextResponse.json({ data: await getDispatches(), updatedAt: new Date().toISOString() });
  const row = await getStore().get(collection);
  // 명함: 관리자는 전체, 직원은 자기 명함만 (남의 명함은 서버에서 아예 내려주지 않습니다)
  if (collection === "businessCards" && user.role !== "관리자") {
    const all = Array.isArray(row?.data) ? (row!.data as BusinessCard[]) : [];
    return NextResponse.json({ data: all.filter((c) => c.ownerId === user.id), updatedAt: row?.updatedAt ?? new Date().toISOString() });
  }
  return NextResponse.json(row ?? { data: null, updatedAt: null });
}

export async function PUT(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { collection } = await ctx.params;
  if (!isDataCollection(collection)) return NextResponse.json({ error: "없는 데이터입니다." }, { status: 404 });
  const body = (await req.json()) as { data: unknown };
  const okShape = collection === "settings" ? body?.data && typeof body.data === "object" && !Array.isArray(body.data) : Array.isArray(body?.data);
  if (!okShape) return NextResponse.json({ error: "데이터 형식이 잘못되었습니다." }, { status: 400 });
  const prev = await getStore().get<unknown[]>(collection);
  if (collection === "businessCards" && user.role !== "관리자") {
    // 직원은 자기 명함만 보내오므로, 다른 사람 명함은 그대로 두고 자기 것만 갈아 끼웁니다 (담당자도 본인으로 고정)
    const base = (Array.isArray(prev?.data) ? prev!.data : sampleCards) as BusinessCard[];
    const mine = (body.data as BusinessCard[]).map((c) => ({ ...c, ownerId: user.id, ownerName: user.name }));
    body.data = [...mine, ...base.filter((c) => c.ownerId !== user.id)];
  }
  if (collection === "dispatches" && Array.isArray(prev?.data)) {
    // 화면에서 지운 배차의 사진 폴더도 함께 지웁니다. 화면이 사진을 base64로 되돌려 보내지 못하도록 파일 경로만 남깁니다
    type P = { id: string; photos?: { id: string }[] };
    const nextIds = new Set((body.data as P[]).map((d) => d.id));
    for (const d of prev!.data as P[]) if (!nextIds.has(d.id)) await deleteDispatchPhotos(d.id);
    // 사무실 화면이 옛 목록을 들고 있는 사이 기사님이 올린 사진이 사라지지 않도록, 사진 목록은 서버 것과 합칩니다
    const prevById = new Map((prev!.data as P[]).map((d) => [d.id, d]));
    for (const d of body.data as P[]) {
      const old = prevById.get(d.id);
      if (!old?.photos?.length) continue;
      const have = new Set((d.photos ?? []).map((p) => p.id));
      d.photos = [...(d.photos ?? []), ...old.photos.filter((p) => !have.has(p.id))];
    }
  }
  await getStore().set(collection, body.data);
  if (collection !== "assistantUsage") {
    const before = Array.isArray(prev?.data) ? prev!.data.length : 0;
    const after = Array.isArray(body.data) ? body.data.length : 1;
    const diff = after - before;
    const detail = collection === "settings" ? "설정 변경" : diff > 0 ? `${diff}건 추가 (총 ${after}건)` : diff < 0 ? `${-diff}건 삭제 (총 ${after}건)` : `내용 수정 (총 ${after}건)`;
    await audit({ user: user.name, userId: user.id, action: "저장", target: collectionLabels[collection] ?? collection, detail });
  }
  return NextResponse.json({ ok: true, updatedAt: new Date().toISOString() });
}
