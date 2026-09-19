# 서버에 올리기 (배포 안내서)

직원들이 회사 밖과 휴대폰에서도 쓰려면 인터넷에 있는 서버 한 대에 프로그램을 올려야 합니다.
아래 순서대로 하면 됩니다. 처음 한 번만 하면 되고, 30분~1시간 정도 걸립니다.

> **용어 풀이**
> - **서버**: 24시간 켜져 있는 남의 컴퓨터를 월세로 빌리는 것. 프로그램을 여기 올려 두면 어디서나 접속됩니다.
> - **도메인**: `work.현담토목.co.kr` 같은 주소. 서버의 숫자 주소(IP) 대신 외우기 쉬운 이름입니다.
> - **Docker**: 프로그램과 실행에 필요한 것들을 한 상자에 담아 어느 서버에서나 똑같이 돌게 하는 도구. 설치 스크립트가 알아서 깝니다.

## 0. 준비물

| 준비물 | 설명 | 비용 |
|--------|------|------|
| 클라우드 서버 | 우분투(Ubuntu) 22.04 또는 24.04, 메모리 2GB 권장(1GB도 가능, 설치 스크립트가 스왑을 자동으로 만듭니다), 서울 또는 도쿄 리전 | 월 약 1만 2천 ~ 1만 7천 원 (예: Vultr 서울 2GB $12). 세금계산서가 필요하면 네이버클라우드·가비아 등 국내 업체(요금은 콘솔에서 확인) |
| 도메인(주소) | 예: `work.hyundam.co.kr`. 회사 도메인이 있으면 하위 주소를 하나 만들면 됩니다 | 있으면 무료, 없으면 연 1~2만 원 |
| 이 저장소 | GitHub 의 `kimhyeondam/-` (공개 저장소라 내려받는 데 출입증이 필요 없습니다) | - |

도메인이 아직 없으면 서버 IP 뒤에 `.sslip.io` 를 붙인 주소(예: `1.2.3.4.sslip.io`)로 우선 시작할 수 있습니다.

## 1. 서버 만들기

1. 클라우드 업체에 가입하고 **Ubuntu 24.04, 2GB** 서버를 서울(또는 도쿄) 리전에 만듭니다.
2. 만들 때 나오는 **서버 IP 주소**와 **root 비밀번호(또는 SSH 키)** 를 적어 둡니다.
3. 방화벽에서 **22, 80, 443** 포트를 열어 둡니다(대부분 기본으로 열려 있습니다).

제일이앤씨 서버가 이미 있더라도 **현담토목은 서버를 따로** 만드는 것을 권합니다. 한 서버에 두 개를 두면 포트가 겹치고 1GB 메모리로는 빠듯합니다.

## 2. 도메인을 서버에 연결

도메인 관리 화면(가비아·후이즈 등)에서 **A 레코드**를 추가합니다.

| 종류 | 이름 | 값 |
|------|------|----|
| A | work (원하는 이름) | 서버 IP 주소 |

10분~1시간 뒤 적용됩니다. `.sslip.io` 주소를 쓰면 이 단계는 건너뜁니다.

도메인을 두 개 이상 연결하려면 각 도메인에 같은 A 레코드를 넣고, `.env.production` 의 DOMAIN 에 쉼표로 이어 적은 뒤 `docker compose up -d` 를 실행합니다. 자물쇠는 주소마다 자동으로 발급됩니다.

```
DOMAIN=work.hyundam.co.kr, work.hyundam.com
```

## 3. 서버에 접속해 설치

윈도우는 **PowerShell**, 맥은 **터미널**을 열고 아래를 한 줄씩 입력합니다. (`서버IP` 는 1단계의 IP)

```bash
ssh root@서버IP
```

접속되면 서버 안에서:

```bash
apt update && apt install -y git
git clone -b claude/wizardly-bohr-cziiuw https://github.com/kimhyeondam/-.git hyundam
cd hyundam
bash deploy/setup.sh
```

> `-b claude/wizardly-bohr-cziiuw` 는 프로그램이 들어 있는 가지(브랜치)를 지정하는 부분입니다. 나중에 기본 가지(main)에 합치면 이 부분은 빼도 됩니다.

`.env.production` 파일이 만들어졌다는 안내가 나오면 값을 채웁니다:

```bash
nano .env.production
```

- `DOMAIN=` 뒤에 2단계 주소 (예: `work.hyundam.co.kr`)
- `ADMIN_PASSWORD=` 뒤에 관리자 비밀번호 (꼭 바꾸세요)
- `ANTHROPIC_API_KEY=` 뒤에 AI 키 (있으면. 현담비서·명함 인식·서류 사진 읽기에 씁니다)
- `DATA_GO_KR_KEY=` 뒤에 공공데이터포털 인증키 (관급 발주 현황을 쓰려면. 제일이앤씨 것을 같이 써도 됩니다)

회사 이름(현담토목·현담), 지역(전북), 예시 자료 없이 시작(FRESH_START=1)은 이미 들어 있습니다.
저장은 `Ctrl+O`, `Enter`, 나가기는 `Ctrl+X`. 그 다음 다시:

```bash
bash deploy/setup.sh
```

5~10분 뒤 `https://주소` 로 접속하면 로그인 화면이 나옵니다. 자물쇠(HTTPS)는 자동으로 붙습니다.

## 4. 첫 설정

1. `admin` / 3단계에서 정한 비밀번호로 로그인합니다. 브라우저 제목이 「현담토목 업무관리」, 비서 이름이 「현담비서」로 나오고 예시 자료는 없습니다.
2. **시스템 설정**에서 대표·사업자번호·주소·전화·입금 계좌·로고를 넣고 저장합니다. 견적서·거래명세표 머리글과 회사 소개 페이지(/company)에 그대로 쓰입니다.
3. **직원관리**에서 직원 계정을 만듭니다.
4. **재고관리 → 카탈로그 품목 불러오기**로 기본 규격표(흄관·PC맨홀·측구·집수정·경계석·옹벽블록)를 넣고, 단가와 안전재고를 채웁니다.
5. **영업 → 관급 발주**에서 「나라장터에서 가져오기」와 「지난 설계용역 가져오기」를 누르면 전북 자료가 채워집니다. 납품 현황은 조달데이터허브에서 전북으로 받은 CSV를 올립니다.
6. **메일관리**에서 업무용 네이버 메일을 연동합니다.
7. 직원들에게 주소와 계정을 전달합니다. 휴대폰은 브라우저(크롬·사파리)에서 주소를 연 뒤 **"홈 화면에 추가"** 를 누르면 앱처럼 쓸 수 있습니다.

## 5. 평소 운영

| 하고 싶은 일 | 명령 (서버 접속 후 `cd hyundam`) |
|--------------|-------------------------------|
| 상태 확인 | `docker compose ps` |
| 오류 기록 보기 | `docker compose logs -f app` |
| 새 버전 반영 | `bash deploy/update.sh` (완성품 내려받기 2~3분. 아래 「빠른 업데이트 준비」를 한 번 해 두어야 함) |
| 재시작 | `docker compose restart app` |
| 백업 파일 보기 | `ls backups/` (하루 한 번 자동, 30일 보관) |
| 백업으로 되돌리기 | `bash deploy/restore.sh backups/파일이름.tar.gz` |
| 백업을 내 PC로 내려받기 | 내 PC에서 `scp root@서버IP:/root/hyundam/backups/파일이름.tar.gz .` |

업무 데이터는 서버의 `hyundam/data` 폴더에 있습니다. 서버 업체의 스냅샷(서버 전체 백업) 기능도 함께 켜 두면 더 안전합니다.

## 5-1. 빠른 업데이트 준비 (한 번만)

코드를 깃허브에 올리면 깃허브가 자동으로 서버용 완성품(이미지 `ghcr.io/kimhyeondam/hyundam-app`)을 만들어 둡니다. 서버가 그 완성품을 내려받으려면 깃허브 "패키지 읽기" 출입증이 한 번 필요합니다.

1. 깃허브 → 오른쪽 위 프로필 → Settings → Developer settings → Personal access tokens → **Tokens (classic)** → Generate new token (classic)
2. Note: `hyundam-server-pull`, Expiration: 1년, 권한은 **read:packages** 하나만 체크 → Generate token → `ghp_…` 문자열 복사
3. 서버에서:

```bash
docker login ghcr.io -u kimhyeondam
```

Password 를 물으면 방금 복사한 `ghp_…` 를 붙여넣기(화면에 안 보임) → Enter. "Login Succeeded" 가 나오면 끝. 이후 `bash deploy/update.sh` 는 2~3분이면 끝납니다.

> 깃허브에서 처음 만들어진 완성품(패키지)은 비공개 상태입니다. 서버에서 내려받기가 안 되면 깃허브 → 프로필 → Packages → `hyundam-app` → Package settings 에서 이 저장소와 연결되어 있는지 확인하세요. 출입증이 없어도 `bash deploy/update.sh` 는 서버에서 직접 조립(40~50분)해서 동작합니다.

## 6. 문제가 생기면

- 접속이 안 됨: `docker compose ps` 에서 세 서비스(app, caddy, backup)가 `running` 인지 확인. 아니면 `docker compose up -d`.
- 자물쇠가 안 붙음: 도메인 A 레코드가 서버 IP를 가리키는지, 80/443 포트가 열렸는지 확인. `docker compose logs caddy`.
- 비밀번호를 잊음: `.env.production` 의 `ADMIN_PASSWORD` 는 **처음 실행 때만** 쓰입니다. 이후에는 다른 관리자가 직원관리에서 재설정하거나, `data/users.json` 을 지우면 다음 실행 때 관리자 계정이 다시 만들어집니다(직원 계정은 다시 등록해야 함).

## PostgreSQL 로 바꾸고 싶을 때

직원이 많아지거나 안정적인 백업이 필요하면 `.env.production` 에 `DATABASE_URL=postgres://...` 를 넣고 `docker compose up -d` 하면 됩니다. Supabase·Neon 무료 요금제로 시작할 수 있습니다. 기존 `data/*.json` 은 관리자에게 요청하면 옮겨 드립니다.
