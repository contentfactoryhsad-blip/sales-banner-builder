import { useState, useRef, useLayoutEffect } from 'react';
import { Download } from 'lucide-react';
import { AppHeader } from './AppHeader';
import { NavRail } from './NavRail';
import { LeftOptionsPanel } from './LeftOptionsPanel';
import { RightPanel } from './RightPanel';
import { PreviewPanel } from './PreviewPanel';
import { createInitialState, DESIGN_TYPES, type BannerState, type DesignType } from '../types';

/**
 * Sales Banner 빌더 — 참고본 StorePageModulesBuilder 레이아웃.
 * [아이콘 레일] · [좌측 옵션] · [가운데 캔버스] · [우측 편집]
 */
export function SalesBannerBuilder({ designType, onExit }: { designType: DesignType; onExit: () => void }) {
  const [state, setState] = useState<BannerState>(() => createInitialState(designType));
  const update = (patch: Partial<BannerState>) => setState((s) => ({ ...s, ...patch }));

  // 캔버스 폭에 맞춰 배너 미리보기 크기 반응형 조정
  const canvasRef = useRef<HTMLDivElement>(null);
  const [displayWidth, setDisplayWidth] = useState(760);
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setDisplayWidth(Math.max(320, Math.min(w - 96, 1000)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const design = DESIGN_TYPES[designType];
  const hasPromotion = !!state.promotionId;

  return (
    <div className="flex flex-col h-screen bg-[#f8f7f5]">
      <AppHeader
        title="Sales Banner Builder"
        onBack={onExit}
        right={
          <>
            <span className="text-xs text-gray-500">
              Style: <span className="font-medium text-gray-800">Option {designType} · {design.name}</span>
            </span>
            <button
              type="button"
              disabled={!hasPromotion}
              title="Download will be wired after the Figma spec is ready"
              className="flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-full border transition-colors border-[#FD312E] text-[#FD312E] hover:bg-[#FD312E] hover:text-white disabled:opacity-40 disabled:pointer-events-none"
            >
              <Download size={14} strokeWidth={1.75} />
              Download ZIP
            </button>
          </>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <NavRail active="sales-banner" onNavigate={(key) => key === 'home' && onExit()} />

        {/* Left — options */}
        <LeftOptionsPanel state={state} update={update} />

        {/* Center — canvas */}
        <main ref={canvasRef} className="flex-1 overflow-y-auto flex items-center justify-center p-12" style={{ background: '#CDC8C1' }}>
          {hasPromotion ? (
            <div className="flex flex-col items-center gap-3">
              <PreviewPanel state={state} displayWidth={displayWidth} />
              <p className="text-[11px] text-[#6b6862]">1200 × 628 · background / shapes / sizes wired after Figma spec</p>
            </div>
          ) : (
            <p className="text-[#6b6862] text-sm">← Select a promotion on the left to start your banner.</p>
          )}
        </main>

        {/* Right — edit */}
        <RightPanel state={state} update={update} />
      </div>
    </div>
  );
}
