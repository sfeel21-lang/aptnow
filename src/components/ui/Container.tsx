import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface ContainerProps {
  /** 내부에 렌더링할 자식 요소 */
  children: ReactNode;
  /** 추가 클래스 (선택) */
  className?: string;
}

/**
 * 페이지 콘텐츠의 좌우 여백과 최대 너비를 통일하는 레이아웃 컨테이너.
 */
export function Container({ children, className }: ContainerProps): JSX.Element {
  return (
    <div className={cn("mx-auto w-full max-w-content px-4 sm:px-6", className)}>
      {children}
    </div>
  );
}
