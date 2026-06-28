#!/bin/bash
# ============================================================
#  AptNow 재배포 스크립트 (Lightsail/EC2 서버에서 실행)
#  사용: bash scripts/deploy.sh
#  - 최초 1회 서버 셋업은 scripts/setup-server.sh 참고
# ============================================================

# 하나라도 실패하면 즉시 중단
set -euo pipefail

echo "▶ [1/5] 최신 코드 가져오기 (git pull)"
git pull origin main

# ⚠️ 빌드에는 devDependencies(typescript, tailwindcss 등)가 필요하므로
#    '--production' 으로 설치하면 next build 가 실패합니다. 전체 의존성을 설치합니다.
echo "▶ [2/5] 의존성 설치 (npm ci)"
npm ci

echo "▶ [3/5] 프로덕션 빌드 (npm run build)"
npm run build

echo "▶ [4/5] 로그 디렉토리 준비 (PM2 로그 출력 경로)"
mkdir -p logs

echo "▶ [5/5] 무중단 재기동 (없으면 최초 기동)"
# 이미 떠 있으면 reload(무중단), 아니면 start 로 최초 기동
pm2 reload aptnow 2>/dev/null || pm2 start ecosystem.config.js
pm2 save

echo "✅ 배포 완료"
