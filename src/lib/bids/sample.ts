// 인증키를 넣기 전에 화면 모양을 볼 수 있는 예시 공고. 실제 자료를 한 번 가져오면 사라집니다.
import type { BidNotice } from "./types";

const mk = (p: Partial<BidNotice> & Pick<BidNotice, "id" | "kind" | "title" | "demand" | "region" | "noticeAt" | "method">): BidNotice => ({
  no: p.id.split("-")[0], ord: "00", agency: p.demand, related: true, keywords: [], ...p,
});

export const sampleBids: BidNotice[] = [
  mk({ id: "S2026090101-00", kind: "공사", title: "○○지구 농로 및 용배수로 정비공사 (예시)", demand: "나주시", region: "나주시", noticeAt: "2026-09-10 09:00", closeAt: "2026-09-17 10:00", budget: 480000000, method: "제한경쟁", methodRaw: "제한경쟁", award: "적격심사", keywords: ["용배수로", "농로"] }),
  mk({ id: "S2026090102-00", kind: "물품", title: "우수관로 정비용 흄관 구매 (예시)", demand: "광주광역시 북구", region: "광주 북구", noticeAt: "2026-09-09 14:00", closeAt: "2026-09-16 10:00", budget: 62000000, method: "수의계약", methodRaw: "수의(소액)", keywords: ["흄관", "우수관"] }),
  mk({ id: "S2026090103-00", kind: "물품", title: "보도블록 및 경계석 구매 (예시)", demand: "전라남도 해남군", region: "해남군", noticeAt: "2026-09-08 11:00", closeAt: "2026-09-15 10:00", budget: 38000000, method: "수의계약", methodRaw: "수의(소액)", keywords: ["보도블록", "경계석"] }),
  mk({ id: "S2026090104-00", kind: "공사", title: "△△마을 배수로 개선공사 (예시)", demand: "전라남도 영암군", region: "영암군", noticeAt: "2026-09-07 10:00", closeAt: "2026-09-14 10:00", budget: 150000000, method: "일반경쟁", methodRaw: "일반경쟁", award: "적격심사", keywords: ["배수로"] }),
  mk({ id: "S2026090105-00", kind: "물품", title: "맨홀 및 PC암거 구매 설치 (예시)", demand: "전라남도 (도로과)", region: "통합시 전남청사", noticeAt: "2026-09-06 15:00", closeAt: "2026-09-20 10:00", budget: 210000000, method: "제한경쟁", methodRaw: "제한경쟁", keywords: ["맨홀", "암거"] }),
  mk({ id: "S2026090106-00", kind: "용역", title: "□□초등학교 운동장 배수 정비 (예시)", demand: "전라남도목포교육지원청", region: "교육청", noticeAt: "2026-09-05 09:30", closeAt: "2026-09-12 10:00", budget: 27000000, method: "수의계약", methodRaw: "수의(총액)", keywords: ["배수"] }),
];
