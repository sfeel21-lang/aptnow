import rawPyeong from "@/lib/data/pyeong.generated.json";

/**
 * 단지별 "전유면적 → 분양면적(㎡)" 정밀 인덱스 (건축물대장 기반, 사전 생성).
 * - 국토부 실거래가는 전용면적만 제공하고, 전용→공급(분양) 변환은 단지마다 전용률이
 *   달라 단일 공식으로는 부정확하다(특히 전용이 거의 같은데 평형이 다른 경우).
 * - scripts/build-pyeong-index.ts 가 건축물대장 전유공용면적으로
 *   "분양면적 = 전유 + 주거공용(주차장 등 기타공용 제외)"을 계산해 저장한 결과다.
 * - 평형 = floor(분양면적 / 3.3058). (한국 관행: 전용 84→34평, 59→25평에 부합)
 * - 인덱스에 없으면(미수집/매칭실패) 호출측에서 공식(calculatePyeong)으로 폴백한다.
 */

/** ㎡ → 평 */
const PYEONG_DIVISOR = 3.3058;

/** 단지 키(lawdCd|dong|aptName) → { "전유면적2자리": 분양면적㎡ } */
type SupplyAreaMap = Readonly<Record<string, Readonly<Record<string, number>>>>;

const INDEX = rawPyeong as SupplyAreaMap;

/** 단지 키 생성 */
function keyOf(lawdCd: string, dong: string, aptName: string): string {
  return `${lawdCd}|${dong}|${aptName}`;
}

/** 분양면적(㎡) → 통용 평형 */
function toPyeong(supplyArea: number): number {
  return Math.floor(supplyArea / PYEONG_DIVISOR);
}

/**
 * 건축물대장 기반 평형을 조회한다(분양면적 → 평형).
 * @returns 평형(평). 인덱스에 없으면 null (호출측에서 공식 폴백).
 */
export function resolvePyeong(
  lawdCd: string,
  dong: string,
  aptName: string,
  area: number,
): number | null {
  const entry = INDEX[keyOf(lawdCd, dong, aptName)];
  if (!entry) return null;

  // 1) 전유면적 정확 일치(소수 2자리)
  const exact = entry[area.toFixed(2)];
  if (typeof exact === "number") return toPyeong(exact);

  // 2) 근사 일치(±0.5㎡ 이내 가장 가까운 값) — 등기상 미세 면적 차이 보정
  let bestSupply: number | null = null;
  let bestDiff = 0.5;
  for (const [areaStr, supply] of Object.entries(entry)) {
    const diff = Math.abs(Number.parseFloat(areaStr) - area);
    if (diff <= bestDiff) {
      bestDiff = diff;
      bestSupply = supply;
    }
  }
  return bestSupply === null ? null : toPyeong(bestSupply);
}
