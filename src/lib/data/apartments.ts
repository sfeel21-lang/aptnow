import { fetchAptDealsMultiMonth } from "@/lib/api/molit";
import generatedRaw from "@/lib/data/apartments.generated.json";

/**
 * 로컬 단지 인덱스 (검색용 캐시 데이터).
 * - 국토부 API 는 "단지 목록" 조회를 제공하지 않으므로, 두 소스를 합쳐 인덱스를 만든다:
 *   1) apartments.generated.json — 전국 실거래에서 자동 수집(scripts/build-apt-index.ts)
 *   2) 아래 CURATED — 거래가 드물어도 노출하고 싶은 주요 단지(보강)
 */

/** 단지 인덱스 항목 */
export interface ApartmentEntry {
  readonly aptName: string;
  readonly address: string;
  readonly sido: string;
  readonly gugun: string;
  readonly dong: string;
  readonly lawdCd: string;
}

/** 최근 거래 요약 */
export interface RecentDeal {
  readonly amountText: string;
  readonly dealDate: string;
  /** 동일 평형 전고가 대비 변동률(%) — 비교 대상이 없으면 미설정 */
  readonly changeRate?: number;
}

/** 검색 결과(API 응답 형태) */
export interface SearchResult {
  readonly aptName: string;
  readonly address: string;
  readonly lawdCd: string;
  readonly recentDeal: RecentDeal | null;
}

/** 보강된 검색 결과(페이지에서 지역 링크 등에 사용) */
export type EnrichedEntry = ApartmentEntry & { recentDeal: RecentDeal | null };

/** 시도 축약 → 정식명 (검색 필터용) */
const SIDO_ALIAS: Readonly<Record<string, string>> = {
  서울: "서울특별시",
  경기: "경기도",
  인천: "인천광역시",
  부산: "부산광역시",
};

/** 자동 수집된 전국 단지 (실거래 기반) */
const GENERATED = generatedRaw as unknown as ApartmentEntry[];

/** 큐레이션 단지 (보강용) */
const CURATED: ReadonlyArray<ApartmentEntry> = [
  // 강남구
  apt("래미안대치팰리스", "서울특별시", "강남구", "대치동", "11680"),
  apt("은마", "서울특별시", "강남구", "대치동", "11680"),
  apt("도곡렉슬", "서울특별시", "강남구", "도곡동", "11680"),
  apt("래미안블레스티지", "서울특별시", "강남구", "개포동", "11680"),
  apt("신현대11차", "서울특별시", "강남구", "압구정동", "11680"),
  apt("압구정현대", "서울특별시", "강남구", "압구정동", "11680"),
  apt("타워팰리스", "서울특별시", "강남구", "도곡동", "11680"),
  apt("세곡푸르지오", "서울특별시", "강남구", "세곡동", "11680"),
  // 서초구
  apt("래미안원베일리", "서울특별시", "서초구", "반포동", "11650"),
  apt("아크로리버파크", "서울특별시", "서초구", "반포동", "11650"),
  apt("반포자이", "서울특별시", "서초구", "반포동", "11650"),
  apt("메이플자이", "서울특별시", "서초구", "잠원동", "11650"),
  apt("래미안퍼스티지", "서울특별시", "서초구", "반포동", "11650"),
  // 송파구
  apt("헬리오시티", "서울특별시", "송파구", "가락동", "11710"),
  apt("잠실엘스", "서울특별시", "송파구", "잠실동", "11710"),
  apt("리센츠", "서울특별시", "송파구", "잠실동", "11710"),
  apt("트리지움", "서울특별시", "송파구", "잠실동", "11710"),
  apt("파크리오", "서울특별시", "송파구", "신천동", "11710"),
  apt("잠실주공5단지", "서울특별시", "송파구", "잠실동", "11710"),
  // 마포구
  apt("마포래미안푸르지오", "서울특별시", "마포구", "아현동", "11440"),
  apt("마포프레스티지자이", "서울특별시", "마포구", "염리동", "11440"),
  apt("공덕자이", "서울특별시", "마포구", "공덕동", "11440"),
  // 용산구
  apt("한강맨션", "서울특별시", "용산구", "이촌동", "11170"),
  apt("래미안첼리투스", "서울특별시", "용산구", "이촌동", "11170"),
  apt("용산푸르지오써밋", "서울특별시", "용산구", "한강로3가", "11170"),
  // 분당
  apt("분당파크뷰", "경기도", "성남시 분당구", "정자동", "41135"),
  apt("시범단지삼성한신", "경기도", "성남시 분당구", "서현동", "41135"),
  apt("정자동두산위브", "경기도", "성남시 분당구", "정자동", "41135"),
];

/** ApartmentEntry 생성 헬퍼 (주소 자동 조립) */
function apt(
  aptName: string,
  sido: string,
  gugun: string,
  dong: string,
  lawdCd: string,
): ApartmentEntry {
  const sidoShort =
    Object.entries(SIDO_ALIAS).find(([, full]) => full === sido)?.[0] ?? sido;
  return {
    aptName,
    sido,
    gugun,
    dong,
    lawdCd,
    address: `${sidoShort} ${gugun} ${dong}`,
  };
}

/** 단지 고유 키 (시군구+동+단지명) */
function entryKey(e: ApartmentEntry): string {
  return `${e.lawdCd}|${e.dong}|${e.aptName}`;
}

/**
 * 최종 단지 인덱스 = 자동 수집(GENERATED) + 큐레이션(CURATED) 병합(중복 제거).
 * - 수집 데이터가 비어 있으면(스크립트 미실행) 큐레이션만 사용한다.
 */
export const APARTMENT_INDEX: ReadonlyArray<ApartmentEntry> = (() => {
  const map = new Map<string, ApartmentEntry>();
  for (const e of GENERATED) map.set(entryKey(e), e);
  for (const e of CURATED) if (!map.has(entryKey(e))) map.set(entryKey(e), e);
  return [...map.values()];
})();

/** 인기 단지 (검색 결과 없을 때 추천용) — 큐레이션 상위 */
export const POPULAR_APARTMENTS: ReadonlyArray<ApartmentEntry> =
  CURATED.slice(0, 6);

/**
 * 단지명을 기준으로 인덱스를 검색한다.
 * @param query 검색어
 * @param sido 시도 필터(축약/정식명 모두 허용, 선택)
 * @param limit 최대 결과 수
 */
export function searchApartments(
  query: string,
  sido?: string,
  limit = 8,
): ApartmentEntry[] {
  const q = query.trim();
  if (!q) return [];

  const targetSido = sido ? (SIDO_ALIAS[sido] ?? sido) : undefined;

  return APARTMENT_INDEX.filter((entry) => {
    const matchName =
      entry.aptName.includes(q) || entry.dong.includes(q);
    const matchSido = !targetSido || entry.sido === targetSido;
    return matchName && matchSido;
  }).slice(0, limit);
}

/**
 * 검색 결과에 최근 거래가를 보강한다.
 * - 지역(lawdCd) 단위로 한 번씩만 실거래를 조회해 단지명으로 매칭한다.
 * @param entries 보강할 단지 목록
 */
export async function enrichWithRecentDeal(
  entries: ApartmentEntry[],
): Promise<EnrichedEntry[]> {
  // 중복 조회 방지: lawdCd 별 1회 조회
  const uniqueLawd = Array.from(new Set(entries.map((e) => e.lawdCd)));
  const dealsByLawd = new Map<string, Awaited<ReturnType<typeof fetchAptDealsMultiMonth>>>();

  await Promise.all(
    uniqueLawd.map(async (lawdCd) => {
      try {
        // 변동률(전고가 대비) 산출을 위해 6개월 범위 조회
        dealsByLawd.set(lawdCd, await fetchAptDealsMultiMonth(lawdCd, 6));
      } catch {
        dealsByLawd.set(lawdCd, []);
      }
    }),
  );

  return entries.map((entry) => {
    const deals = dealsByLawd.get(entry.lawdCd) ?? [];
    // 단지명 일치(정확 → 부분) 거래 중 가장 최근 1건
    const matched = deals
      .filter(
        (d) =>
          d.aptName === entry.aptName || d.aptName.includes(entry.aptName),
      )
      .sort((a, b) => b.dealDate.localeCompare(a.dealDate));
    const latest = matched[0];
    if (!latest) return { ...entry, recentDeal: null };

    // 동일 평형 전고가 대비 변동률 계산
    // (㎡ 가 미세하게 달라도 같은 평형이면 함께 비교 — 국토부 표기 불일치 보정)
    const priors = matched.filter(
      (d) =>
        d.pyeong === latest.pyeong &&
        d.id !== latest.id &&
        d.dealDate <= latest.dealDate,
    );
    const prevMax = priors.length
      ? Math.max(...priors.map((d) => d.amount))
      : undefined;
    const changeRate =
      prevMax !== undefined && prevMax > 0
        ? ((latest.amount - prevMax) / prevMax) * 100
        : undefined;

    return {
      ...entry,
      recentDeal: {
        amountText: latest.amountText,
        dealDate: latest.dealDate,
        changeRate,
      },
    };
  });
}
