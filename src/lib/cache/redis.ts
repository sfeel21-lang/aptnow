import Redis from "ioredis";
import { serverConfig } from "@/lib/config";

/**
 * Redis 캐시 모듈.
 * - REDIS_URL 환경변수가 없으면 캐싱을 비활성화한다(개발 환경 대응).
 * - Redis 장애 시에도 예외를 던지지 않고 null 반환/무동작으로 폴백해
 *   API 직접 호출로 자연스럽게 이어지도록 한다.
 */

/** Redis 클라이언트 (지연 초기화, 모듈 전역 1회 생성) */
let client: Redis | null = null;
/** 초기화 시도 여부 (재시도 방지) */
let initialized = false;

/**
 * Redis 클라이언트를 반환한다. REDIS_URL 미설정/초기화 실패 시 null.
 */
function getRedis(): Redis | null {
  if (initialized) return client;
  initialized = true;

  const url = serverConfig.redisUrl;
  if (!url) {
    // 개발 환경 등 캐시 미사용 — 조용히 비활성화
    console.info("[redis] REDIS_URL 미설정 — 캐싱을 건너뜁니다.");
    return null;
  }

  try {
    client = new Redis(url, {
      // 요청 단위로 빠르게 실패시켜 폴백이 지연되지 않도록 설정
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 3_000,
    });
    // 연결 오류는 경고만 남기고 폴백 (앱 크래시 방지)
    client.on("error", (error: Error) => {
      console.warn("[redis] 연결 오류:", error.message);
    });
  } catch (error) {
    console.warn("[redis] 초기화 실패 — 캐싱 비활성화:", error);
    client = null;
  }
  return client;
}

/**
 * 캐시에서 값을 조회한다.
 * @param key 캐시 키
 * @returns 파싱된 값 (미스/장애 시 null)
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    console.warn("[redis] 조회 실패 — 폴백:", error);
    return null;
  }
}

/**
 * 캐시에 값을 저장한다(TTL 적용).
 * @param key 캐시 키
 * @param value 저장할 값 (JSON 직렬화)
 * @param ttlSeconds 만료 시간(초)
 */
export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    console.warn("[redis] 저장 실패 — 무시:", error);
  }
}

/**
 * 카운터를 1 증가시키고 증가 후 값을 반환한다(최초 생성 시 TTL 설정).
 * - Redis 미사용/장애 시 null 반환(호출부에서 폴백).
 * @param key 카운터 키
 * @param ttlSeconds 최초 생성 시 만료 시간(초)
 */
export async function incrCounter(
  key: string,
  ttlSeconds: number,
): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const value = await redis.incr(key);
    if (value === 1) await redis.expire(key, ttlSeconds);
    return value;
  } catch (error) {
    console.warn("[redis] 카운터 증가 실패:", error);
    return null;
  }
}
