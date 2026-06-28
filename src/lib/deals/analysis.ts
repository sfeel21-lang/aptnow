import type { AptDeal } from "@/types";

/**
 * 거래 분석 유틸 (서버 라우트 / 서버 컴포넌트 공용).
 */

/**
 * 신고가 플래그 + 변동률을 함께 계산한다.
 * - 동일 단지 + 동일 전용면적(평형) 그룹 내에서 거래일 오름차순으로 비교
 * - 직전까지의 역대 최고가(전고가) 기준:
 *   - 초과하면 isNewHigh: true
 *   - changeRate = (이번가 - 전고가) / 전고가 × 100 (직전 비교 대상이 있을 때만)
 * @param deals 거래 목록 (변동률 정확도를 위해 충분한 기간을 넣을수록 좋음)
 * @returns isNewHigh / changeRate 가 채워진 새 거래 목록(거래일 내림차순)
 */
export function computeNewHighFlags(deals: AptDeal[]): AptDeal[] {
  // 단지+평형(평) 기준으로 그룹핑
  // - 국토부 데이터는 같은 평형이라도 전용면적(㎡)이 미세하게 다르게 기록되는 경우가 있어,
  //   정확한 ㎡ 로 묶으면 같은 평형이 갈려 변동률/신고가가 누락된다. 평형 기준으로 묶어 보정.
  const groups = new Map<string, AptDeal[]>();
  for (const deal of deals) {
    const key = `${deal.aptName}_${deal.pyeong}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(deal);
    else groups.set(key, [deal]);
  }

  const result: AptDeal[] = [];
  for (const bucket of groups.values()) {
    // 거래일 오름차순 정렬 후 누적 최고가(전고가)와 비교
    const ascending = [...bucket].sort((a, b) =>
      a.dealDate.localeCompare(b.dealDate),
    );
    let maxAmount = Number.NEGATIVE_INFINITY;
    for (const deal of ascending) {
      const hasPrev = maxAmount !== Number.NEGATIVE_INFINITY;
      const isNewHigh = hasPrev && deal.amount > maxAmount;
      const changeRate =
        hasPrev && maxAmount > 0
          ? ((deal.amount - maxAmount) / maxAmount) * 100
          : undefined;
      result.push({ ...deal, isNewHigh, changeRate });
      if (deal.amount > maxAmount) maxAmount = deal.amount;
    }
  }

  // 화면 표시를 위해 거래일 내림차순으로 재정렬
  return result.sort((a, b) => b.dealDate.localeCompare(a.dealDate));
}
