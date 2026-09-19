// 납품요구 CSV 올리기 / 목록 / 비우기
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { decodeText, parseDeliveriesAsync, type Delivery } from "@/lib/bids/deliveries";
import { clearDeliveries, finishUpload, mergeDeliveries, pruneUnrelated, readDeliveries, stageChunk } from "@/lib/bids/deliveryStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json(await readDeliveries());
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  // 브라우저가 CSV 를 읽어 우리 지역 것만 골라 조각으로 보내는 방식 (큰 파일도 안전)
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      const body = (await req.json().catch(() => null)) as { items?: Delivery[]; fileName?: string; rows?: number; uploadId?: string; index?: number; chunks?: number; last?: boolean } | null;
      if (!body || !Array.isArray(body.items)) return NextResponse.json({ error: "보낸 자료 형식이 잘못되었습니다." }, { status: 400 });
      const fileName = body.fileName ?? "csv"; const rows = body.rows ?? body.items.length;
      // 조각 올리기: 모아 두었다가 마지막에 한 번 합칩니다
      if (body.uploadId && typeof body.index === "number" && typeof body.chunks === "number") {
        const have = stageChunk(body.uploadId, body.index, body.items.slice(0, 20000), fileName, rows);
        if (!body.last) return NextResponse.json({ staged: have, items: [] });
        const merged = await finishUpload(body.uploadId, body.chunks);
        if (!merged) return NextResponse.json({ error: "서버가 중간에 다시 시작되어 조각이 일부 사라졌습니다. 같은 파일을 한 번 더 올려 주세요." }, { status: 409 });
        await audit({ user: user.name, action: "납품요구 올리기", target: `${fileName} (${rows.toLocaleString("ko-KR")}줄, 새로 ${merged.added}건)` });
        return NextResponse.json({ ...merged, added: merged.added });
      }
      const merged = await mergeDeliveries(body.items.slice(0, 20000), fileName, rows);
      await audit({ user: user.name, action: "납품요구 올리기", target: `${fileName} (${rows.toLocaleString("ko-KR")}줄, 새로 ${merged.added}건)` });
      return NextResponse.json({ ...merged, added: merged.added });
    } catch (e) {
      console.error("[deliveries] 저장 실패", e);
      return NextResponse.json({ error: `저장 중 오류: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "CSV 파일을 골라 주세요." }, { status: 400 });
  if (file.size > 60 * 1024 * 1024) return NextResponse.json({ error: "파일이 너무 큽니다 (60MB 이하)." }, { status: 400 });
  if (/\.xlsx?$/i.test(file.name)) return NextResponse.json({ error: "엑셀(xlsx) 파일은 아직 읽지 못합니다. 엑셀에서 「다른 이름으로 저장 → CSV(쉼표로 분리)」로 저장한 뒤 올려 주세요." }, { status: 400 });
  const text = decodeText(await file.arrayBuffer());
  const parsed = await parseDeliveriesAsync(text);
  if (parsed.missing.length) return NextResponse.json({ error: `파일에서 이 칸을 찾지 못했습니다: ${parsed.missing.join(", ")}`, header: parsed.header }, { status: 400 });
  const merged = await mergeDeliveries(parsed.items, file.name, parsed.rows);
  await audit({ user: user.name, action: "납품요구 올리기", target: `${file.name} (${parsed.rows}줄 중 우리 지역 ${parsed.items.length}건, 새로 ${merged.added}건)` });
  return NextResponse.json({ ...merged, parsedRows: parsed.rows, parsedItems: parsed.items.length, header: parsed.header });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (user.role !== "관리자") return NextResponse.json({ error: "관리자만 비울 수 있습니다." }, { status: 403 });
  if (new URL(req.url).searchParams.get("mode") === "unrelated") {
    const r = await pruneUnrelated();
    await audit({ user: user.name, action: "납품요구 정리", target: `우리 품목 아닌 ${r.removed}건 삭제, ${r.kept}건 유지` });
    return NextResponse.json({ ok: true, ...r });
  }
  await clearDeliveries();
  await audit({ user: user.name, action: "납품요구 비우기" });
  return NextResponse.json({ ok: true });
}
