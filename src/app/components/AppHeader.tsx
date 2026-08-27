import React from 'react';
import { BackButton } from './BackButton';

interface Props {
  title: string;
  /** 좌상단 뒤로 버튼. Home 등 뒤로가 없는 화면에서는 생략. */
  onBack?: () => void;
  /**
   * 로고/타이틀을 누르면 홈으로. 주면 그 묶음이 버튼이 되고, 없으면 종전처럼 글자로만 남는다.
   * (웹사이트 로고와 같은 약속 — 어느 단계에 있든 첫 화면으로 돌아간다)
   */
  onHome?: () => void;
  /** 우측 액션 영역. */
  right?: React.ReactNode;
}

/**
 * 공용 64px 앱 헤더 — 뒤로 버튼(옵션) + LG 로고/타이틀 (좌측 정렬) + 우측 액션.
 * (참고본 AppHeader 이식, i18n 제거)
 */
export function AppHeader({ title, onBack, onHome, right }: Props) {
  const brand = (
    <>
      <img src="/lg-logo.svg" alt="LG" style={{ height: 20, width: 'auto' }} draggable={false} />
      <div className="w-px h-4 bg-gray-200" />
      <span className="font-lgei font-bold text-[15px] text-gray-900" style={{ lineHeight: '20px' }}>
        {title}
      </span>
    </>
  );

  return (
    <header className="bg-white border-b border-gray-200 px-8 h-16 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-4 shrink-0">
        {onBack && <BackButton onClick={onBack} />}
        {onHome ? (
          <button
            type="button"
            onClick={onHome}
            title="Go to the first step"
            aria-label={`${title} — go to the first step`}
            className="flex items-center gap-2 -mx-2 px-2 h-9 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD312E]/40"
          >
            {brand}
          </button>
        ) : (
          <div className="flex items-center gap-2">{brand}</div>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">{right}</div>
    </header>
  );
}
