#!/usr/bin/env bash
# 백업 복구: bash deploy/restore.sh backups/jeil-data-20260909-0300.tar.gz
set -e
[ -f "$1" ] || { echo "사용법: bash deploy/restore.sh <백업파일.tar.gz>"; exit 1; }
docker compose stop app
# 복구 전 지금 데이터를 한 번 더 묶어 둡니다 (복구가 잘못되면 이 파일로 되돌릴 수 있습니다)
mkdir -p backups data && tar czf "backups/before-restore-$(date +%Y%m%d-%H%M).tar.gz" -C data . 2>/dev/null || true
tar xzf "$1" -C data && chown -R 1001:1001 data
docker compose start app
echo "▶ 복구 완료: $1"
