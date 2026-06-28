import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind 클래스명을 조건부로 합치고 중복/충돌을 정리한다.
 * 예) cn("px-2", isActive && "px-4") → "px-4"
 *
 * @param inputs - 문자열/객체/배열 형태의 클래스 값 목록
 * @returns 병합된 최종 클래스 문자열
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
