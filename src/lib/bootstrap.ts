// 첫 실행 준비: 환경변수로 회사 이름과 예시 자료 여부를 정해 두면, 서버가 처음 켜질 때 한 번만 적용합니다.
// - COMPANY_NAME / COMPANY_SHORT / COMPANY_OWNER : 시스템 설정에 회사가 아직 저장되지 않았을 때 상호·약칭·호칭을 미리 넣습니다
// - FRESH_START : 기본은 1(예시 자료·예시 직원 계정 없이 빈 상태로 시작). 화면 확인용 예시 자료를 보려면 0 으로 둡니다
// 한 번 적용되면 settings.bootstrap 에 표시를 남겨 다시 실행하지 않습니다. (시스템 설정에서 바꾼 값은 그대로 유지)
import { getStore, DATA_COLLECTIONS, USERS_COLLECTION } from "@/lib/store";
import type { CompanyProfile } from "@/data/sample";
import { hashPassword } from "@/lib/users";

type Settings = { company?: Partial<CompanyProfile>; bootstrap?: { at: string; company?: string; fresh?: boolean } };

const SKIP = new Set(["settings", "assistantUsage", "forecastMarks"]);

export function bootstrapConfig() {
  const name = (process.env.COMPANY_NAME ?? "").trim();
  const fresh = !/^(0|false|no|off)$/i.test((process.env.FRESH_START ?? "").trim()); // 비워 두면 빈 상태로 시작
  return { name, shortName: (process.env.COMPANY_SHORT ?? "").trim(), ownerName: (process.env.COMPANY_OWNER ?? "").trim(), fresh };
}

let done: Promise<void> | null = null;

/** 서버가 켜질 때 한 번 호출. 실패해도 프로그램은 그대로 동작합니다. */
export function ensureBootstrap(): Promise<void> {
  if (!done) done = run().catch((e) => { console.warn("[bootstrap] 첫 실행 준비를 건너뜁니다:", e instanceof Error ? e.message : e); });
  return done;
}

async function run() {
  const cfg = bootstrapConfig();
  if (!cfg.name && !cfg.fresh) return;
  const store = getStore();
  const row = await store.get<Settings>("settings");
  const settings: Settings = row?.data ?? {};
  if (settings.bootstrap) return; // 이미 준비했음

  const applied: Settings["bootstrap"] = { at: new Date().toISOString() };

  // 1) 회사 이름: 시스템 설정에 저장된 회사가 없을 때만
  if (cfg.name && !(settings.company?.name ?? "").trim()) {
    const shortName = cfg.shortName || cfg.name.replace(/\(주\)|㈜|주식회사|\s/g, "").slice(0, 2);
    settings.company = {
      ...settings.company,
      name: cfg.name, shortName, ownerName: cfg.ownerName || "대표님",
      ceo: "", bizNo: "", address: "", phone: "", fax: "", email: "", bank: "",
      bizType: "", bizItem: "",
      logo: undefined, logoMark: undefined,
    };
    applied.company = cfg.name;
    console.log(`[bootstrap] 회사 이름을 「${cfg.name}」(약칭 ${shortName})으로 준비했습니다.`);
  }

  // 2) 예시 자료 없이 시작: 아직 저장된 적이 없는 항목만 빈 목록으로 저장
  if (cfg.fresh) {
    let emptied = 0;
    for (const name of DATA_COLLECTIONS) {
      if (SKIP.has(name)) continue;
      if (await store.get(name)) continue; // 이미 자료가 있으면 건드리지 않음
      await store.set(name, []);
      emptied++;
    }
    if (!(await store.get(USERS_COLLECTION))) {
      const now = new Date().toISOString();
      await store.set(USERS_COLLECTION, [{
        id: "u_admin", loginId: process.env.ADMIN_ID ?? "admin", name: "관리자", team: "경영지원", role: "관리자",
        passwordHash: hashPassword(process.env.ADMIN_PASSWORD ?? "hyundam1234"), active: true, createdAt: now,
      }]);
    }
    applied.fresh = true;
    console.log(`[bootstrap] 예시 자료 없이 시작합니다 (${emptied}개 항목을 빈 목록으로).`);
  }

  settings.bootstrap = applied;
  await store.set("settings", settings);
}
