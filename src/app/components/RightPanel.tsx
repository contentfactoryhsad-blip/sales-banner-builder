import type { BannerState } from '../types';
import { getPromotion } from '../../data/promotions';
import { AD_CHANNELS, BACKGROUND_TYPES, BOX_STYLES } from '../../data/builderOptions';
import { deriveBannerColors, hexToHsl } from '../utils/color';

const HUE_GRADIENT =
  'linear-gradient(to right, hsl(0,70%,55%), hsl(60,70%,55%), hsl(120,70%,55%), hsl(180,70%,55%), hsl(240,70%,55%), hsl(300,70%,55%), hsl(360,70%,55%))';

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

  // Hue 조정: S/L 유지, Hue만 변경
  const colors = deriveBannerColors(promo.main.hex, promo.secondary.hex, state.mainHue, state.secondaryHue);
  const mainHue = state.mainHue ?? Math.round(hexToHsl(promo.main.hex).h);
  const secHue = state.secondaryHue ?? Math.round(hexToHsl(promo.secondary.hex).h);
  const hueTouched = state.mainHue !== null || state.secondaryHue !== null;

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

      {/* Color · Hue — 명도/채도 유지, Hue만 좌우로 조정해 자기 색 만들기 */}
      <div>
        <p className="font-lgei font-bold text-[15px] text-gray-900 mb-1">Color · Hue</p>
        <p className="text-xs text-gray-400 mb-3">Main / combo — slide each hue independently</p>

        <div className="flex flex-col gap-2">
          {([
            ['main', colors.main, mainHue, (h: number) => update({ mainHue: h })],
            ['combo', colors.secondary, secHue, (h: number) => update({ secondaryHue: h })],
          ] as const).map(([key, swatch, hue, onChange]) => (
            <div key={key} className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg border border-black/10 shrink-0" style={{ background: swatch }} title={`${key} ${swatch}`} />
              <input
                type="range" min={0} max={360} value={hue}
                onChange={(e) => onChange(Number(e.target.value))}
                className="flex-1 h-2.5 rounded-full appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-400 [&::-webkit-slider-thumb]:shadow"
                style={{ background: HUE_GRADIENT }}
              />
              <span className="text-xs text-gray-500 tabular-nums shrink-0 w-9 text-right">{Math.round(hue)}°</span>
            </div>
          ))}
        </div>

        {hueTouched && (
          <button
            type="button"
            onClick={() => update({ mainHue: null, secondaryHue: null })}
            className="text-[11px] text-[#FD312E] underline mt-2"
          >
            Reset to {promo.label} color
          </button>
        )}
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
