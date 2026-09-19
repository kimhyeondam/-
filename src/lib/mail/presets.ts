// 브라우저에서도 쓰는 메일 관련 정의 (서버 전용 코드 없음)
export type MailProvider = "naver" | "gmail" | "daum" | "custom";

export interface PublicMailAccount {
  id: string;
  label: string;
  email: string;
  provider: MailProvider;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  ownerId: string;
  shared: boolean;
  createdAt: string;
}

export const providerPresets: Record<MailProvider, { name: string; imapHost: string; imapPort: number; smtpHost: string; smtpPort: number; help: string }> = {
  naver: { name: "네이버 메일", imapHost: "imap.naver.com", imapPort: 993, smtpHost: "smtp.naver.com", smtpPort: 465, help: "네이버 메일 → 환경설정 → POP3/IMAP 설정에서 IMAP 사용을 켜세요. 2단계 인증을 쓰면 '애플리케이션 비밀번호'를 발급해 넣습니다. 아이디는 @naver.com 앞부분입니다." },
  gmail: { name: "지메일", imapHost: "imap.gmail.com", imapPort: 993, smtpHost: "smtp.gmail.com", smtpPort: 465, help: "구글 계정 → 보안 → 2단계 인증 켜기 → '앱 비밀번호' 발급 후 그 비밀번호를 넣습니다. 아이디는 전체 이메일 주소입니다." },
  daum: { name: "다음 메일", imapHost: "imap.daum.net", imapPort: 993, smtpHost: "smtp.daum.net", smtpPort: 465, help: "다음 메일 → 설정 → IMAP/POP3에서 IMAP 사용을 켜세요. 아이디는 전체 이메일 주소입니다." },
  custom: { name: "직접 입력", imapHost: "", imapPort: 993, smtpHost: "", smtpPort: 465, help: "회사 메일 서버 담당자에게 IMAP/SMTP 주소와 포트를 확인하세요." },
};
