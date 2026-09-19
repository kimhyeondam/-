import path from "node:path";
import type { Store } from "./types";
import { FileStore } from "./fileStore";
import { PgStore } from "./pgStore";

export * from "./types";

// 서버가 살아 있는 동안 저장소 객체는 하나만 만듭니다.
const globalRef = globalThis as unknown as { __jeilStore?: Store };

export function getStore(): Store {
  if (!globalRef.__jeilStore) {
    globalRef.__jeilStore = process.env.DATABASE_URL
      ? new PgStore(process.env.DATABASE_URL)
      : new FileStore(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
  }
  return globalRef.__jeilStore;
}

export function storeKind() {
  return process.env.DATABASE_URL ? "postgres" : "file";
}
