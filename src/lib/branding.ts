// 회사 정보(상호·대표·로고 등): 시스템 설정에 저장된 값이 있으면 그것을, 없으면 기본값을 씁니다.
import { getStore } from "@/lib/store";
import { companyProfile as defaults, company as sampleCompany, type CompanyProfile } from "@/data/sample";
import type { Brand } from "@/lib/brand";

export async function loadCompany(): Promise<CompanyProfile> {
  try {
    const row = await getStore().get<{ company?: Partial<CompanyProfile> }>("settings");
    const saved = row?.data?.company ?? {};
    const merged = { ...defaults, ...saved };
    // 다른 회사 이름으로 바꿨는데 로고를 따로 올리지 않았다면 기본(현담토목) 로고는 쓰지 않습니다
    if (saved.name && saved.name.trim() !== defaults.name) {
      if (!saved.logo || saved.logo === defaults.logo) merged.logo = undefined;
      if (!saved.logoMark || saved.logoMark === defaults.logoMark) merged.logoMark = undefined;
    }
    return merged;
  } catch {
    return defaults;
  }
}

/** 회사 정보에서 화면용 이름 묶음(상호·약칭·비서 이름·호칭)을 만듭니다 */
export function brandOf(c: CompanyProfile): Brand {
  const shortName = (c.shortName ?? "").trim() || (c.name === sampleCompany.name ? sampleCompany.shortName : c.name.replace(/\(주\)|㈜|주식회사|\s/g, "").slice(0, 2));
  return { name: c.name, shortName, assistantName: `${shortName}비서`, ownerName: (c.ownerName ?? "").trim() || sampleCompany.ownerName };
}
