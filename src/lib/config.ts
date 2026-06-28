/**
 * 환경변수 타입 안전 접근 모듈.
 * - 공개(NEXT_PUBLIC_*) 값과 서버 전용 값을 분리한다.
 * - 서버 전용 필수값은 "접근 시점"에 검증한다(임포트 시점에 throw 하지 않아
 *   빌드/클라이언트 번들에서 안전).
 */

/** 필수 서버 환경변수를 읽고, 없으면 명확한 에러를 던진다. */
export function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[config] 필수 환경변수 ${name} 가 설정되지 않았습니다. .env.local 을 확인하세요.`,
    );
  }
  return value;
}

/** 서버 전용 설정 (클라이언트 번들에 포함되지 않음) */
export const serverConfig = {
  /** 국토교통부 API 키 (필수) — 접근 시 검증 */
  get molitApiKey(): string {
    return requireServerEnv("MOLIT_API_KEY");
  },
  /** Redis 접속 URL (선택, 미설정 시 캐싱 비활성화) */
  redisUrl: process.env.REDIS_URL,
};

/** 공개 설정 (NEXT_PUBLIC_*, 클라이언트에서도 사용 가능) */
export const publicConfig = {
  /** AdSense 게시자 ID */
  adsenseClient:
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-XXXXXXXXXX",
  /** 사이트 기본 URL (canonical/OG 등에 사용) */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** Google Analytics 4 측정 ID (미설정 시 GA 비활성화) */
  gaId: process.env.NEXT_PUBLIC_GA_ID ?? "",
} as const;
