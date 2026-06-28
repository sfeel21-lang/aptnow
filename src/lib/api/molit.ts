import axios, { AxiosError } from "axios";
import { XMLParser } from "fast-xml-parser";
import {
  calculatePyeong,
  formatAmountKorean,
  parseAmount,
} from "@/lib/utils/format";
import { resolvePyeong } from "@/lib/data/pyeongIndex";
import { serverConfig } from "@/lib/config";
import type { AptDeal, MolitAptDealRaw } from "@/types";

// 포맷 유틸을 molit 공개 API 로도 재노출 (기존 import 경로 호환)
export { parseAmount, formatAmountKorean, calculatePyeong };

/**
 * 국토교통부 아파트 매매 실거래가 API 연동 모듈.
 * - XML 응답을 파싱해 화면 표시용 AptDeal[] 로 변환한다.
 * - 가격/면적/날짜 등 원본 문자열을 숫자 및 표기 문자열로 정규화한다.
 */

/** 아파트 매매 실거래가 공개 자료 엔드포인트 (운영) */
const ENDPOINT =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";

/**
 * 요청 User-Agent.
 * - data.go.kr WAF 가 비브라우저 UA(axios 기본값 등)를 차단하므로 브라우저 UA 를 명시한다.
 */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/** 요청 타임아웃 (5초) */
const TIMEOUT_MS = 5_000;

/** 한 페이지 조회 건수 */
const NUM_OF_ROWS = 100;

/** 정상 응답 결과코드 */
const SUCCESS_CODE = "000";

/** XML 파서 인스턴스 (값은 항상 문자열로 유지) */
const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
});

/** 파싱된 응답에서 item 목록을 안전하게 배열로 추출하기 위한 내부 타입 */
interface ParsedMolitResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      items?: { item?: unknown } | "" | null;
      totalCount?: string;
    };
  };
}

/** 단일 원본 항목을 MolitAptDealRaw 로 안전 변환 (누락 필드는 빈 문자열) */
function toRaw(item: Record<string, unknown>): MolitAptDealRaw {
  const get = (key: string): string => {
    const value = item[key];
    return value === undefined || value === null ? "" : String(value);
  };
  return {
    aptNm: get("aptNm"),
    dealAmount: get("dealAmount"),
    excluUseAr: get("excluUseAr"),
    floor: get("floor"),
    dealYear: get("dealYear"),
    dealMonth: get("dealMonth"),
    dealDay: get("dealDay"),
    umdNm: get("umdNm"),
    jibun: get("jibun"),
    buildYear: get("buildYear"),
    roadNm: get("roadNm"),
    rgstDate: get("rgstDate"),
  };
}

/**
 * MolitAptDealRaw 원본을 화면 표시용 AptDeal 로 정규화.
 * @param lawdCd 법정동 시군구 코드 — 건축물대장 기반 평형 인덱스 조회에 사용
 */
function toAptDeal(raw: MolitAptDealRaw, lawdCd: string): AptDeal {
  const amount = parseAmount(raw.dealAmount);
  const area = Number.parseFloat(raw.excluUseAr) || 0;
  const floor = Number.parseInt(raw.floor, 10) || 0;
  const buildYear = Number.parseInt(raw.buildYear, 10) || 0;
  const aptName = raw.aptNm.trim();
  const dong = raw.umdNm.trim();

  // 날짜 표기: "2024.11.07" (월/일 2자리 패딩)
  const month = raw.dealMonth.padStart(2, "0");
  const day = raw.dealDay.padStart(2, "0");
  const dealDate = `${raw.dealYear}.${month}.${day}`;

  // 고유 식별자: 단지+면적+층+날짜+금액 조합 (중복 거래 구분용)
  const id = `${raw.aptNm}_${area}_${floor}_${raw.dealYear}${month}${day}_${amount}`;

  // 평형: 건축물대장 기반 정밀 인덱스 우선, 없으면 공식으로 폴백
  const pyeong = resolvePyeong(lawdCd, dong, aptName, area) ?? calculatePyeong(area);

  return {
    id,
    aptName,
    amount,
    amountText: formatAmountKorean(amount),
    area,
    pyeong,
    floor,
    dealDate,
    dong,
    jibun: raw.jibun.trim(),
    buildYear,
    // 신고가 여부/변동률은 거래 비교가 필요하므로 분석 단계에서 산출 (기본값 false)
    isNewHigh: false,
  };
}

/**
 * 국토부 API 에 XML 요청을 보낸다. 타임아웃 발생 시 1회 재시도한다.
 * @returns 응답 본문(XML 문자열)
 */
async function requestXml(
  lawdCd: string,
  dealYmd: string,
  serviceKey: string,
  attempt = 0,
): Promise<string> {
  try {
    const { data } = await axios.get<string>(ENDPOINT, {
      params: {
        serviceKey, // 디코딩된 키 (axios 가 자동 인코딩)
        LAWD_CD: lawdCd,
        DEAL_YMD: dealYmd,
        numOfRows: NUM_OF_ROWS,
        pageNo: 1,
      },
      headers: {
        // WAF 차단 회피용 브라우저 User-Agent 명시
        "User-Agent": USER_AGENT,
        // axios 기본 Accept(application/json) 를 덮어써 XML 응답을 강제한다.
        // (data.go.kr 은 Accept 헤더에 따라 JSON/XML 을 다르게 내려줌)
        Accept: "application/xml",
      },
      timeout: TIMEOUT_MS,
      responseType: "text",
    });
    return data;
  } catch (error) {
    const axiosError = error as AxiosError;
    // 타임아웃(ECONNABORTED) 시 1회 한정 재시도
    if (axiosError.code === "ECONNABORTED" && attempt < 1) {
      console.warn(
        `[molit] 타임아웃 발생, 재시도합니다 (LAWD_CD=${lawdCd}, DEAL_YMD=${dealYmd})`,
      );
      return requestXml(lawdCd, dealYmd, serviceKey, attempt + 1);
    }
    throw error;
  }
}

/**
 * 특정 지역/월의 아파트 매매 실거래가를 조회한다.
 * @param lawdCd 법정동 코드 5자리 (예: "11680")
 * @param dealYmd 거래연월 6자리 (예: "202411")
 * @returns 가공된 거래 목록 (실패/무결과 시 빈 배열)
 */
export async function fetchAptDeals(
  lawdCd: string,
  dealYmd: string,
): Promise<AptDeal[]> {
  // 1) API 키 (미설정 시 config 에서 명확한 에러 throw)
  const serviceKey = serverConfig.molitApiKey;

  let xml: string;
  try {
    xml = await requestXml(lawdCd, dealYmd, serviceKey);
  } catch (error) {
    // 네트워크/타임아웃 등 요청 실패 — 경고 후 빈 배열
    console.warn(
      `[molit] 요청 실패 (LAWD_CD=${lawdCd}, DEAL_YMD=${dealYmd}):`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }

  // 2) XML 파싱 (실패 시 빈 배열 + 콘솔 경고)
  let parsed: ParsedMolitResponse;
  try {
    parsed = xmlParser.parse(xml) as ParsedMolitResponse;
  } catch (error) {
    console.warn("[molit] XML 파싱 실패:", error);
    return [];
  }

  // 3) 결과코드 확인
  const resultCode = parsed.response?.header?.resultCode;
  if (resultCode !== undefined && resultCode !== SUCCESS_CODE) {
    console.warn(
      `[molit] API 오류 응답 (resultCode=${resultCode}, ${parsed.response?.header?.resultMsg ?? ""})`,
    );
    return [];
  }

  // 4) item 목록 정규화 (단일 객체/배열/빈값 모두 대응)
  const items = parsed.response?.body?.items;
  if (!items || typeof items !== "object") return [];
  const rawItem = items.item;
  if (rawItem === undefined || rawItem === null) return [];
  const itemArray = Array.isArray(rawItem) ? rawItem : [rawItem];

  return itemArray.map((item) =>
    toAptDeal(toRaw(item as Record<string, unknown>), lawdCd),
  );
}

/**
 * 현재월부터 지정한 개월 수만큼 과거 거래를 병렬 조회한다.
 * @param lawdCd 법정동 코드 5자리
 * @param months 조회할 개월 수 (현재월 포함)
 * @returns 최신 거래일 순으로 정렬된 거래 목록
 */
export async function fetchAptDealsMultiMonth(
  lawdCd: string,
  months: number,
): Promise<AptDeal[]> {
  const ymdList = getRecentYmdList(months);

  // 월별 조회를 병렬 실행 (개별 실패는 빈 배열로 처리되어 전체에 영향 없음)
  const results = await Promise.all(
    ymdList.map((ymd) => fetchAptDeals(lawdCd, ymd)),
  );

  // 중복 거래 제거 (id 기준) 후 거래일 내림차순 정렬
  const dealMap = new Map<string, AptDeal>();
  for (const deal of results.flat()) {
    dealMap.set(deal.id, deal);
  }
  return Array.from(dealMap.values()).sort((a, b) =>
    b.dealDate.localeCompare(a.dealDate),
  );
}

/**
 * 현재월부터 과거 months 개월의 거래연월(YYYYMM) 목록을 생성한다.
 * @returns 예) ["202406", "202405", ...]
 */
function getRecentYmdList(months: number): string[] {
  const now = new Date();
  const list: string[] = [];
  for (let i = 0; i < Math.max(1, months); i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    list.push(`${year}${month}`);
  }
  return list;
}
