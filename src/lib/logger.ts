/**
 * 환경별 로거.
 * - 개발: 모든 레벨 출력
 * - 프로덕션: 경고/에러만 출력 (debug/info 는 무시)
 */

const isProd = process.env.NODE_ENV === "production";

export const logger = {
  /** 상세 디버그 (개발 전용) */
  debug(...args: unknown[]): void {
    if (!isProd) console.log("[debug]", ...args);
  },
  /** 일반 정보 (개발 전용) */
  info(...args: unknown[]): void {
    if (!isProd) console.info("[info]", ...args);
  },
  /** 경고 (항상) */
  warn(...args: unknown[]): void {
    console.warn("[warn]", ...args);
  },
  /** 에러 (항상) */
  error(...args: unknown[]): void {
    console.error("[error]", ...args);
  },
} as const;
