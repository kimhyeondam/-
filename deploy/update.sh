#!/usr/bin/env bash
# 새 버전 반영 (데이터는 그대로 유지)
# - 깃허브가 미리 만든 완성품(이미지)을 내려받아 2~3분 안에 교체합니다.
# - 완성품을 받을 수 없으면(로그인 안 됨 등) 서버에서 직접 조립합니다 (40~50분).
set -e
git pull
echo "▶ 새 완성품(이미지)을 내려받는 중… (2~3분, 아래 진행 표시가 끝날 때까지 기다리세요)"
if docker compose pull app; then
  docker compose up -d
else
  echo "▶ 완성품을 내려받지 못해 서버에서 직접 조립합니다. (docker login ghcr.io 를 하면 다음부터 빨라집니다)"
  docker compose up -d --build
fi
docker image prune -f >/dev/null
echo "▶ 업데이트 완료"
