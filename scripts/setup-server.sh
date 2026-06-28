#!/bin/bash
# ============================================================
#  AptNow 서버 최초 셋업 (AWS Lightsail / Ubuntu 22.04+)
#  - Node 20 LTS + PM2 + Nginx 설치, 앱 클론·빌드·기동, 리버스 프록시 설정
#  - SSH 로 서버에 접속한 뒤 이 스크립트를 한 번만 실행합니다.
#
#  실행 전 아래 3개 변수를 본인 값으로 수정하세요.
# ============================================================
set -euo pipefail

# ── 사용자 설정 ───────────────────────────────────────────
REPO_URL="https://github.com/sfeel21-lang/aptnow.git"  # GitHub 저장소 주소
DOMAIN="apt.healthfy.kr"                                # 서비스 도메인
APP_DIR="$HOME/aptnow"                                  # 배포 경로
# ─────────────────────────────────────────────────────────

echo "▶ [1/8] 시스템 패키지 업데이트"
sudo apt-get update -y

echo "▶ [2/8] 스왑 2GB 생성 (빌드 OOM 방지 — 메모리 1GB 이하 인스턴스 필수)"
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "▶ [3/8] Node.js 20 LTS 설치"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

echo "▶ [4/8] PM2 · Nginx 설치"
sudo npm install -g pm2
sudo apt-get install -y nginx

echo "▶ [5/8] 소스 클론 + 의존성 + 빌드"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# 환경변수 파일 (.env.local) — 없으면 템플릿 생성 후 중단(값 입력 필요)
if [ ! -f .env.local ]; then
  cat > .env.local <<EOF
MOLIT_API_KEY=여기에_국토부_API_키
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXX
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
NEXT_PUBLIC_GA_ID=
EOF
  echo "⚠️  .env.local 템플릿을 생성했습니다. 값을 채운 뒤 이 스크립트를 다시 실행하세요:"
  echo "    nano $APP_DIR/.env.local"
  exit 1
fi

npm ci
npm run build
mkdir -p logs

echo "▶ [6/8] PM2 기동 + 부팅 자동시작 등록"
pm2 start ecosystem.config.js || pm2 reload aptnow
pm2 save
# 부팅 시 자동 기동 (출력되는 sudo 명령을 그대로 한 번 실행해야 함)
pm2 startup systemd -u "$USER" --hp "$HOME" | tail -n 1 | bash || true

echo "▶ [7/8] Nginx 리버스 프록시 설정 (80 → 127.0.0.1:3000)"
sudo tee /etc/nginx/sites-available/aptnow >/dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # 정적 자원 캐시 (Next 빌드 산출물)
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/aptnow /etc/nginx/sites-enabled/aptnow
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "▶ [8/8] HTTPS 발급 (Let's Encrypt)"
echo "  도메인($DOMAIN) DNS A레코드가 이 서버 고정 IP를 가리키는지 확인 후 아래를 실행하세요:"
echo "    sudo apt-get install -y certbot python3-certbot-nginx"
echo "    sudo certbot --nginx -d $DOMAIN --redirect"

echo "✅ 셋업 완료 — http://$DOMAIN (HTTPS는 위 certbot 실행 후)"
