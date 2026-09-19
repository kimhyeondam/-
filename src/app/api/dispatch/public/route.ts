// 기사님용 공개 API: 로그인 없이 링크의 token으로만 접근합니다.
import { NextResponse } from "next/server";
import { loadCompany } from "@/lib/branding";
import { getDispatches, updateDispatch } from "@/lib/dispatch/store";
import { audit } from "@/lib/audit";
import { dispatchSteps, type Dispatch, type DispatchStatus } from "@/data/sample";
import { newId } from "@/lib/ids";
import { savePhotoFile, deletePhotoFile } from "@/lib/dispatch/photos";

async function findByToken(token: string | null) {
  if (!token || token.length < 20) return null;
  return (await getDispatches()).find((d) => d.token === token) ?? null;
}

function publicView(d: Dispatch) {
  return { id: d.id, date: d.date, customer: d.customer, site: d.site, address: d.address, contact: d.contact, items: d.items, vehicle: d.vehicle, driver: d.driver, status: d.status, log: d.log, photos: d.photos.map((p) => ({ id: p.id, kind: p.kind, at: p.at, note: p.note, image: p.image })), memo: d.memo, docNumber: d.docNumber };
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const d = await findByToken(token);
  if (!d) return NextResponse.json({ error: "유효하지 않은 배차 링크입니다." }, { status: 404 });
  const company = await loadCompany();
  return NextResponse.json({ dispatch: publicView(d), company: { name: company.name, phone: company.phone, logo: company.logo } });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { token?: string; action?: "status" | "photo" | "removePhoto"; status?: DispatchStatus; image?: string; kind?: "상차" | "인수" | "기타"; note?: string; photoId?: string };
  const d = await findByToken(body.token ?? null);
  if (!d) return NextResponse.json({ error: "유효하지 않은 배차 링크입니다." }, { status: 404 });
  if (d.status === "취소") return NextResponse.json({ error: "취소된 배차입니다. 회사에 확인해 주세요." }, { status: 400 });
  const now = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19); // 한국 시간
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

  if (body.action === "status") {
    const status = body.status;
    if (!status || !dispatchSteps.includes(status)) return NextResponse.json({ error: "잘못된 상태입니다." }, { status: 400 });
    const updated = await updateDispatch(d.id, (x) => ({ ...x, status, log: [...x.log, { status, at: now, by: x.driver }] }));
    await audit({ user: `${d.driver} (기사)`, action: `배차 ${status}`, target: `${d.customer} ${d.site ?? ""}`.trim(), detail: `${d.vehicle}${ip ? ` · IP ${ip}` : ""}` });
    return NextResponse.json({ ok: true, dispatch: updated && publicView(updated) });
  }
  if (body.action === "photo") {
    const image = body.image ?? "";
    if (!image.startsWith("data:image/jpeg;base64,") || image.length > 600_000) return NextResponse.json({ error: "사진이 너무 크거나 형식이 맞지 않습니다. 다시 찍어 주세요." }, { status: 400 });
    if (d.photos.length >= 8) return NextResponse.json({ error: "사진은 배차 한 건에 8장까지 올릴 수 있습니다." }, { status: 400 });
    const id = newId("ph");
    const url = await savePhotoFile(d.id, id, image);
    const photo = { id, kind: body.kind ?? "기타", image: url, at: now, note: body.note?.trim() || undefined };
    const updated = await updateDispatch(d.id, (x) => ({ ...x, photos: [...x.photos, photo] }));
    await audit({ user: `${d.driver} (기사)`, action: `${photo.kind} 사진 업로드`, target: `${d.customer} ${d.site ?? ""}`.trim(), detail: d.vehicle });
    return NextResponse.json({ ok: true, dispatch: updated && publicView(updated) });
  }
  if (body.action === "removePhoto") {
    if (body.photoId) await deletePhotoFile(d.id, body.photoId);
    const updated = await updateDispatch(d.id, (x) => ({ ...x, photos: x.photos.filter((p) => p.id !== body.photoId) }));
    return NextResponse.json({ ok: true, dispatch: updated && publicView(updated) });
  }
  return NextResponse.json({ error: "알 수 없는 요청입니다." }, { status: 400 });
}
