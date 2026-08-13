import type { BannerState } from '../types';
import { getPromotion, promoPair, type ColorSet } from '../../data/promotions';
import { AD_CHANNELS, BACKGROUND_TYPES, BOX_STYLES } from '../../data/builderOptions';

/*
  Hue 슬라이더 대신 **두 벌 중 하나**만 고르게 한다 (StepBuilder 의 Edit 섹션과 동일).
  아무 색이나 나오면 브랜드 톤이 흐트러지고, 나라별 법인이 제각각 쓰게 된다.
*/
const COLOR_SETS: { id: ColorSet; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'sub', label: 'Sub' },
];

/** 우측 편집/세부 패널 — 명칭 입력 + 선택 요약. (참고본의 Edit Panel 자리) */
export function RightPanel({
  state,
  update,
}: {
  state: BannerState;
  update: (patch: Partial<BannerState>) => void;
}) {
  const promo = state.promotionId ? getPromotion(state.promotionId) : undefined;

  if (!promo) {
    return (
      <aside className="w-80 shrink-0 bg-white border-l border-gray-200 flex items-center justify-center p-5">
        <p className="text-sm text-gray-400 text-center">Select a promotion on the left<br />to open editing.</p>
      </aside>
    );
  }

  const channel = AD_CHANNELS.find((c) => c.id === state.adChannelId);
  const bgType = BACKGROUND_TYPES[state.designType].find((b) => b.id === state.backgroundTypeId);
  const box = BOX_STYLES.find((b) => b.id === state.boxStyleId);

  return (
    <aside className="w-80 shrink-0 bg-white border-l border-gray-200 overflow-y-auto p-5 flex flex-col gap-6">
      {/* 프로모션 명칭 */}
      <div>
        <p className="font-lgei font-bold text-[15px] text-gray-900 mb-0.5">Promotion name</p>
        <p className="text-xs text-gray-400 mb-3">Sale name shown on the banner</p>
        <input
          type="text"
          value={state.promoName}
          onChange={(e) => update({ promoName: e.target.value })}
          placeholder="e.g. Holiday Sale"
          className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-[#FD312E] focus:ring-1 focus:ring-[#FD312E]"
        />
      </div>

      {/* Copy — head / sub : 토글+편집, 미리보기에 실시간 반영 (auto-layout reflow) */}
      <div>
        <p className="font-lgei font-bold text-[15px] text-gray-900 mb-1">Copy</p>
        <p className="text-xs text-gray-400 mb-3">Toggle or edit — preview reflows live</p>
        <div className="flex flex-col gap-3">
          <CopyField label="Head copy" checked={state.showHeadline} value={state.headline} multiline
            onToggle={(v) => update({ showHeadline: v })} onChange={(v) => update({ headline: v })} />
          <CopyField label="Sub copy" checked={state.showSubcopy} value={state.subcopy} multiline
            onToggle={(v) => update({ showSubcopy: v })} onChange={(v) => update({ subcopy: v })} />
        </div>
      </div>

      {/* Color — 프로모션이 들고 온 두 벌(추천/서브) 중에서만 고른다 */}
      <div>
        <p className="font-lgei font-bold text-[15px] text-gray-900 mb-1">Color</p>
        <p className="text-xs text-gray-400 mb-3">Pick one of the two sets for {promo.label}</p>

        <div className="flex flex-col gap-1.5">
          {COLOR_SETS.map((set) => {
            const q = promoPair(promo, set.id);
            const on = state.colorSet === set.id;
            return (
              <button
                key={set.id} type="button" onClick={() => update({ colorSet: set.id })}
                title={`${q.main.name} · ${q.secondary.name}`}
                className={`flex items-center gap-2.5 w-full px-2.5 h-11 rounded-xl border transition-colors ${
                  on ? 'border-[#FD312E] bg-[#FD312E]/5' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="flex shrink-0 rounded-full overflow-hidden border border-black/5">
                  {[q.main.hex, q.secondary.hex].map((c) => (
                    <span key={c} style={{ background: c, width: 18, height: 18 }} />
                  ))}
                </span>
                <span className="flex flex-col items-start leading-tight min-w-0">
                  <span className={`text-[12px] font-medium ${on ? 'text-[#FD312E]' : 'text-gray-700'}`}>{set.label}</span>
                  <span className="text-[10px] text-gray-400 truncate">{q.main.name} · {q.secondary.name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div>
        <p className="font-lgei font-bold text-[15px] text-gray-900 mb-3">Summary</p>
        <dl className="flex flex-col gap-2 text-sm">
          <SummaryRow label="Promotion" value={promo.label} />
          <SummaryRow label="Ad Channel" value={channel?.label ?? '—'} />
          <SummaryRow label="Background" value={bgType?.label ?? '—'} />
          <SummaryRow label="Box" value={`${box?.label ?? '—'}${state.boxCount ? ` · ${state.boxCount}` : ''}`} />
          <SummaryRow label="Name" value={state.promoName || '—'} />
        </dl>
      </div>
    </aside>
  );
}

function CopyField({
  label, checked, value, multiline, onToggle, onChange,
}: {
  label: string;
  checked: boolean;
  value: string;
  multiline?: boolean;
  onToggle: (v: boolean) => void;
  onChange: (v: string) => void;
}) {
  const cls = `w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[13px] text-gray-800 outline-none focus:border-[#FD312E] focus:ring-1 focus:ring-[#FD312E] disabled:opacity-40 disabled:bg-gray-50`;
  return (
    <div>
      <label className="flex items-center gap-2 mb-1 cursor-pointer select-none">
        <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="accent-[#FD312E]" />
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </label>
      {multiline ? (
        <textarea value={value} rows={2} disabled={!checked} onChange={(e) => onChange(e.target.value)} className={`${cls} resize-none`} />
      ) : (
        <input type="text" value={value} disabled={!checked} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-400 shrink-0">{label}</dt>
      <dd className="text-gray-800 text-right truncate">{value}</dd>
    </div>
  );
}
