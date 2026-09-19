#!/bin/sh
# 매일 data 폴더를 압축해 backups/ 에 저장하고, 30일 지난 백업은 지웁니다. (docker compose 의 backup 서비스가 실행)
while true; do
  now=$(date +%Y%m%d-%H%M)
  tar czf "/backups/jeil-data-$now.tar.gz" -C /data --exclude=./photos . && echo "backup $now"
  # 납품 사진은 용량이 커서 매일 압축하지 않고, 새로 생긴 파일만 한 벌 복사해 둡니다 (3년 보관 후 자동 정리)
  if [ -d /data/photos ]; then mkdir -p /backups/photos && cp -ru /data/photos/. /backups/photos/ 2>/dev/null; fi
  find /backups -name 'jeil-data-*.tar.gz' -mtime +30 -delete
  sleep 86400
done
