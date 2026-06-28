import axios, { AxiosError } from "axios";
import { XMLParser } from "fast-xml-parser";
import { serverConfig } from "@/lib/config";

/**
 * K-apt(공동주택관리정보시스템) 단지 메타데이터 연동 모듈.
 * - 국토부 실거래가에는 없는 "세대수/동수/준공/난방/유형" 등 단지 기본정보를 보강한다.
 * - 두 서비스를 조합한다:
 *   1) 시군구 단지목록(AptListService3) — 단지명 → kaptCode 매핑
 *   2) 공동주택 기본정보(AptBasisInfoServiceV4) — kaptCode → 세대수/동수 등
 * - 두 서비스 모두 data.go.kr 인증키(MOLIT 키와 동일)를 사용한다.
 *
 * ⚠️ 기본정보는 반드시 V4 엔드포인트를 사용한다.
 *    (V1~V3 및 1611000 조직코드는 폐기되어 HTTP 500 "Unexpected errors" 를 반환)
 */

/** 시군구 단지목록 엔드포인트 (V3) */
const LIST_ENDPOINT =
  "https://apis.data.go.kr/1613000/AptListService3/getSigunguAptList3";

/** 공동주택 기본정보 엔드포인트 (V4 — 필수) */
const BASIS_ENDPOINT =
  "https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4";

/** data.go.kr WAF 차단 회피용 브라우저 User-Agent */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/** 요청 타임아웃 (6초) */
const TIMEOUT_MS = 6_000;

/** 단지목록 1회 조회 건수 (시군구당 단지 수를 충분히 덮는 크기) */
const LIST_NUM_OF_ROWS = 3_000;

/** 캐시 유효시간 (12시간) — 단지 기본정보는 거의 바뀌지 않는다 */
const CACHE_TTL_MS = 12 * 60 * 60 * 1_000;

/** 값은 항상 문자열로 유지하는 XML 파서 */
const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
});

/** 단지목록 항목 (단지명 → kaptCode 매핑용) */
export interface KaptListItem {
  readonly kaptCode: string;
  readonly kaptName: string;
  /** 법정동명 (예: "대치동") */
  readonly dong: string;
}

/** 화면 표시용 단지 메타데이터 */
export interface AptMeta {
  readonly kaptCode: string;
  readonly kaptName: string;
  /** 세대수 */
  readonly householdCount: number;
  /** 동수 */
  readonly dongCount: number;
  /** 최고층 */
  readonly topFloor: number;
  /** 준공연도 (사용승인일 기준, 0이면 미상) */
  readonly buildYear: number;
  /** 사용승인일 (예: "1979.08.30", 없으면 빈 문자열) */
  readonly useApprovalDate: string;
  /** 난방방식 (예: "지역난방") */
  readonly heatType: string;
  /** 단지 유형 (예: "아파트", "주상복합") */
  readonly aptType: string;
  /** 복도 유형 (예: "복도식", "계단식") */
  readonly hallType: string;
  /** 도로명주소 (없으면 빈 문자열) */
  readonly roadAddress: string;
}

/* ───────────────────────── 모듈 캐시 ───────────────────────── */

interface CacheEntry<T> {
  readonly at: number;
  readonly data: T;
}

/** 시군구 단지목록 캐시 (sigunguCode → 목록) */
const listCache = new Map<string, CacheEntry<KaptListItem[]>>();
/** 기본정보 캐시 (kaptCode → 메타) */
const metaCache = new Map<string, CacheEntry<AptMeta | null>>();
/** 단지명 해석 결과 캐시 (sigunguCode|dong|aptName → 메타, 못 찾은 경우 null) */
const lookupCache = new Map<string, CacheEntry<AptMeta | null>>();

/** 캐시 유효성 판정 */
function isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return entry !== undefined && Date.now() - entry.at < CACHE_TTL_MS;
}

/* ───────────────────────── HTTP ───────────────────────── */

/** K-apt 엔드포인트에 XML 요청 (실패 시 빈 문자열) */
async function requestXml(
  endpoint: string,
  params: Record<string, string | number>,
): Promise<string> {
  try {
    const { data } = await axios.get<string>(endpoint, {
      params: { serviceKey: serverConfig.molitApiKey, ...params },
      headers: { "User-Agent": USER_AGENT, Accept: "application/xml" },
      timeout: TIMEOUT_MS,
      responseType: "text",
    });
    return data;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.warn(
      `[kapt] 요청 실패 (${endpoint}):`,
      axiosError.message ?? axiosError,
    );
    return "";
  }
}

/**
 * 파싱된 result.response(배열/객체) 중 body 를 가진 요소의 body 를 반환.
 * - K-apt 응답은 response 가 [{body}, {header}] 형태의 배열로 내려온다.
 */
function extractBody(xml: string): Record<string, unknown> | null {
  if (!xml) return null;
  let parsed: unknown;
  try {
    parsed = xmlParser.parse(xml);
  } catch (error) {
    console.warn("[kapt] XML 파싱 실패:", error);
    return null;
  }
  const result = (parsed as { result?: { response?: unknown } }).result;
  if (!result) return null;
  const responses = Array.isArray(result.response)
    ? result.response
    : [result.response];
  for (const r of responses) {
    const body = (r as { body?: unknown })?.body;
    if (body && typeof body === "object") return body as Record<string, unknown>;
  }
  return null;
}

/** 문자열 안전 추출 */
function str(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return v === undefined || v === null ? "" : String(v).trim();
}

/** "4424.0" 같은 실수 표기 문자열 → 정수 (없으면 0) */
function toInt(value: string): number {
  const n = Math.round(Number.parseFloat(value));
  return Number.isFinite(n) ? n : 0;
}

/* ───────────────────────── 단지목록 ───────────────────────── */

/**
 * 시군구 단지목록을 조회한다(캐시 적용).
 * @param sigunguCode 법정동 시군구 코드 5자리 (= 실거래가 LAWD_CD)
 */
export async function fetchSigunguAptList(
  sigunguCode: string,
): Promise<KaptListItem[]> {
  const cached = listCache.get(sigunguCode);
  if (isFresh(cached)) return cached.data;

  const xml = await requestXml(LIST_ENDPOINT, {
    sigunguCode,
    pageNo: 1,
    numOfRows: LIST_NUM_OF_ROWS,
  });
  const body = extractBody(xml);
  const rawItems = body?.items;
  const arr = Array.isArray(rawItems)
    ? rawItems
    : rawItems
      ? [rawItems]
      : [];

  const list: KaptListItem[] = arr.map((it) => {
    const o = it as Record<string, unknown>;
    return {
      kaptCode: str(o, "kaptCode"),
      kaptName: str(o, "kaptName"),
      dong: str(o, "as3"),
    };
  });

  listCache.set(sigunguCode, { at: Date.now(), data: list });
  return list;
}

/* ───────────────────────── 기본정보 ───────────────────────── */

/**
 * kaptCode 로 단지 기본정보를 조회한다(캐시 적용).
 * @returns 메타데이터 (조회 실패/무결과 시 null)
 */
export async function fetchAptBasisInfo(
  kaptCode: string,
): Promise<AptMeta | null> {
  if (!kaptCode) return null;
  const cached = metaCache.get(kaptCode);
  if (isFresh(cached)) return cached.data;

  const xml = await requestXml(BASIS_ENDPOINT, { kaptCode });
  const body = extractBody(xml);
  const item = body?.item as Record<string, unknown> | undefined;

  let meta: AptMeta | null = null;
  if (item && str(item, "kaptCode")) {
    const useDate = str(item, "kaptUsedate"); // YYYYMMDD
    const buildYear =
      useDate.length >= 4 ? Number.parseInt(useDate.slice(0, 4), 10) || 0 : 0;
    const useApprovalDate =
      useDate.length === 8
        ? `${useDate.slice(0, 4)}.${useDate.slice(4, 6)}.${useDate.slice(6, 8)}`
        : "";

    meta = {
      kaptCode: str(item, "kaptCode"),
      kaptName: str(item, "kaptName"),
      householdCount: toInt(str(item, "kaptdaCnt")),
      dongCount: toInt(str(item, "kaptDongCnt")),
      topFloor: toInt(str(item, "kaptTopFloor")),
      buildYear,
      useApprovalDate,
      heatType: str(item, "codeHeatNm"),
      aptType: str(item, "codeAptNm"),
      hallType: str(item, "codeHallNm"),
      roadAddress: str(item, "doroJuso"),
    };
  }

  metaCache.set(kaptCode, { at: Date.now(), data: meta });
  return meta;
}

/* ───────────────────────── 이름 매칭 ───────────────────────── */

/** 단지명 비교용 정규화 (공백/괄호/구분기호/"아파트" 접미사 제거) */
function normalizeName(name: string): string {
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/아파트$/, "")
    .replace(/[\s·.\-_]/g, "")
    .toLowerCase();
}

/** 후보 목록에서 단지명이 가장 잘 맞는 항목을 찾는다 */
function findBestMatch(
  candidates: KaptListItem[],
  aptName: string,
): KaptListItem | null {
  const q = normalizeName(aptName);
  if (!q) return null;

  // 1) 정규화 정확 일치
  const exact = candidates.find((c) => normalizeName(c.kaptName) === q);
  if (exact) return exact;

  // 2) 부분 일치(한쪽이 다른 쪽을 포함) — 이름 길이 차가 가장 작은 후보 선택
  const partial = candidates
    .map((c) => ({ c, n: normalizeName(c.kaptName) }))
    .filter(({ n }) => n.length > 1 && (n.includes(q) || q.includes(n)))
    .sort(
      (a, b) =>
        Math.abs(a.n.length - q.length) - Math.abs(b.n.length - q.length),
    );
  return partial[0]?.c ?? null;
}

/**
 * 실거래가 단지명(+법정동)으로 K-apt 단지 메타데이터를 해석한다.
 * - 시군구 단지목록에서 단지명을 매칭해 kaptCode 를 찾고, 기본정보를 조회한다.
 * - 결과(못 찾은 null 포함)를 캐시한다.
 * @param sigunguCode 시군구 코드 5자리 (= 실거래가 LAWD_CD)
 * @param aptName 실거래가 단지명
 * @param dong 법정동명(선택) — 동명으로 후보를 좁혀 매칭 정확도를 높인다
 */
export async function fetchAptMeta(
  sigunguCode: string,
  aptName: string,
  dong?: string,
): Promise<AptMeta | null> {
  const cacheKey = `${sigunguCode}|${dong ?? ""}|${aptName}`;
  const cached = lookupCache.get(cacheKey);
  if (isFresh(cached)) return cached.data;

  const list = await fetchSigunguAptList(sigunguCode);

  // 동명으로 후보를 좁히되, 동명 일치가 없으면 시군구 전체에서 매칭
  const narrowed = dong ? list.filter((c) => c.dong === dong) : list;
  const pool = narrowed.length > 0 ? narrowed : list;

  const matched = findBestMatch(pool, aptName);
  const meta = matched ? await fetchAptBasisInfo(matched.kaptCode) : null;

  lookupCache.set(cacheKey, { at: Date.now(), data: meta });
  return meta;
}
