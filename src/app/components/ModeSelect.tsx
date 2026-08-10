import { ListChecks, LayoutDashboard } from 'lucide-react';
import { AppHeader } from './AppHeader';

export type WorkflowMode = 'step' | 'single';

const MODES: { key: WorkflowMode; tag: string; name: string; desc: string; Icon: typeof ListChecks }[] = [
  { key: 'step', tag: 'MODE A', name: 'Step by step', desc: 'Guided flow, one step at a time (like the Thumbnail Builder)', Icon: ListChecks },
  { key: 'single', tag: 'MODE B', name: 'Single page', desc: 'All options on one screen', Icon: LayoutDashboard },
];

/** 첫 화면 — 작업 방식(단계별 / 한판)을 고른다. */
export function ModeSelect({ onSelect }: { onSelect: (mode: WorkflowMode) => void }) {
  return (
    <div className="min-h-screen bg-[#f8f7f5] flex flex-col">
      <AppHeader title="Sales Banner Builder" />

      <main className="flex-1 flex flex-col items-center px-8 pt-[41.67px] pb-10 gap-8" style={{ zoom: 1.2 }}>
        <div className="text-center flex flex-col items-center gap-3">
          <span className="inline-flex items-center gap-1.5 bg-[#FD312E] text-white text-xs font-medium px-3 py-1 rounded-full" style={{ lineHeight: '18px' }}>
            Sales Template
          </span>
          <div className="flex flex-col items-center gap-1">
            <h1 className="font-lgei font-bold text-[32px] text-gray-900" style={{ lineHeight: '40px' }}>
              How do you want to build?
            </h1>
            <p className="text-gray-500 text-sm" style={{ lineHeight: '20px' }}>
              Choose a workflow. You can switch anytime.
            </p>
          </div>
        </div>

        <div className="flex gap-8 flex-wrap justify-center">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => onSelect(m.key)}
              className="group bg-white border border-gray-200 rounded-2xl p-5 w-72 text-left flex flex-col hover:border-[#FD312E] hover:shadow-xl transition-all duration-200 cursor-pointer"
            >
              <div className="rounded-lg mb-4 flex items-center justify-center" style={{ height: 150, background: '#F8F7F5' }}>
                <m.Icon size={44} strokeWidth={1.5} className="text-gray-300 group-hover:text-[#FD312E] transition-colors" />
              </div>
              <div className="flex items-start justify-between gap-2 px-1">
                <div>
                  <p className="text-[11px] font-semibold text-[#FD312E] tracking-wide">{m.tag}</p>
                  <p className="font-lgei font-bold text-[16px] text-gray-900 group-hover:text-[#FD312E] transition-colors mt-0.5" style={{ lineHeight: '22px' }}>
                    {m.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-1" style={{ lineHeight: '16px' }}>{m.desc}</p>
                </div>
                <svg className="shrink-0 mt-1 text-gray-300 group-hover:text-[#FD312E] transition-colors" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
