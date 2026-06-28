import axios, { AxiosError } from "axios";
import { XMLParser } from "fast-xml-parser";
import {
  calculatePyeong,
  formatAmountKorean,
  parseAmount,
} from "@/lib/utils/format";
import { resolvePyeong } from "@/lib/data/pyeongIndex";
import { serverConfig } from "@/lib/config";
import type { AptDeal } from "@/types";

/**
 * 국토교통부 아파트 전월세 실거래가 API 연동 모듈.
 * - 전세/월세를 모두 조회해 화면 표시용 AptDeal[] 로 변환한다.
 * - amount/amountText 는 "보증금" 기준으로 채워, 매매용 컴포넌트(목록/정렬/신고가/변동률)를
 *   그대로 재사용한다. 월세 금액은 monthlyRent 로 분리 보관하고 표기에 함께 노출한다.
 * - 전세 = monthlyRent 0, 월세 = monthlyRent 양수.
 */

/** 아파트 전월세 실거래가 엔드포인트 (운영) */
const ENDPOINT =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";

/** data.go.kr WAF 차단 회피용 브라우저 User-Agent */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/** 요청 타임아웃 (5초) */
const TIMEOUT_MS = 5_000;

/** 한 페이지 조회 건수 */
const NUM_OF_ROWS = 1_000;

/** 정상 응답 결과코드 */
const SUCCESS_CODE = "000";

/** XML 파서 인스턴스 (값은 항상 문자열로 유지) */
const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
});

/** 전월세 종류 */
export type RentKind = "jeonse" | "wolse";

/** 파싱된 응답에서 item 목록을 안전하게 추출하기 위한 내부 타입 */
interface ParsedRentResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      items?: { item?: unknown } | "" | null;
      totalCount?: string;
    };
  };
}

/** 전월세 가격 표시 문자열 생성 (전세: 보증금 / 월세: 보증금 / 월 N만) */
function formatRentText(deposit: number, monthlyRent: number): string {
  const depositText = formatAmountKorean(deposit);
  if (monthlyRent > 0) {
    return `${depositText} / 월 ${monthlyRent.toLocaleString("ko-KR")}만`;
  }
  return depositText;
}

/** 단일 전월세 원본 항목을 AptDeal 로 정규화 (amount=보증금) */
function toRentDeal(
  item: Record<string, unknown>,
  lawdCd: string,
): AptDeal {
  const get = (key: string): string => {
    const value = item[key];
    return value === undefined || value === null ? "" : String(value).trim();
  };

  const aptName = get("aptNm");
  const dong = get("umdNm");
  const deposit = parseAmount(get("deposit")); // 보증금(만원)
  const monthlyRent = parseAmount(get("monthlyRent")); // 월세(만원), 전세는 0
  const area = Number.parseFloat(get("excluUseAr")) || 0;
  const floor = Number.parseInt(get("floor"), 10) || 0;
  const buildYear = Number.parseInt(get("buildYear"), 10) || 0;
  const contractType = get("contractType") || undefined;

  const month = get("dealMonth").padStart(2, "0");
  const day = get("dealDay").padStart(2, "0");
  const dealDate = `${get("dealYear")}.${month}.${day}`;

  // 고유 식별자: 단지+면적+층+날짜+보증금+월세
  const id = `${aptName}_${area}_${floor}_${get("dealYear")}${month}${day}_${deposit}_${monthlyRent}`;

  // 평형: 건축물대장 기반 정밀 인덱스 우선, 없으면 공식 폴백
  const pyeong = resolvePyeong(lawdCd, dong, aptName, area) ?? calculatePyeong(area);

  return {
    id,
    aptName,
    amount: deposit, // 보증금 기준 (정렬/신고가/변동률 재사용)
    amountText: formatRentText(deposit, monthlyRent),
    area,
    pyeong,
    floor,
    dealDate,
    dong,
    jibun: get("jibun"),
    buildYear,
    isNewHigh: false,
    monthlyRent,
    contractType,
  };
}

/** 전월세 API 에 XML 요청을 보낸다. 타임아웃 시 1회 재시도. */
async function requestXml(
  lawdCd: string,
  dealYmd: string,
  serviceKey: string,
  attempt = 0,
): Promise<string> {
  try {
    const { data } = await axios.get<string>(ENDPOINT, {
      params: {
        serviceKey,
        LAWD_CD: lawdCd,
        DEAL_YMD: dealYmd,
        numOfRows: NUM_OF_ROWS,
        pageNo: 1,
      },
      headers: { "User-Agent": USER_AGENT, Accept: "application/xml" },
      timeout: TIMEOUT_MS,
      responseType: "text",
    });
    return data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.code === "ECONNABORTED" && attempt < 1) {
      return requestXml(lawdCd, dealYmd, serviceKey, attempt + 1);
    }
    throw error;
  }
}

/**
 * 특정 지역/월의 아파트 전월세 실거래가를 조회한다(전세+월세 모두).
 * @param lawdCd 법정동 코드 5자리
 * @param dealYmd 거래연월 6자리 (예: "202606")
 */
export async function fetchAptRents(
  lawdCd: string,
  dealYmd: string,
): Promise<AptDeal[]> {
  const serviceKey = serverConfig.molitApiKey;

  let xml: string;
  try {
    xml = await requestXml(lawdCd, dealYmd, serviceKey);
  } catch (error) {
    console.warn(
      `[molitRent] 요청 실패 (LAWD_CD=${lawdCd}, DEAL_YMD=${dealYmd}):`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }

  let parsed: ParsedRentResponse;
  try {
    parsed = xmlParser.parse(xml) as ParsedRentResponse;
  } catch (error) {
    console.warn("[molitRent] XML 파싱 실패:", error);
    return [];
  }

  const resultCode = parsed.response?.header?.resultCode;
  if (resultCode !== undefined && resultCode !== SUCCESS_CODE) {
    console.warn(
      `[molitRent] API 오류 응답 (resultCode=${resultCode}, ${parsed.response?.header?.resultMsg ?? ""})`,
    );
    return [];
  }

  const items = parsed.response?.body?.items;
  if (!items || typeof items !== "object") return [];
  const rawItem = items.item;
  if (rawItem === undefined || rawItem === null) return [];
  const itemArray = Array.isArray(rawItem) ? rawItem : [rawItem];

  return itemArray.map((item) =>
    toRentDeal(item as Record<string, unknown>, lawdCd),
  );
}

/**
 * 현재월부터 지정 개월 수만큼 전월세 거래를 병렬 조회한다.
 * @param lawdCd 법정동 코드 5자리
 * @param months 조회할 개월 수 (현재월 포함)
 * @returns 최신 거래일 순으로 정렬된 거래 목록 (전세+월세)
 */
export async function fetchAptRentsMultiMonth(
  lawdCd: string,
  months: number,
): Promise<AptDeal[]> {
  const ymdList = getRecentYmdList(months);
  const results = await Promise.all(
    ymdList.map((ymd) => fetchAptRents(lawdCd, ymd)),
  );

  const dealMap = new Map<string, AptDeal>();
  for (const deal of results.flat()) dealMap.set(deal.id, deal);
  return Array.from(dealMap.values()).sort((a, b) =>
    b.dealDate.localeCompare(a.dealDate),
  );
}

/** 전월세 종류로 필터 (전세=월세 0, 월세=월세 양수) */
export function filterByRentKind(deals: AptDeal[], kind: RentKind): AptDeal[] {
  if (kind === "jeonse") return deals.filter((d) => (d.monthlyRent ?? 0) === 0);
  return deals.filter((d) => (d.monthlyRent ?? 0) > 0);
}

/** 현재월부터 과거 months 개월의 거래연월(YYYYMM) 목록 */
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
