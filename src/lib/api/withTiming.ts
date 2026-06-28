import { type NextRequest, type NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/** 느린 응답 경고 임계치(ms) */
const SLOW_MS = 3_000;

/** API Route 핸들러 시그니처 */
type RouteHandler = (request: NextRequest) => Promise<NextResponse>;

/**
 * API 응답시간 로깅 래퍼(미들웨어).
 * - 처리 시간을 측정해 로깅하고, 3초 초과 시 경고를 남긴다.
 * @param name 로그 식별용 라우트 이름
 * @param handler 실제 라우트 핸들러
 */
export function withTiming(name: string, handler: RouteHandler): RouteHandler {
  return async (request: NextRequest): Promise<NextResponse> => {
    const start = Date.now();
    try {
      const response = await handler(request);
      const elapsed = Date.now() - start;
      if (elapsed > SLOW_MS) {
        logger.warn(`[api:${name}] 느린 응답 ${elapsed}ms (${request.nextUrl.search})`);
      } else {
        logger.debug(`[api:${name}] ${elapsed}ms`);
      }
      return response;
    } catch (error) {
      logger.error(`[api:${name}] 처리 실패 (${Date.now() - start}ms):`, error);
      throw error;
    }
  };
}
