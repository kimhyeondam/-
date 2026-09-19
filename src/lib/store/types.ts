// 저장소 공통 규격: 이름(컬렉션)별로 JSON 하나를 통째로 읽고 씁니다.
export interface Store {
  get<T = unknown>(name: string): Promise<{ data: T; updatedAt: string } | null>;
  set<T = unknown>(name: string, data: T): Promise<void>;
  /** 읽고-고치고-쓰기를 한 묶음으로 (없으면 get+set 으로 대신) */
  update?<T = unknown>(name: string, fn: (prev: T | null) => T): Promise<void>;
}

/** 화면에서 읽고 쓸 수 있는 컬렉션 이름 (계정은 제외) */
export const DATA_COLLECTIONS = ["tasks", "events", "projects", "customers", "leads", "quotations", "revenues", "deposits", "resources", "assistantUsage", "businessCards", "purchases", "meetings", "documents", "settings", "suggestions", "contracts", "contractTemplates", "products", "stockMoves", "productions", "attendance", "materials", "materialMoves", "dispatches", "vehicles", "qualityTests", "payProfiles", "workers", "forecastMarks", "receipts"] as const;
export type DataCollection = (typeof DATA_COLLECTIONS)[number];
export const USERS_COLLECTION = "users";

export function isDataCollection(name: string): name is DataCollection {
  return (DATA_COLLECTIONS as readonly string[]).includes(name);
}
