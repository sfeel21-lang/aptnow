# AptNow — 아파트 실거래가 조회 서비스

국토교통부 공식 실거래가 데이터로 전국 아파트 매매 실거래가를 빠르게 조회하는 서비스입니다.

- **프로덕션**: https://apt.healthfy.com
- **데이터 출처**: 국토교통부 실거래가 공개시스템

---

## 기술 스택

| 구분 | 사용 기술 |
|------|-----------|
| Framework | Next.js 14 (App Router, `src` 디렉토리) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| HTTP | axios |
| Cache | ioredis (Redis, 선택) |
| XML 파싱 | fast-xml-parser |
| 가상 스크롤 | react-window |
| Analytics / 광고 | @vercel/analytics, Google AdSense |
| 배포 | AWS EC2 + PM2 + Nginx |

---

## 사전 요구사항

- Node.js **18.18 이상** (권장: LTS)
- npm 9 이상
- (선택) Redis 6 이상 — 캐싱 사용 시
- 국토교통부 실거래가 API 키 — [공공데이터포털](https://www.data.go.kr) 에서 발급

---

## 로컬 개발

```bash
# 1) 의존성 설치
npm install

# 2) 환경변수 설정 (.env.example 복사 후 값 입력)
cp .env.example .env.local

# 3) 개발 서버 실행 (http://localhost:3000)
npm run dev
```

### 환경 변수 (.env.local)

| 변수 | 필수 | 설명 |
|------|:---:|------|
| `MOLIT_API_KEY` | ✅ | 국토교통부 API **일반 인증키(Decoding)** |
| `REDIS_URL` | ⛔ | Redis 접속 URL. 미설정 시 캐싱 비활성화 |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | ⛔ | AdSense 게시자 ID (`ca-pub-...`) |
| `NEXT_PUBLIC_SITE_URL` | ⛔ | 사이트 기본 URL (canonical/OG 용) |

> ⚠️ `MOLIT_API_KEY`는 **Decoding 키**를 넣어야 합니다(코드에서 자동 인코딩).
> 또한 발급키가 등록된 API(운영용 `RTMSDataSvcAptTrade`)와 코드의 엔드포인트가 일치해야 합니다.

### 주요 스크립트

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버 (빌드 후)
npm run lint         # ESLint
npm run type-check   # 타입 검사 (tsc --noEmit)
```

---

## 디렉토리 구조

```
src/
├── app/
│   ├── layout.tsx                  # 루트 레이아웃 (Header/Footer, AdSense, 메타)
│   ├── page.tsx                    # 메인(랜딩) — SSR 신고가/인기지역
│   ├── [sido]/[gugun]/             # 지역별 실거래가 (page/loading/error)
│   ├── search/page.tsx             # 단지 검색 결과
│   └── api/
│       ├── deals/route.ts          # 지역 실거래가 API (캐시)
│       └── search/route.ts         # 단지 검색 API
├── components/
│   ├── ui/        # Container, AdSlot, SearchBar
│   ├── layout/    # Header, Footer
│   └── deals/     # DealTable, DealCard, RegionSelector, CopyButton, DealResults
├── lib/
│   ├── api/molit.ts                # 국토부 API 클라이언트
│   ├── cache/redis.ts              # Redis 캐시(폴백)
│   ├── deals/analysis.ts           # 신고가 계산
│   ├── data/apartments.ts          # 단지 인덱스 + 검색
│   ├── constants/                  # 지역코드/사이트 상수
│   ├── utils/                      # cn, format
│   └── config.ts                   # 환경변수 타입 안전 접근
└── types/index.ts                  # 전역 타입
```

---

## AWS EC2 배포

### 1) 서버 준비 (최초 1회)

```bash
# Node.js, PM2, Nginx 설치 후
sudo apt update
sudo npm install -g pm2

# 코드 클론 + 환경변수 설정
git clone <repo-url> aptnow && cd aptnow
cp .env.example .env.local   # 값 입력 (MOLIT_API_KEY 등)

# 빌드 + PM2 최초 기동 (클러스터 2 인스턴스)
npm ci
npm run build
pm2 start ecosystem.config.js
pm2 save           # 프로세스 목록 저장
pm2 startup        # 재부팅 시 자동 기동 등록 (안내 명령 실행)
```

### 2) Nginx + SSL

```bash
# Nginx 설정 배치
sudo cp nginx/apt.healthfy.com.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/apt.healthfy.com.conf /etc/nginx/sites-enabled/

# SSL 인증서 발급 (certbot)
sudo certbot --nginx -d apt.healthfy.com

# 문법 검사 후 반영
sudo nginx -t && sudo systemctl reload nginx
```

> 기존 `www.healthfy.com`(WordPress, 80포트)와는 `server_name` 으로 분리되어 충돌하지 않습니다.

### 3) 이후 배포 (코드 갱신)

```bash
bash scripts/deploy.sh
# = git pull → npm ci → npm run build → pm2 reload aptnow (무중단)
```

---

## 운영 메모

- `pm2 logs aptnow` — 실시간 로그
- `pm2 reload aptnow` — 무중단 재기동
- Redis 캐싱을 켜려면 `.env.local` 의 `REDIS_URL` 주석을 해제하고 Redis 서버를 실행하세요.
- 광고 노출은 `NEXT_PUBLIC_ADSENSE_CLIENT` 를 실제 게시자 ID로 교체하고 프로덕션 빌드 후 동작합니다.
