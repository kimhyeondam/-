// 파일 저장소: 서버의 data 폴더에 컬렉션마다 JSON 파일 하나씩 저장합니다.
// 설정 없이 바로 동작하며, 소규모 회사에는 충분합니다. (Vercel처럼 파일을 남길 수 없는 곳에서는 PostgreSQL을 쓰세요.)
// - 같은 컬렉션에 동시에 쓰면 순서대로 줄을 세워 파일이 섞이지 않게 합니다.
// - 임시 파일에 다 쓴 뒤 이름을 바꿔 넣어, 쓰다 말고 꺼져도 파일이 깨지지 않습니다.
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Store } from "./types";

const locks = new Map<string, Promise<unknown>>();
/** 컬렉션별로 한 번에 하나씩만 쓰도록 줄 세우기 */
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(key, next);
  // finally 가 만든 약속이 거부되어도 아무도 받지 않으면 unhandledRejection 이 나므로 catch 로 막습니다
  next.finally(() => { if (locks.get(key) === next) locks.delete(key); }).catch(() => {});
  return next;
}

export class FileStore implements Store {
  constructor(private dir: string) {}

  private file(name: string) {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error("잘못된 컬렉션 이름");
    return path.join(this.dir, `${name}.json`);
  }

  async get<T>(name: string) {
    try {
      const raw = await fs.readFile(this.file(name), "utf8");
      try {
        return JSON.parse(raw) as { data: T; updatedAt: string };
      } catch (e) {
        // 깨진 파일: 옆에 사본을 남기고, 「올바른 JSON 뒤에 찌꺼기가 붙은」 경우(예전 동시 저장 사고)는 앞부분만 살려 고쳐 씁니다
        const bad = this.file(name).replace(/\.json$/, `.corrupt-${Date.now()}.json`);
        await fs.copyFile(this.file(name), bad).catch(() => {});
        const repaired = this.salvage<T>(raw);
        if (repaired) {
          console.error(`[store] ${name} 파일이 손상되어 앞부분만 살려 고쳤습니다. 사본: ${path.basename(bad)}`);
          await this.set(name, repaired.data).catch(() => {});
          return repaired;
        }
        throw new Error(`${name} 파일이 손상되었습니다 (${(e as Error).message}). 사본: ${path.basename(bad)}`);
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  /** 올바른 JSON 뒤에 찌꺼기가 붙은 파일에서 앞부분을 살립니다 (오류 메시지의 위치 → 마지막 '}' 순으로 시도) */
  private salvage<T>(raw: string): { data: T; updatedAt: string } | null {
    const tryParse = (s: string) => { try { const v = JSON.parse(s); return v && typeof v === "object" && "data" in v ? (v as { data: T; updatedAt: string }) : null; } catch { return null; } };
    const m = /position (\d+)/.exec((() => { try { JSON.parse(raw); return ""; } catch (e) { return (e as Error).message; } })());
    if (m) { const r = tryParse(raw.slice(0, Number(m[1]))); if (r) return r; }
    let end = raw.lastIndexOf("}");
    for (let i = 0; i < 50 && end > 0; i++) { const r = tryParse(raw.slice(0, end + 1)); if (r) return r; end = raw.lastIndexOf("}", end - 1); }
    return null;
  }

  async set<T>(name: string, data: T) {
    const file = this.file(name);
    await withLock(`file:${name}`, async () => {
      await fs.mkdir(this.dir, { recursive: true });
      const tmp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
      // 작은 자료는 보기 좋게 줄바꿈해 저장하고, 큰 자료(2MB 이상)는 줄바꿈 없이 저장해 메모리와 용량을 아낍니다
      const compact = JSON.stringify({ data, updatedAt: new Date().toISOString() });
      await fs.writeFile(tmp, compact.length < 2_000_000 ? JSON.stringify(JSON.parse(compact), null, 2) : compact, "utf8");
      await fs.rename(tmp, file);
    });
  }

  /** 읽고-고치고-쓰기를 한 묶음으로 (활동 기록처럼 여러 요청이 같은 목록에 덧붙일 때) */
  async update<T>(name: string, fn: (prev: T | null) => T) {
    await withLock(`update:${name}`, async () => {
      const row = await this.get<T>(name);
      await this.set(name, fn(row ? row.data : null));
    });
  }
}
