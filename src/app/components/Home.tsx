import { AppHeader } from './AppHeader';
import { MainPreview } from './StepBuilder';
import { DESIGN_TYPES, sampleState, type DesignType } from '../types';

/**
 * 첫 화면 — 배경 디자인 방식 A / B 를 고르는 2개 박스.
 * (참고본 ContentBuilderHome 카드 디자인)
 */
export function Home({ onSelect, onBack }: { onSelect: (type: DesignType) => void; onBack?: () => void }) {
  return (
    <div className="min-h-screen bg-[#f8f7f5] flex flex-col">
      <AppHeader title="Sales Banner Builder" onBack={onBack} />

      <main className="flex-1 flex flex-col items-center px-8 pt-[41.67px] pb-10 gap-8" style={{ zoom: 1.2 }}>
        <div className="text-center flex flex-col items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 bg-[#FD312E] text-white text-xs font-medium px-3 py-1 rounded-full"
            style={{ lineHeight: '18px' }}
          >
            Sales Template
          </span>
          <div className="flex flex-col items-center gap-1">
            <h1 className="font-lgei font-bold text-[32px] text-gray-900" style={{ lineHeight: '40px' }}>
              Select Design Type
            </h1>
            <p className="text-gray-500 text-sm" style={{ lineHeight: '20px' }}>
              Pick a background approach to start building your sales banner.
            </p>
          </div>
        </div>

        {/* A / B cards */}
        <div className="flex gap-8 flex-wrap justify-center">
          {(['A', 'B'] as DesignType[]).map((key) => {
            const d = DESIGN_TYPES[key];
            return (
              <div key={key} className="flex flex-col gap-2 w-[380px]">
                <button
                  onClick={() => onSelect(key)}
                  className="group bg-white border border-gray-200 rounded-2xl p-4 w-full text-left flex flex-col hover:border-[#FD312E] hover:shadow-xl transition-all duration-200 cursor-pointer"
                >
                  {/* Thumbnail */}
                  <div
                    className="relative rounded-lg mb-4 overflow-hidden flex justify-center"
                    style={{ background: '#F8F7F5' }}
                  >
                    {/* Edit 화면과 같은 렌더러(Figma 실측 스펙)로 그린다 — 구 PreviewPanel 은
                        스티커·배경 전면 적용을 못 그려서 실제 결과와 달라 보였다 */}
                    <MainPreview state={sampleState(key)} displayWidth={344} />
                    <div className="absolute inset-0 bg-[#FD312E]/0 group-hover:bg-[#FD312E]/8 transition-all duration-200" />
                  </div>

                  <div className="flex items-start justify-between gap-2 px-1">
                    <div>
                      <p className="text-[11px] font-semibold text-[#FD312E] tracking-wide">OPTION {key}</p>
                      <p
                        className="font-lgei font-bold text-[17px] text-gray-900 group-hover:text-[#FD312E] transition-colors mt-0.5"
                        style={{ lineHeight: '22px' }}
                      >
                        {d.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-1" style={{ lineHeight: '16px' }}>
                        {d.desc}
                      </p>
                    </div>
                    <svg
                      className="shrink-0 mt-1 text-gray-300 group-hover:text-[#FD312E] transition-colors"
                      width="18" height="18" viewBox="0 0 16 16" fill="none"
                    >
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
