// 예시 데이터 지우기 (관리자만)
// - GET  : 메뉴별 예시 건수 / 직접 입력 건수, 되돌릴 수 있는 스냅샷 목록
// - POST : mode "sample"(기본) → 예시 항목만 지우고 직접 입력한 것은 남김
//          mode "all"          → 전부 지움 (확인 문구 "전체삭제")
//          action "undo"       → 지우기 직전 스냅샷으로 되돌림
//   어떤 경우든 지우기 직전 내용을 data/undo/ 에 스냅샷으로 남깁니다.
import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import { DATA_COLLECTIONS } from "@/lib/store/types";
import { sampleByCollection, splitSample } from "@/lib/sampleIds";
import { audit, collectionLabels } from "@/lib/audit";

const CLEARABLE = DATA_COLLECTIONS.filter((c) => c !== "settings" && c !== "assistantUsage");
const undoDir = () => path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "undo");

type Row = { id?: string; memberId?: string };

async function current(name: string): Promise<Row[]> {
  const row = await getStore().get<Row[]>(name);
  if (row && Array.isArray(row.data)) return row.data;
  return (sampleByCollection[name] ?? []) as Row[]; // 아직 저장된 적이 없으면 화면이 예시를 보여 주는 상태
}

async function counts() {
  const out: Record<string, { sample: number; mine: number }> = {};
  await Promise.all(CLEARABLE.map(async (name) => { const { sample, mine } = splitSample(name, await current(name)); out[name] = { sample: sample.length, mine: mine.length }; }));
  return out;
}

async function snapshots() {
  try {
    const files = (await fs.readdir(undoDir())).filter((f) => /^reset-.*\.json$/.test(f)).sort().reverse();
    return Promise.all(files.map(async (f) => { const st = await fs.stat(path.join(undoDir(), f)); return { file: f, at: st.mtime.toISOString(), size: st.size }; }));
  } catch { return []; }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "관리자") return NextResponse.json({ error: "관리자만 할 수 있습니다." }, { status: 403 });
  return NextResponse.json({ counts: await counts(), labels: collectionLabels, snapshots: await snapshots() });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "관리자") return NextResponse.json({ error: "관리자만 할 수 있습니다." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { confirm?: string; keepTemplates?: boolean; mode?: "sample" | "all"; action?: "undo"; file?: string };
  const store = getStore();

  if (body.action === "undo") {
    const file = body.file ?? "";
    if (!/^reset-[0-9T-]+\.json$/.test(file)) return NextResponse.json({ error: "잘못된 스냅샷 이름입니다." }, { status: 400 });
    const raw = await fs.readFile(path.join(undoDir(), file), "utf8").catch(() => null);
    if (!raw) return NextResponse.json({ error: "스냅샷 파일이 없습니다." }, { status: 404 });
    const snap = JSON.parse(raw) as { collections: Record<string, unknown[]> };
    let restored = 0;
    for (const [name, data] of Object.entries(snap.collections)) { if ((CLEARABLE as readonly string[]).includes(name)) { await store.set(name, data); restored += Array.isArray(data) ? data.length : 0; } }
    await audit({ user: user.name, userId: user.id, action: "지우기 되돌리기", target: file, detail: `${restored}건 복구` });
    return NextResponse.json({ ok: true, restored });
  }

  const mode = body.mode === "all" ? "all" : "sample";
  if (mode === "sample" && body.confirm !== "지우기") return NextResponse.json({ error: "확인 문구 「지우기」가 일치하지 않습니다." }, { status: 400 });
  if (mode === "all" && body.confirm !== "전체삭제") return NextResponse.json({ error: "확인 문구 「전체삭제」가 일치하지 않습니다." }, { status: 400 });
  const targets = CLEARABLE.filter((c) => !(body.keepTemplates && c === "contractTemplates"));

  // 1) 지우기 전 스냅샷
  const before: Record<string, Row[]> = {};
  for (const name of targets) before[name] = await current(name);
  await fs.mkdir(undoDir(), { recursive: true });
  const stamp = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace(/:/g, "-");
  const file = `reset-${stamp}.json`;
  await fs.writeFile(path.join(undoDir(), file), JSON.stringify({ at: stamp, by: user.name, mode, collections: before }), "utf8");
  // 스냅샷은 최근 10개만
  const old = (await fs.readdir(undoDir())).filter((f) => /^reset-.*\.json$/.test(f)).sort().reverse().slice(10);
  for (const f of old) await fs.rm(path.join(undoDir(), f), { force: true });

  // 2) 지우기
  const result: Record<string, { removed: number; kept: number }> = {};
  for (const name of targets) {
    const { sample, mine } = splitSample(name, before[name]);
    const next = mode === "all" ? [] : mine;
    await store.set(name, next); // 빈 목록도 저장해야 화면이 예시를 다시 채우지 않습니다
    result[name] = { removed: mode === "all" ? before[name].length : sample.length, kept: next.length };
  }
  const detail = Object.entries(result).filter(([, r]) => r.removed > 0).map(([c, r]) => `${collectionLabels[c] ?? c} ${r.removed}건${r.kept ? ` (남김 ${r.kept})` : ""}`).join(", ") || "지울 데이터 없음";
  await audit({ user: user.name, userId: user.id, action: mode === "all" ? "데이터 전체 삭제" : "예시 데이터 지우기", target: "전체", detail: `${detail} · 되돌리기 ${file}` });
  return NextResponse.json({ ok: true, result, snapshot: file });
}
