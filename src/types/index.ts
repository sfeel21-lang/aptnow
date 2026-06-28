/**
 * AptNow 전역 도메인 타입 정의.
 * - 국토교통부 실거래가 OpenAPI 연동에 사용되는 원본/가공 타입을 한곳에서 관리한다.
 * - 모든 필드는 불변(readonly)으로 선언해 의도치 않은 변경을 방지한다.
 */

/**
 * 국토교통부 API 원본 응답 (아파트 매매 실거래)
 * - 공공 API 특성상 모든 값이 문자열로 내려온다. (가공 전 단계)
 */
export interface MolitAptDealRaw {
  /** 아파트명 (예: "래미안대치팰리스") */
  readonly aptNm: string;
  /** 거래금액 — 쉼표 포함 문자열 (예: "525,000") */
  readonly dealAmount: string;
  /** 전용면적 (㎡, 문자열) */
  readonly excluUseAr: string;
  /** 층 (문자열) */
  readonly floor: string;
  /** 거래 연도 (예: "2024") */
  readonly dealYear: string;
  /** 거래 월 (예: "11") */
  readonly dealMonth: string;
  /** 거래 일 (예: "7") */
  readonly dealDay: string;
  /** 읍면동명 (예: "대치동") */
  readonly umdNm: string;
  /** 지번 */
  readonly jibun: string;
  /** 건축연도 (예: "2015") */
  readonly buildYear: string;
  /** 도로명 */
  readonly roadNm: string;
  /** 등기일자 */
  readonly rgstDate: string;
}

/**
 * 가공된 거래 데이터 (화면 표시용)
 * - 원본(MolitAptDealRaw)을 숫자/표시 문자열로 정규화한 형태.
 */
export interface AptDeal {
  /** 고유 식별자 (단지+면적+층+날짜 등으로 생성) */
  readonly id: string;
  /** 아파트명 */
  readonly aptName: string;
  /** 거래금액 (만원 단위 숫자) */
  readonly amount: number;
  /** 거래금액 표시 문자열 (예: "52억 5,000만") */
  readonly amountText: string;
  /** 전용면적 (㎡) */
  readonly area: number;
  /** 평수 (㎡ → 평 환산) */
  readonly pyeong: number;
  /** 층 */
  readonly floor: number;
  /** 거래일자 표시 문자열 (예: "2024.11.07") */
  readonly dealDate: string;
  /** 읍면동명 */
  readonly dong: string;
  /** 지번 */
  readonly jibun: string;
  /** 건축연도 */
  readonly buildYear: number;
  /** 신고가 여부 */
  readonly isNewHigh: boolean;
  /** 직전 거래 대비 변동률 (%) — 비교 대상이 없으면 undefined */
  readonly changeRate?: number;
  /**
   * 월세 금액 (만원) — 전월세 거래에서만 사용.
   * - 매매/전세는 undefined(전세는 0), 월세는 양수.
   * - 전월세의 경우 amount/amountText 는 "보증금" 기준으로 채운다.
   */
  readonly monthlyRent?: number;
  /** 계약구분 (전월세) — "신규" | "갱신" 등, 없으면 undefined */
  readonly contractType?: string;
}

/**
 * 지역 코드
 * - 국토부 API 요청 시 사용하는 법정동 코드 체계.
 * - dong/dongCode 는 동 단위 필터링이 필요할 때만 사용한다.
 */
export interface RegionCode {
  /** 시도명 (예: "서울특별시") */
  readonly sido: string;
  /** 시도 코드 (예: "11") */
  readonly sidoCode: string;
  /** 시군구명 (예: "강남구") */
  readonly gugun: string;
  /** 시군구 코드 5자리 (예: "11680") — API 의 LAWD_CD */
  readonly gugunCode: string;
  /** 읍면동명 (선택) */
  readonly dong?: string;
  /** 읍면동 코드 (선택) */
  readonly dongCode?: string;
}

/**
 * API 응답 공통 래퍼
 * - 성공/실패 및 캐시 적중 여부를 함께 전달한다.
 */
export interface ApiResponse<T> {
  /** 요청 성공 여부 */
  readonly success: boolean;
  /** 응답 데이터 */
  readonly data: T;
  /** 실패 시 에러 메시지 */
  readonly error?: string;
  /** 캐시(Redis 등)에서 응답했는지 여부 */
  readonly cached?: boolean;
}
