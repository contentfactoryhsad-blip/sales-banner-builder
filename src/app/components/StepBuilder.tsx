import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { AppHeader } from './AppHeader';
import { WizardBreadcrumb } from './WizardBreadcrumb';
import { PreviewPanel } from './PreviewPanel';
import { ProductRow } from './LeftOptionsPanel';
import { createInitialState, DESIGN_TYPES, type BannerState, type DesignType } from '../types';
import { PROMOTIONS, getPromotion } from '../../data/promotions';
import { AD_CHANNELS, BACKGROUND_TYPES, BOX_STYLES_BY_DESIGN, BOX_COUNTS, DEFAULT_BOX_STYLE, DEFAULT_STICKER_STYLE, GRAPHIC_KINDS, GRAPHIC_TYPES, graphicSrc, NO_GRAPHIC_ID, MAX_HEADLINE, MAX_SUBCOPY, MIN_DISCOUNT, MAX_DISCOUNT, STICKER_STYLES_BY_DESIGN, resolveStickerStyle } from '../../data/builderOptions';
import { resolveBackground } from '../../data/builderOptions';
import { MEDIA_SIZES, type MediaSize } from '../../data/mediaSizes';
import { HEADLINE_FONT, HEADLINE_WEIGHT, STICKER_STYLES, STICKER_RED } from '../../data/sizeLayouts';
import { SpecBannerPreview } from './SpecBannerPreview';
import { getSpec } from '../../data/figmaStyle';
import { deriveBannerColors, hexToHsl, hslToHex, NEUTRAL_BANNER_COLORS } from '../utils/color';

const STEPS = ['1. Design Template', '2. Promotion & Product', '3. Edit', '4. AD Media', '5. Review & Download'];

const HUE_GRADIENT =
  'linear-gradient(to right, hsl(0,70%,55%), hsl(60,70%,55%), hsl(120,70%,55%), hsl(180,70%,55%), hsl(240,70%,55%), hsl(300,70%,55%), hsl(360,70%,55%))';

type StepProps = { state: BannerState; update: (patch: Partial<BannerState>) => void };

/**
 * 단계별(Step-by-step) 빌더 — 참고본 썸네일 빌더 5단계 형식. (방식 A)
 * onExit이 없으면 = 방식 선택 화면(ModeSelect)이 꺼진 상태 → 모드로 돌아가는 UI를 감춘다.
 */
export function StepBuilder({ onExit }: { onExit?: () => void }) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<BannerState>(() => createInitialState('A'));
  const update = (patch: Partial<BannerState>) => setState((s) => ({ ...s, ...patch }));
  const setProduct = (i: number, v: string | null) =>
    update({ products: state.products.map((p, idx) => (idx === i ? v : p)) });

  const canNext = step === 4 ? state.adChannelIds.length > 0 : true;

  return (
    <div className="h-screen flex flex-col bg-[#f8f7f5]">
      <AppHeader title="Sales Banner Builder" onBack={onExit} right={onExit ? <span className="text-xs text-gray-500">Mode A · Step by step</span> : undefined} />
      <WizardBreadcrumb steps={STEPS} activeStep={step} onStepClick={setStep} />

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-10 py-8">
        <div className="max-w-5xl mx-auto">
          {step === 1 && <DesignStep state={state} update={update} />}
          {step === 2 && <ProductUrlsStep state={state} update={update} setProduct={setProduct} />}
          {step === 3 && <EditStep state={state} update={update} />}
          {step === 4 && <AdMediaStep state={state} update={update} />}
          {step === 5 && <ReviewStep state={state} />}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="h-16 shrink-0 border-t border-gray-200 bg-white px-8 flex items-center justify-between">
        {step === 1 && !onExit ? (
          <span /> /* 1단계에서 돌아갈 곳이 없을 때 — 자리만 지켜 가운데/오른쪽 정렬 유지 */
        ) : (
          <button type="button" onClick={() => (step === 1 ? onExit?.() : setStep(step - 1))} className="h-10 px-5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            {step === 1 ? 'Mode' : 'Back'}
          </button>
        )}
        <span className="text-xs text-gray-400">{step} / {STEPS.length}</span>
        {step < STEPS.length ? (
          <button type="button" disabled={!canNext} onClick={() => setStep(step + 1)} className="h-10 px-6 rounded-lg bg-[#FD312E] text-white text-sm font-medium hover:bg-[#E22825] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Next
          </button>
        ) : (
          <button type="button" className="h-10 px-6 rounded-lg bg-[#FD312E] text-white text-sm font-medium hover:bg-[#E22825] transition-colors">
            Download (export later)
          </button>
        )}
      </div>
    </div>
  );
}

function Head({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-6">
      <h2 className="font-lgei font-bold text-[24px] text-gray-900" style={{ lineHeight: '30px' }}>{title}</h2>
      {desc && <p className="text-gray-500 text-sm mt-1">{desc}</p>}
    </div>
  );
}

// ── Step 1: Select Template (A/B) ──────────────────────────────────────────────
function DesignStep({ state, update }: StepProps) {
  return (
    <div>
      <Head title="Design Template Select" desc="Pick the background design approach." />
      <div className="grid grid-cols-2 gap-5">
        {(['A', 'B'] as DesignType[]).map((key) => {
          const d = DESIGN_TYPES[key];
          const selected = state.designType === key;
          return (
            <button key={key} onClick={() => update({ designType: key, backgroundTypeId: null, boxStyleId: DEFAULT_BOX_STYLE[key], stickerStyle: DEFAULT_STICKER_STYLE[key] })} className={`text-left rounded-2xl border p-4 transition-all ${selected ? 'border-[#FD312E] ring-1 ring-[#FD312E] shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="mb-3 flex justify-center rounded-lg overflow-hidden" style={{ background: '#F8F7F5' }}>
                <MainPreview state={{ ...createInitialState(key), boxCount: 6 }} displayWidth={340} />
              </div>
              <p className="text-[11px] font-semibold text-[#FD312E]">OPTION {key}</p>
              <p className="font-lgei font-bold text-[16px] text-gray-900">{d.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{d.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 4: AD Media (매체 선택 + 하단 줌/팬 확인창) ────────────────────────────
function AdMediaStep({ state, update }: StepProps) {
  const toggle = (id: string) => {
    const has = state.adChannelIds.includes(id);
    update({ adChannelIds: has ? state.adChannelIds.filter((x) => x !== id) : [...state.adChannelIds, id] });
  };
  const channels = AD_CHANNELS.filter((c) => state.adChannelIds.includes(c.id));

  // 줌/팬 (하단 확인창) — 팬은 리렌더 없이 ref + DOM transform 직접 갱신(부드럽게)
  const [zoomPct, setZoomPct] = useState(32);
  const [spaceOn, setSpaceOn] = useState(false);
  const [zOn, setZOn] = useState(false);
  const [altOn, setAltOn] = useState(false);
  const dragging = useRef(false);
  const spaceHeld = useRef(false);
  const zHeld = useRef(false);
  const lastPt = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ x: 24, y: 24 });
  const zoomRef = useRef(0.32);

  const applyTransform = () => {
    const el = contentRef.current;
    if (el) el.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoomRef.current})`;
  };
  useLayoutEffect(() => { applyTransform(); }); // 리렌더 후 현재 transform 재적용

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceHeld.current = true; setSpaceOn(true); e.preventDefault(); }
      if (e.key === 'z' || e.key === 'Z') { zHeld.current = true; setZOn(true); }
      if (e.altKey) setAltOn(true);
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceHeld.current = false; setSpaceOn(false); }
      if (e.key === 'z' || e.key === 'Z') { zHeld.current = false; setZOn(false); }
      if (e.key === 'Alt') setAltOn(false);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  const canvasPt = (e: React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const zoomAt = (cx: number, cy: number, factor: number) => {
    const z = zoomRef.current;
    const nz = Math.min(6, Math.max(0.1, +(z * factor).toFixed(3)));
    panRef.current = { x: cx - (cx - panRef.current.x) * (nz / z), y: cy - (cy - panRef.current.y) * (nz / z) };
    zoomRef.current = nz;
    applyTransform();
    setZoomPct(Math.round(nz * 100));
  };
  const onDown = (e: React.MouseEvent) => { if (!spaceHeld.current) return; dragging.current = true; lastPt.current = { x: e.clientX, y: e.clientY }; };
  const onMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    panRef.current = { x: panRef.current.x + (e.clientX - lastPt.current.x), y: panRef.current.y + (e.clientY - lastPt.current.y) };
    lastPt.current = { x: e.clientX, y: e.clientY };
    applyTransform(); // 리렌더 없이 DOM만
  };
  const onUp = () => { dragging.current = false; };
  const onClick = (e: React.MouseEvent) => {
    if (!zHeld.current || spaceHeld.current) return;
    const p = canvasPt(e);
    zoomAt(p.x, p.y, e.altKey ? 1 / 1.35 : 1.35);
  };
  const onWheel = (e: React.WheelEvent) => { const p = canvasPt(e); zoomAt(p.x, p.y, e.deltaY < 0 ? 1.1 : 1 / 1.1); };
  const zoomStep = (d: number) => {
    zoomRef.current = Math.min(4, Math.max(0.1, +(zoomRef.current + d).toFixed(2)));
    applyTransform();
    setZoomPct(Math.round(zoomRef.current * 100));
  };
  const reset = () => { panRef.current = { x: 24, y: 24 }; zoomRef.current = 0.32; applyTransform(); setZoomPct(32); };
  const cursor = spaceOn ? (dragging.current ? 'grabbing' : 'grab') : zOn ? (altOn ? 'zoom-out' : 'zoom-in') : 'default';

  const promo = state.promotionId ? getPromotion(state.promotionId) : undefined;
  const derived = promo ? deriveBannerColors(promo.main.hex, promo.secondary.hex, state.mainHue, state.secondaryHue) : NEUTRAL_BANNER_COLORS;
  const texture = resolveBackground(state.designType, state.backgroundTypeId).texture;

  return (
    <div>
      <Head title="AD Media" desc="Select media — the 1200×628 design applies to all its sizes." />
      <div className="grid grid-cols-2 gap-3">
        {AD_CHANNELS.map((c) => {
          const selected = state.adChannelIds.includes(c.id);
          return (
            <button key={c.id} onClick={() => toggle(c.id)} className={`h-20 rounded-xl border transition-colors flex items-center gap-3 pl-6 ${selected ? 'border-[#FD312E] bg-[#FD312E]/5' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-[#FD312E] border-[#FD312E]' : 'border-gray-300 bg-white'}`}>
                {selected && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </span>
              <span className={`text-[16px] ${selected ? 'text-[#FD312E] font-medium' : 'text-gray-800'}`}>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* 하단 확인창 (줌/팬) */}
      <div
        ref={canvasRef}
        className="mt-8 relative overflow-hidden rounded-xl border border-gray-200 select-none"
        style={{ height: 560, background: '#CDC8C1', cursor }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onClick={onClick} onWheel={onWheel}
      >
        {channels.length ? (
          <>
            {/*
              폭을 명시해야 안쪽 줄바꿈이 CANVAS_MAX_W 를 따른다.
              절대배치 + 폭 미지정이면 shrink-to-fit 이라 폭이
                min(max(가장 넓은 배너, 확인창 폭), maxWidth)
              로 정해진다 — 배너를 네이티브로 그린 뒤로는 가장 넓은 배너(1200)가 그대로
              줄 폭이 되어 큰 배너가 한 줄에 하나씩만 놓였다. maxWidth 는 걸리지도 않았다.
            */}
            <div ref={contentRef} style={{ position: 'absolute', top: 0, left: 0, width: CANVAS_MAX_W, transformOrigin: 'top left', willChange: 'transform' }}>
              <div className="flex flex-col" style={{ gap: NS(32) }}>
                {channels.map((c) => (
                  <div key={c.id}>
                    {(() => {
                      // Figma 에서 완성된(스펙이 있는) 사이즈만 보여준다.
                      // 숨김 처리된 프레임은 스펙이 없으므로 자연히 제외된다.
                      const ready = MEDIA_SIZES[c.id].filter((s) => !!getSpec(state.designType, c.id, s.name));
                      return (
                        <>
                          <p className="font-lgei font-bold text-[#4A4946]" style={{ fontSize: NS(13), marginBottom: NS(6) }}>
                            {c.label} · {ready.length} sizes
                          </p>
                          {ready.length === 0 ? (
                            <p className="text-[#6b6862]" style={{ fontSize: NS(12) }}>No sizes ready for this channel yet.</p>
                          ) : (
                            <div className="flex flex-wrap items-end" style={{ gap: NS(20), maxWidth: CANVAS_MAX_W }}>
                              {ready.map((s) => (
                                <div key={`${c.id}-${s.name}`} className="shrink-0">
                                  {/*
                                    배너는 **네이티브 크기 그대로** 그린다.
                                    여기서 또 BASE_SCALE 을 곱하면 바깥 줌(시작값도 BASE_SCALE)과 겹쳐
                                    0.32 × 0.32 = 10% 로 줄어든다 — 줌 표시는 32% 인데 실제로는 10% 였고,
                                    그 배율에서는 도형의 가는 선이 한 픽셀 아래로 내려가 뭉개진다.
                                    축소는 줌 한 곳에서만 한다.
                                  */}
                                  <SpecBannerPreview
                                    state={state} spec={getSpec(state.designType, c.id, s.name)!}
                                    design={state.designType} channel={c.id} size={s.name}
                                    displayWidth={s.w}
                                  />
                                  <p className="text-[#6b6862] whitespace-nowrap" style={{ fontSize: NS(10), marginTop: NS(4) }}>{s.name}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white rounded-full shadow-md border border-gray-200 px-1.5 py-1">
              <button onClick={() => zoomStep(-0.05)} className="p-1.5 text-gray-500 hover:text-gray-800"><ZoomOut size={15} /></button>
              <span className="text-xs text-gray-600 w-10 text-center tabular-nums">{zoomPct}%</span>
              <button onClick={() => zoomStep(0.05)} className="p-1.5 text-gray-500 hover:text-gray-800"><ZoomIn size={15} /></button>
              <div className="w-px h-4 bg-gray-200" />
              <button onClick={reset} className="p-1.5 text-gray-500 hover:text-gray-800" title="Reset"><Maximize2 size={14} /></button>
            </div>
            <p className="absolute bottom-4 left-4 text-[11px] text-[#6b6862]">Space + drag to pan · Z zoom in · Alt+Z zoom out · scroll to zoom</p>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#6b6862] text-sm">Select media above to preview all sizes.</div>
        )}
      </div>
    </div>
  );
}

// ── Step 3: Product count + preview + URLs ─────────────────────────────────────
function ProductUrlsStep({ state, update, setProduct }: StepProps & { setProduct: (i: number, v: string | null) => void }) {
  return (
    <div>
      <Head title="Promotion &amp; Product Select" desc="Pick a promotion, then choose the products." />

      {/* 프로모션 선택 — 한 묶음 박스 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 mb-6">
        <p className="font-lgei font-bold text-[15px] text-gray-900 mb-1">Promotion</p>
        <p className="text-xs text-gray-400 mb-3">Selecting a promotion sets the banner colors.</p>
        <div className="flex flex-wrap gap-2">
          {PROMOTIONS.map((p) => {
            const selected = state.promotionId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => update({ promotionId: p.id, mainHue: null, secondaryHue: null, promoName: p.label })}
                className={`inline-flex items-center gap-2 rounded-lg border pl-2.5 pr-3 py-2 transition-colors ${selected ? 'border-[#FD312E] bg-[#FD312E]/5' : 'border-gray-200 bg-white hover:border-gray-300'}`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-[#FD312E] border-[#FD312E]' : 'border-gray-300 bg-white'}`}>
                  {selected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                <span className="flex items-center -space-x-1 shrink-0">
                  <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: p.main.hex }} />
                  <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: p.secondary.hex }} />
                </span>
                <span className={`text-[13px] ${selected ? 'text-[#FD312E] font-medium' : 'text-gray-700'}`}>{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Product — 한 묶음 박스 (URL 늘면 아래로 커짐) */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <p className="font-lgei font-bold text-[15px] text-gray-900 mb-3">Product</p>

      {/* 선택 시안(A/B)의 1200×628 박스 배치 미리보기 */}
      <div className="flex flex-col items-center mb-8">
        <div className="rounded-[4px] overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.10)' }}>
          <MainPreview state={state} displayWidth={680} />
        </div>
        <p className="text-[11px] text-gray-400 mt-2">1200×628 · box placement preview</p>
      </div>

      {/* 제품 개수 선택 (미리보기 아래) */}
      <div className="flex flex-col items-center gap-2 mb-10">
        <div className="flex justify-center gap-2">
          {BOX_COUNTS.map((n) => (
            <button
              key={n}
              onClick={() => update({ boxCount: n })}
              className={`w-11 h-11 rounded-lg border text-sm font-medium transition-colors ${state.boxCount === n ? 'border-[#FD312E] text-[#FD312E] bg-[#FD312E]/5' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">{state.boxCount ? `${state.boxCount} products` : 'Select the number of products'}</p>
      </div>

      {/* 개수만큼 URL 입력 */}
      {state.boxCount ? (
        <div className="grid grid-cols-2 gap-x-10">
          {Array.from({ length: state.boxCount }).map((_, i) => (
            <ProductRow key={i} index={i + 1} value={state.products[i] ?? null} onChange={(v) => setProduct(i, v)} />
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-400 text-sm">Select the number of products above.</p>
      )}
      </div>
    </div>
  );
}

// ── Step 3: Edit (single 1200×628 window + controls, no zoom/pan) ──────────────
const BASE_SCALE = 0.32; // 실제 px → 기본 표시 배율 (AD Media 확인창의 시작 줌)

/**
 * AD Media 확인창 안쪽 콘텐츠의 가로 상한 (프레임 네이티브 px).
 *
 * 확인창은 통째로 줌 배율만큼 축소되므로 안쪽 좌표는 전부 네이티브 px 이다.
 * 확인창 자체 폭(max-w-5xl = 1024px)에서 시작 여백을 뺀 만큼만 쓰도록 환산한다.
 * 이보다 넓게 잡으면 한 줄이 화면 오른쪽 밖으로 흘러 나가 팬을 해야 다 보인다.
 * 줌을 따라 바뀌면 확대할 때마다 줄바꿈이 달라지므로 시작 줌 기준으로 고정한다.
 */
const CANVAS_MAX_W = Math.round((1024 - 48) / BASE_SCALE);

/** 확인창 안쪽 여백·글자를 "화면에서 보이길 원하는 px" 로 적기 위한 환산 */
const NS = (screenPx: number) => Math.round(screenPx / BASE_SCALE);

function EditStep({ state, update }: StepProps) {
  return (
    <div>
      <Head title="Edit" desc="Edit the representative 1200×628 design — it applies to all sizes." />
      <div className="flex rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm" style={{ height: 600 }}>
        {/* 미리보기 창 — 메인 사이즈(1200×628)는 Figma 확정 디자인으로 렌더 */}
        <div className="flex-1 flex items-center justify-center p-8" style={{ background: '#f3f1ee' }}>
          <MainPreview state={state} displayWidth={600} />
        </div>
        {/* 편집 컨트롤 */}
        <aside className="w-96 shrink-0 border-l border-gray-200 overflow-y-auto p-5 flex flex-col gap-6">
          <EditPromotion state={state} update={update} />
          <EditBackground state={state} update={update} />
          <EditGraphic state={state} update={update} />
          <EditBox state={state} update={update} />
          <EditSticker state={state} update={update} />
          <EditPromoName state={state} update={update} />
          <EditCopy state={state} update={update} />
        </aside>
      </div>
    </div>
  );
}

/** 개별 사이즈 프레임 — 프로모션 색으로 tint된 배경 + 사이즈 라벨. */
function MiniFrame({ size, main, secondary, texture, promoName, scale = BASE_SCALE }: { size: MediaSize; main: string; secondary: string; texture: string; promoName: string; scale?: number }) {
  const w = size.w * scale;
  const h = size.h * scale;
  return (
    <div className="shrink-0">
      <div style={{ width: w, height: h, position: 'relative', overflow: 'hidden', background: `linear-gradient(120deg, ${main}, ${secondary})`, boxShadow: '0 1px 5px rgba(0,0,0,0.22)' }}>
        <img src={texture} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'overlay', opacity: 0.9 }} draggable={false} />
        {promoName && (
          <span style={{ position: 'absolute', right: 5, top: 3, color: 'rgba(255,255,255,0.92)', fontSize: Math.max(7, h * 0.16), fontFamily: HEADLINE_FONT, fontWeight: HEADLINE_WEIGHT, lineHeight: 1, maxWidth: w - 10, textAlign: 'right' }}>
            {promoName}
          </span>
        )}
      </div>
      <p className="text-[#6b6862] mt-1 whitespace-nowrap" style={{ fontSize: 10 }}>{size.name}</p>
    </div>
  );
}

/**
 * 메인 1200×628 미리보기. Figma 실측 스펙이 있으면 그걸 쓰고,
 * 없으면 기존 PreviewPanel(구 A/B 좌우분할 시안)로 폴백한다.
 */
export function MainPreview({ state, displayWidth }: { state: BannerState; displayWidth: number }) {
  const spec = getSpec(state.designType, 'criteo', '1200x628');
  return spec
    ? <SpecBannerPreview state={state} spec={spec} design={state.designType} channel="criteo" size="1200x628" displayWidth={displayWidth} />
    : <PreviewPanel state={state} displayWidth={displayWidth} />;
}

function EditSection({ label, checked, onToggle, children }: {
  label: string;
  /** 주면 제목 옆에 체크박스가 붙고, 끄면 내용이 비활성화된다 (Copy 와 같은 방식) */
  checked?: boolean;
  onToggle?: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const on = checked !== false;
  return (
    <div>
      {onToggle ? (
        <label className="flex items-center gap-2 mb-2 cursor-pointer select-none w-fit">
          <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} className="accent-[#FD312E]" />
          <span className="font-lgei font-bold text-[14px] text-gray-900">{label}</span>
        </label>
      ) : (
        <p className="font-lgei font-bold text-[14px] text-gray-900 mb-2">{label}</p>
      )}
      <div className={on ? undefined : 'opacity-40 pointer-events-none'}>{children}</div>
    </div>
  );
}

/** Hue 슬라이더 한 줄 — 스와치 + 무지개 트랙 + 각도 */
function HueRow({ swatch, hue, onChange }: { swatch: string; hue: number; onChange: (h: number) => void }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-lg border border-black/10 shrink-0" style={{ background: swatch }} />
      <input
        type="range" min={0} max={360} value={hue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-2.5 rounded-full appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-400 [&::-webkit-slider-thumb]:shadow"
        style={{ background: HUE_GRADIENT }}
      />
      <span className="text-xs text-gray-500 tabular-nums shrink-0 w-9 text-right">{Math.round(hue)}°</span>
    </div>
  );
}

/** Color · Hue — Main / Combo 두 색을 각각 독립적으로 회전 */
function EditPromotion({ state, update }: StepProps) {
  const promo = state.promotionId ? getPromotion(state.promotionId) : undefined;
  if (!promo) {
    return (
      <EditSection label="Color · Hue">
        <p className="text-xs text-gray-400">Select a promotion in step 2 first.</p>
      </EditSection>
    );
  }
  const colors = deriveBannerColors(promo.main.hex, promo.secondary.hex, state.mainHue, state.secondaryHue);
  // 슬라이더 위치는 조정 전이면 프로모션 원본 색의 Hue를 가리킨다
  const mainHue = state.mainHue ?? Math.round(hexToHsl(promo.main.hex).h);
  const secHue = state.secondaryHue ?? Math.round(hexToHsl(promo.secondary.hex).h);
  const touched = state.mainHue !== null || state.secondaryHue !== null;

  return (
    <EditSection label="Color · Hue">
      <p className="text-[11px] text-gray-400 -mt-1 mb-2 truncate">{promo.label}</p>
      <div className="flex flex-col gap-2">
        <HueRow swatch={colors.main} hue={mainHue} onChange={(h) => update({ mainHue: h })} />
        <HueRow swatch={colors.secondary} hue={secHue} onChange={(h) => update({ secondaryHue: h })} />
      </div>

      {/* null 로 되돌려야 프로모션 원래 색과 정확히 일치 (슬라이더로는 반올림 오차) */}
      {touched && (
        <button
          type="button"
          onClick={() => update({ mainHue: null, secondaryHue: null })}
          className="text-[11px] text-[#FD312E] underline mt-2"
        >
          Reset to {promo.label} color
        </button>
      )}
    </EditSection>
  );
}

function EditBackground({ state, update }: StepProps) {
  return (
    <EditSection label="Background Type">
      <div className="flex items-center gap-2">
        {BACKGROUND_TYPES[state.designType].map((b) => (
          <button key={b.id} onClick={() => update({ backgroundTypeId: b.id })} title={b.label}
            className={`w-10 h-10 rounded-full overflow-hidden border-2 shrink-0 transition-colors ${state.backgroundTypeId === b.id ? 'border-[#FD312E]' : 'border-gray-200 hover:border-gray-300'}`}>
            <img src={b.texture} alt={b.label} className="w-full h-full object-cover" draggable={false} />
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
        <input type="checkbox" checked={state.colorMode === 'gradient'} onChange={(e) => update({ colorMode: e.target.checked ? 'gradient' : 'overlay' })} className="accent-[#FD312E]" />
        <span className="text-xs text-gray-600">Gradient map coloring <span className="text-gray-400">(default: overlay)</span></span>
      </label>
    </EditSection>
  );
}

/**
 * Graphic Type — 배경 위 장식 도형 6종 × 선/면 두 벌.
 * 도형 이미지가 흰색+알파라 밝은 UI에선 안 보이므로, 썸네일은 검정으로 뒤집어 보여준다.
 * 실제 배치(위치·크기·개수)는 사이즈별 스펙이 정하고 여기선 도형과 벌만 고른다.
 */
function EditGraphic({ state, update }: StepProps) {
  return (
    <EditSection label="Graphic Type">
      {/* 선/면 — 도형 선택은 그대로 두고 벌만 바꾼다 */}
      <div className="flex items-center gap-1 mb-2">
        {GRAPHIC_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => update({ graphicKind: k.id })}
            className={`px-3 h-7 rounded-full text-[12px] font-medium border transition-colors ${
              state.graphicKind === k.id
                ? 'border-[#FD312E] text-[#FD312E] bg-[#FD312E]/5'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {/* 도형 없음 — 원에 사선 하나. B 는 도형을 안 쓰는 경우가 있다. */}
        <button
          type="button"
          onClick={() => update({ graphicId: NO_GRAPHIC_ID })}
          title="None"
          className={`w-10 h-10 rounded-full overflow-hidden border-2 shrink-0 transition-colors ${
            state.graphicId === NO_GRAPHIC_ID ? 'border-[#FD312E]' : 'border-gray-200 hover:border-gray-300'
          }`}
          style={{ background: '#fff' }}
        >
          <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden>
            <line x1="9" y1="31" x2="31" y2="9" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
        {GRAPHIC_TYPES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => update({ graphicId: g.id })}
            title={g.label}
            className={`w-10 h-10 rounded-full overflow-hidden border-2 shrink-0 transition-colors ${
              state.graphicId === g.id ? 'border-[#FD312E]' : 'border-gray-200 hover:border-gray-300'
            }`}
            style={{ background: '#fff' }}
          >
            {/*
              도형 이미지는 흰색+알파라 흰 바탕에서 안 보인다. 여기는 **Edit 창 표시용**이므로
              배너와 무관하게 진한 검정 선으로 보여준다.
                · brightness(0)  → 흰색을 검정으로 (알파는 그대로)
                · drop-shadow 반복 → 같은 자리에 검정 사본을 겹쳐 얇고 흐린 선의 알파를 끌어올린다
                  (알파 a 가 n번 겹치면 1-(1-a)^(n+1) 로 진해진다)
            */}
            <img src={graphicSrc(g.id, state.graphicKind)} alt={g.label} className="w-full h-full object-cover"
              style={{
                filter: 'brightness(0) drop-shadow(0 0 0 #111) drop-shadow(0 0 0 #111) drop-shadow(0 0 0 #111) drop-shadow(0 0 0 #111)',
              }}
              draggable={false} />
          </button>
        ))}
      </div>
    </EditSection>
  );
}

function EditBox({ state, update }: StepProps) {
  return (
    <EditSection label="Box">
      {/* Sticker 스타일 버튼과 동일한 규격(flex-1 · h-9 · rounded-lg)으로 폭을 채운다 */}
      <div className="flex items-center gap-1.5">
        {BOX_STYLES_BY_DESIGN[state.designType].map((b) => (
          <button key={b.id} type="button" onClick={() => update({ boxStyleId: b.id })}
            className={`flex-1 h-9 rounded-lg border text-xs transition-colors ${(state.boxStyleId ?? DEFAULT_BOX_STYLE[state.designType]) === b.id ? 'border-[#FD312E] text-[#FD312E] bg-[#FD312E]/5' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            {b.label}
          </button>
        ))}
      </div>
    </EditSection>
  );
}

/**
 * 할인율 스티커 — 숫자(10~90) + 배경 스타일(레드 원 / 글래스).
 *
 * 입력은 draft 문자열로 받는다. 타이핑 중간값("5" → 50을 치려는 중)까지 매번 클램프하면
 * 10/90 밖으로 나갈 수 없어 사실상 두 값만 입력 가능해진다.
 * 범위 안의 온전한 숫자일 때만 즉시 반영하고, 나머지는 blur/Enter에서 클램프한다.
 */
function EditSticker({ state, update }: StepProps) {
  const [draft, setDraft] = useState(String(state.discount));
  useEffect(() => { setDraft(String(state.discount)); }, [state.discount]);

  const commit = () => {
    const n = Number(draft);
    const v = Number.isFinite(n) && draft.trim() !== ''
      ? Math.min(MAX_DISCOUNT, Math.max(MIN_DISCOUNT, Math.round(n)))
      : state.discount;
    setDraft(String(v));
    if (v !== state.discount) update({ discount: v });
  };

  const onChange = (v: string) => {
    setDraft(v);
    const n = Number(v);
    // 범위 안의 온전한 값이면 미리보기에 바로 반영
    if (/^\d+$/.test(v) && n >= MIN_DISCOUNT && n <= MAX_DISCOUNT) update({ discount: n });
  };

  return (
    <EditSection label="Sticker" checked={state.showSticker} onToggle={(v) => update({ showSticker: v })}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[11px] text-gray-500 shrink-0">UP TO</span>
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
          className="w-16 h-9 px-2 rounded-lg border border-gray-200 text-[13px] text-center tabular-nums outline-none focus:border-[#FD312E]"
        />
        <span className="text-[11px] text-gray-500 shrink-0">% off</span>
        <span className="text-[10px] text-gray-400 ml-auto shrink-0">{MIN_DISCOUNT}–{MAX_DISCOUNT}</span>
      </div>
      {/*
        2열 그리드로 둔다. flex-1 이면 옵션이 하나뿐인 B 에서 버튼이 폭을 꽉 채워
        A 의 버튼보다 두 배로 커진다. 그리드면 옵션 수와 무관하게 한 칸 폭을 유지한다.
      */}
      <div className="grid grid-cols-2 gap-1.5">
        {STICKER_STYLES_BY_DESIGN[state.designType].map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => update({ stickerStyle: o.id })}
            className={`h-9 rounded-lg border text-xs transition-colors ${
              (state.stickerStyle ?? DEFAULT_STICKER_STYLE[state.designType]) === o.id ? 'border-[#FD312E] text-[#FD312E] bg-[#FD312E]/5' : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/*
        색이 칠해지는 스티커에만 색상 조절을 붙인다 — A 의 레드 원, B 의 별.
        둘 다 렌더에서 같은 기준색(STICKER_RED)을 Hue 로 돌려 쓴다.
        글래스는 배경을 그대로 비추는 재질이라 돌릴 색 자체가 없다.
      */}
      {resolveStickerStyle(state.designType, state.stickerStyle) !== 'glass' && (
        <div className="mt-2.5">
          <HueRow
            swatch={state.stickerHue === null ? STICKER_RED : hslToHex(state.stickerHue, hexToHsl(STICKER_RED).s, hexToHsl(STICKER_RED).l)}
            hue={state.stickerHue ?? Math.round(hexToHsl(STICKER_RED).h)}
            onChange={(h) => update({ stickerHue: h })}
          />
          {state.stickerHue !== null && (
            <button
              type="button"
              onClick={() => update({ stickerHue: null })}
              className="mt-1.5 text-[11px] text-gray-400 hover:text-[#FD312E] transition-colors"
            >
              Reset to original
            </button>
          )}
        </div>
      )}
    </EditSection>
  );
}

/** 프로모션 명칭 — 입력만. (폰트는 Figma 확정대로 LGEI Headline Semibold 고정) */
function EditPromoName({ state, update }: StepProps) {
  return (
    <EditSection label="Promotion Name">
      <input type="text" value={state.promoName} onChange={(e) => update({ promoName: e.target.value })} placeholder="Promotion name"
        className="w-full h-9 px-2.5 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-[#FD312E]" />
    </EditSection>
  );
}

function EditCopy({ state, update }: StepProps) {
  return (
    <EditSection label="Copy">
      <div className="flex flex-col gap-2.5">
        <CopyField label="Head copy" max={MAX_HEADLINE} multiline checked={state.showHeadline} value={state.headline} onToggle={(v) => update({ showHeadline: v })} onChange={(v) => update({ headline: v })} />
        <CopyField label="Sub copy" max={MAX_SUBCOPY} multiline checked={state.showSubcopy} value={state.subcopy} onToggle={(v) => update({ showSubcopy: v })} onChange={(v) => update({ subcopy: v })} />
      </div>
    </EditSection>
  );
}

function CopyField({ label, checked, value, multiline, max, onToggle, onChange }: { label: string; checked: boolean; value: string; multiline?: boolean; max?: number; onToggle: (v: boolean) => void; onChange: (v: string) => void }) {
  const cls = 'w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-[#FD312E] disabled:opacity-40 disabled:bg-gray-50';
  return (
    <div>
      <label className="flex items-center gap-2 mb-1 cursor-pointer select-none">
        <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="accent-[#FD312E]" />
        <span className="text-xs font-medium text-gray-600">{label}</span>
        {max !== undefined && (
          <span className="text-[10px] text-gray-400 ml-auto tabular-nums">Max {max} chars · {value.length}/{max}</span>
        )}
      </label>
      {multiline ? (
        <textarea value={value} rows={2} maxLength={max} disabled={!checked} onChange={(e) => onChange(e.target.value)} className={`${cls} resize-none`} />
      ) : (
        <input type="text" value={value} maxLength={max} disabled={!checked} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}

// ── Step 5: Review & Download ──────────────────────────────────────────────────
function ReviewStep({ state }: { state: BannerState }) {
  const channels = AD_CHANNELS.filter((c) => state.adChannelIds.includes(c.id)).map((c) => c.label).join(', ') || '—';
  const promo = state.promotionId ? getPromotion(state.promotionId) : undefined;
  return (
    <div>
      <Head title="Review & Download" desc="Check the banner, then download. (export wired after Figma sizes)" />
      <dl className="flex flex-col gap-2 text-sm max-w-md">
        {[
          ['Template', DESIGN_TYPES[state.designType].name],
          ['Media', channels],
          ['Promotion', promo?.label ?? '—'],
          ['Products', String(state.products.filter(Boolean).length)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-gray-100 pb-2">
            <dt className="text-gray-400">{k}</dt>
            <dd className="text-gray-800 text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
