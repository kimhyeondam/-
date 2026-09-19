// 명함 QR로 여는 회사 소개 페이지(/company)에 쓰는 자료: 공급원승인서·카탈로그 같은 파일과 안내 문구
// - 파일 본체는 data/public/ 폴더에, 목록·문구는 settings.publicPage 에 저장합니다 (백업에 함께 들어감)
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getStore } from "@/lib/store";

export type PublicFileKind = "승인서" | "카탈로그" | "기타";
export interface PublicFile {
  id: string; // 파일 이름(확장자 포함)이자 내려받기 주소의 키
  kind: PublicFileKind;
  title: string; // 화면에 보이는 이름 (예: 공급원승인서 2026)
  fileName: string; // 내려받을 때 붙는 파일 이름
  size: number;
  type: string; // MIME
  uploadedAt: string;
}
export interface PublicPageSettings {
  intro?: string; // 회사 한 줄 소개
  showProducts?: boolean; // 생산품목 보이기 (기본 켬)
  files?: PublicFile[];
}
type Settings = { publicPage?: PublicPageSettings };

export const ALLOWED_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };
export const MAX_PUBLIC_FILE = 20 * 1024 * 1024;

export const publicDir = () => path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "public");

export async function readPublicPage(): Promise<PublicPageSettings> {
  try { const row = await getStore().get<Settings>("settings"); return row?.data?.publicPage ?? {}; } catch { return {}; }
}

export async function updatePublicPage(fn: (prev: PublicPageSettings) => PublicPageSettings) {
  const store = getStore();
  if (store.update) return store.update<Settings>("settings", (prev) => ({ ...(prev ?? {}), publicPage: fn(prev?.publicPage ?? {}) }));
  const row = await store.get<Settings>("settings");
  await store.set("settings", { ...(row?.data ?? {}), publicPage: fn(row?.data?.publicPage ?? {}) });
}

/** 올린 파일을 저장하고 목록에 넣습니다 */
export async function savePublicFile(buf: Buffer, opts: { kind: PublicFileKind; title: string; fileName: string; type: string }): Promise<PublicFile> {
  const ext = ALLOWED_TYPES[opts.type];
  if (!ext) throw new Error("PDF, PNG, JPG 파일만 올릴 수 있습니다.");
  if (buf.length > MAX_PUBLIC_FILE) throw new Error("파일은 20MB 이하로 올려 주세요.");
  const id = `${Date.now().toString(36)}${randomBytes(4).toString("hex")}.${ext}`;
  await fs.mkdir(publicDir(), { recursive: true });
  await fs.writeFile(path.join(publicDir(), id), buf);
  const file: PublicFile = { id, kind: opts.kind, title: opts.title.trim() || opts.fileName, fileName: opts.fileName || `${opts.title}.${ext}`, size: buf.length, type: opts.type, uploadedAt: new Date().toISOString() };
  await updatePublicPage((p) => ({ ...p, files: [...(p.files ?? []), file] }));
  return file;
}

export async function deletePublicFile(id: string) {
  if (!/^[a-z0-9]+\.(pdf|png|jpg)$/.test(id)) throw new Error("잘못된 파일 이름입니다.");
  await updatePublicPage((p) => ({ ...p, files: (p.files ?? []).filter((f) => f.id !== id) }));
  await fs.rm(path.join(publicDir(), id), { force: true });
}

/** 내려받기용: 파일 내용과 정보 (없으면 null) */
export async function openPublicFile(id: string): Promise<{ file: PublicFile; data: Buffer } | null> {
  if (!/^[a-z0-9]+\.(pdf|png|jpg)$/.test(id)) return null;
  const file = (await readPublicPage()).files?.find((f) => f.id === id);
  if (!file) return null;
  try { return { file, data: await fs.readFile(path.join(publicDir(), id)) }; } catch { return null; }
}
