// PostgreSQL 저장소: 표 하나(jeil_collections)에 컬렉션별 JSON을 넣습니다.
// DATABASE_URL 환경 변수가 있으면 자동으로 이 저장소를 씁니다.
import { Pool } from "pg";
import type { Store } from "./types";

export class PgStore implements Store {
  private pool: Pool;
  private ready: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 5, ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false } });
  }

  private init() {
    if (!this.ready) {
      this.ready = this.pool
        .query(`CREATE TABLE IF NOT EXISTS jeil_collections (name TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
        .then(() => undefined);
    }
    return this.ready;
  }

  async get<T>(name: string) {
    await this.init();
    const r = await this.pool.query<{ data: T; updated_at: Date }>(`SELECT data, updated_at FROM jeil_collections WHERE name = $1`, [name]);
    if (!r.rows[0]) return null;
    return { data: r.rows[0].data, updatedAt: new Date(r.rows[0].updated_at).toISOString() };
  }

  async set<T>(name: string, data: T) {
    await this.init();
    await this.pool.query(
      `INSERT INTO jeil_collections (name, data, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [name, JSON.stringify(data)],
    );
  }
}
