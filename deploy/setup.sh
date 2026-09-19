#!/usr/bin/env bash
# 우분투 서버 첫 설치 스크립트: Docker 설치 → .env.production 만들기 → 앱 실행
# 사용법: bash deploy/setup.sh   (처음 실행하면 .env.production 을 만들어 주고 멈춤 → 값을 채운 뒤 한 번 더 실행)
set -e
if ! command -v docker >/dev/null 2>&1; then
  echo "▶ Docker 설치 중..."
  curl -fsSL https://get.docker.com | sh
fi
if [ ! -f .env.production ]; then
  cp .env.production.example .env.production
  sed -i "s/^AUTH_SECRET=.*/AUTH_SECRET=$(openssl rand -hex 32)/" .env.production
  echo "▶ .env.production 파일을 만들었습니다. DOMAIN 과 ADMIN_PASSWORD 를 꼭 수정하세요:  nano .env.production"
  echo "   (관급 발주를 쓰려면 DATA_GO_KR_KEY 도 넣으세요)  다 넣은 뒤 다시:  bash deploy/setup.sh"
  exit 0
fi
# 메모리가 2GB 미만인 작은 서버(예: 네이버클라우드 Micro 1GB)는 빌드 중 메모리가 모자랄 수 있어 스왑(임시 메모리) 2GB를 만들어 둡니다.
if [ ! -f /swapfile ] && [ "$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)" -lt 2000 ]; then
  echo "▶ 메모리가 적어 스왑 2GB를 만듭니다..."
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
mkdir -p data backups
# 프로그램은 컨테이너 안에서 제한된 사용자(uid 1001)로 실행되므로 데이터 폴더 소유권을 맞춰 줍니다.
chown -R 1001:1001 data backups
echo "▶ 앱을 빌드하고 실행합니다 (처음엔 5~10분 걸립니다)..."
docker compose up -d --build
echo "▶ 완료. 잠시 후 https://$(grep ^DOMAIN= .env.production | cut -d= -f2) 로 접속하세요."
echo "   상태 확인: docker compose ps   |  기록 보기: docker compose logs -f app"
