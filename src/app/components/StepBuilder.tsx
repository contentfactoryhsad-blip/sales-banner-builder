import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { AppHeader } from './AppHeader';
import { WizardBreadcrumb } from './WizardBreadcrumb';
import { PreviewPanel } from './PreviewPanel';
import { ProductRow } from './LeftOptionsPanel';
import { createInitialState, sampleState, DESIGN_TYPES, type BannerState, type DesignType } from '../types';
import { PROMOTIONS, getPromotion, promoPair, type ColorSet } from '../../data/promotions';
import { AD_CHANNELS, BACKGROUND_TYPES, BOX_STYLES_BY_DESIGN, BOX_COUNTS, COLOR_MODES_BY_DESIGN, DEFAULT_BOX_STYLE, DEFAULT_COLOR_MODE, DEFAULT_STICKER_STYLE, GRAPHIC_KINDS, GRAPHIC_TYPES, graphicSrc, NO_GRAPHIC_ID, MAX_HEADLINE, MAX_HEAD_BLOCK, MAX_SUBCOPY, MIN_DISCOUNT, MAX_DISCOUNT, STICKER_STYLES_BY_DESIGN, resolveStickerStyle } from '../../data/builderOptions';
import { resolveBackground } from '../../data/builderOptions';
import { MEDIA_SIZES, type MediaSize } from '../../data/mediaSizes';
import { copyBudget, reflowCopy } from '../utils/copyFit';
import { useFontsReady } from '../utils/textFit';
import { HEADLINE_FONT, HEADLINE_WEIGHT, STICKER_STYLES, STICKER_RED } from '../../data/sizeLayouts';
import { SpecBannerPreview } from './SpecBannerPreview';
import { getSpec } from '../../data/figmaStyle';
import { useBannerZip } from './useBannerZip';
import { hexToHsl, hslToHex, NEUTRAL_BANNER_COLORS } from '../utils/color';

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
  const zip = useBannerZip(state);

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
          {step === 5 && <ReviewStep state={state} zip={zip} />}
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
          <button
            type="button"
            onClick={zip.run}
            disabled={zip.progress.busy || zip.count === 0}
            className="h-10 px-6 rounded-lg bg-[#FD312E] text-white text-sm font-medium hover:bg-[#E22825] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {zip.progress.busy
              ? `Rendering ${zip.progress.done}/${zip.progress.total}…`
              : `Download ZIP (${zip.count})`}
          </button>
        )}
      </div>

      {/* 굽는 동안만 화면 밖에서 한 장씩 그려지는 자리 */}
      {zip.host}
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
            <button key={key} onClick={() => update({ designType: key, backgroundTypeId: null, boxStyleId: DEFAULT_BOX_STYLE[key], stickerStyle: DEFAULT_STICKER_STYLE[key], colorMode: DEFAULT_COLOR_MODE[key] })} className={`text-left rounded-2xl border p-4 transition-all ${selected ? 'border-[#FD312E] ring-1 ring-[#FD312E] shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="mb-3 flex justify-center rounded-lg overflow-hidden" style={{ background: '#F8F7F5' }}>
                <MainPreview state={sampleState(key)} displayWidth={340} />
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

/** 오른쪽 세로 줌 바 — 확인창 위쪽 끝부터 한가운데까지. 안쪽 여백은 손잡이 반지름만큼. */
const BAR_H = 260;
const BAR_PAD = 12;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;

// ── Step 4: AD Media (매체 선택 + 하단 줌/팬 확인창) ────────────────────────────
function AdMediaStep({ state, update }: StepProps) {
  const toggle = (id: string) => {
    const has = state.adChannelIds.includes(id);
    update({ adChannelIds: has ? state.adChannelIds.filter((x) => x !== id) : [...state.adChannelIds, id] });
  };
  const channels = AD_CHANNELS.filter((c) => state.adChannelIds.includes(c.id));

  // 줌/팬 (하단 확인창) — 팬은 리렌더 없이 ref + DOM transform 직접 갱신(부드럽게)
  const [zoomPct, setZoomPct] = useState(32);
  const [zOn, setZOn] = useState(false);
  const [altOn, setAltOn] = useState(false);
  const dragging = useRef(false);
  const zHeld = useRef(false);
  const lastPt = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ x: 24, y: 24 });
  const zoomRef = useRef(0.32);
  const barRef = useRef<HTMLDivElement>(null);
  const [barDragging, setBarDragging] = useState(false);
  const [grabbing, setGrabbing] = useState(false);

  const applyTransform = () => {
    const el = contentRef.current;
    if (el) el.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoomRef.current})`;
  };
  useLayoutEffect(() => { applyTransform(); }); // 리렌더 후 현재 transform 재적용

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'z' || e.key === 'Z') { zHeld.current = true; setZOn(true); }
      if (e.altKey) setAltOn(true);
    };
    const ku = (e: KeyboardEvent) => {
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
  /*
    will-change: transform 은 **끌고 있는 동안만** 건다.

    이 힌트가 켜져 있으면 브라우저가 콘텐츠를 한 번 래스터해 둔 텍스처를 그대로
    확대/축소한다 (transform 애니메이션을 싸게 만들려는 게 원래 목적). 그래서 줌을
    올려도 다시 그리지 않아, 도형의 가는 선(1200px 원본에서 3px)이 배너 크기(179px)로
    줄어든 채 확대되어 계단지고 끊겨 보였다.
    끌 때만 켜면 팬은 그대로 부드럽고, 줌은 그 배율에서 새로 래스터된다.
  */
  const setSmoothPan = (on: boolean) => {
    const el = contentRef.current;
    if (el) el.style.willChange = on ? 'transform' : 'auto';
  };
  /*
    그냥 눌러서 끌면 팬이다.
    이 확인창은 보기만 하는 곳이라 잘못 눌러서 망가질 것이 없으니, 가장 자주 쓰는
    동작을 아무 준비 없이 되게 한다. (예전엔 Space 를 잡아야 팬이었는데, 드래그가
    곧 팬이 된 뒤로는 같은 일을 두 가지로 하는 셈이라 없앴다.)
  */
  const onDown = (e: React.MouseEvent) => { dragging.current = true; setGrabbing(true); setSmoothPan(true); lastPt.current = { x: e.clientX, y: e.clientY }; };
  const onMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    panRef.current = { x: panRef.current.x + (e.clientX - lastPt.current.x), y: panRef.current.y + (e.clientY - lastPt.current.y) };
    lastPt.current = { x: e.clientX, y: e.clientY };
    applyTransform(); // 리렌더 없이 DOM만
  };
  const onUp = () => { if (dragging.current) { setSmoothPan(false); setGrabbing(false); } dragging.current = false; };
  const onClick = (e: React.MouseEvent) => {
    if (!zHeld.current) return;
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

  /*
    오른쪽 세로 줌 바 — 잡고 위로 올리면 줌인, 내리면 줌아웃.

    배율은 **로그로** 건다. 0.1→0.5 와 3.6→4 는 더한 값은 같아도 체감이 전혀 달라서,
    선형으로 깔면 바 아래쪽 절반이 거의 안 움직이는 것처럼 느껴진다.
    확대 기준점은 확인창 한가운데다 — 바를 끄는 동안 보고 있던 자리가 밀려나지 않는다.
  */
  const zoomFromBar = (clientY: number) => {
    const r = barRef.current?.getBoundingClientRect();
    const c = canvasRef.current?.getBoundingClientRect();
    if (!r || !c) return;
    const span = r.height - BAR_PAD * 2;
    const t = Math.min(1, Math.max(0, 1 - (clientY - (r.top + BAR_PAD)) / span)); // 위가 1
    const nz = ZOOM_MIN * Math.pow(ZOOM_MAX / ZOOM_MIN, t);
    zoomAt(c.width / 2, c.height / 2, nz / zoomRef.current);
  };
  // 바 밖으로 끌고 나가도 계속 따라오게 창 전체에서 듣는다
  useEffect(() => {
    if (!barDragging) return;
    const mm = (e: MouseEvent) => zoomFromBar(e.clientY);
    const mu = () => setBarDragging(false);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barDragging]);
  const barT = Math.min(1, Math.max(0, Math.log(zoomPct / 100 / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN)));

  // 기본이 팬이므로 손 모양이 기본이다. Z 를 잡고 있을 때만 돋보기로 바뀐다.
  const cursor = zOn ? (altOn ? 'zoom-out' : 'zoom-in') : grabbing ? 'grabbing' : 'grab';

  const promo = state.promotionId ? getPromotion(state.promotionId) : undefined;
  const derived = promo
    ? (() => { const q = promoPair(promo, state.colorSet); return { main: q.main.hex, secondary: q.secondary.hex }; })()
    : NEUTRAL_BANNER_COLORS;
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
            <div ref={contentRef} style={{ position: 'absolute', top: 0, left: 0, width: CANVAS_MAX_W, transformOrigin: 'top left' }}>
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
            {/* 세로 줌 바 — 잡고 위로 올리면 줌인, 내리면 줌아웃 */}
            <div
              ref={barRef}
              onMouseDown={(e) => { e.stopPropagation(); setBarDragging(true); zoomFromBar(e.clientY); }}
              onClick={(e) => e.stopPropagation()} /* 캔버스의 Z-클릭 줌이 같이 터지지 않게 */
              className="absolute right-4 top-4 w-7 rounded-full bg-white/90 shadow-md border border-gray-200 cursor-ns-resize"
              style={{ height: BAR_H }}
              title="Drag up to zoom in, down to zoom out"
            >
              <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-gray-200" style={{ top: BAR_PAD, bottom: BAR_PAD, width: 3 }} />
              <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-[#FD312E]"
                style={{ top: BAR_PAD + (1 - barT) * (BAR_H - BAR_PAD * 2), bottom: BAR_PAD, width: 3 }} />
              <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white border-2 border-[#FD312E] shadow"
                style={{ width: 13, height: 13, top: BAR_PAD + (1 - barT) * (BAR_H - BAR_PAD * 2) - 6.5 }} />
            </div>

            <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white rounded-full shadow-md border border-gray-200 px-1.5 py-1">
              <button onClick={() => zoomStep(-0.05)} className="p-1.5 text-gray-500 hover:text-gray-800"><ZoomOut size={15} /></button>
              <span className="text-xs text-gray-600 w-10 text-center tabular-nums">{zoomPct}%</span>
              <button onClick={() => zoomStep(0.05)} className="p-1.5 text-gray-500 hover:text-gray-800"><ZoomIn size={15} /></button>
              <div className="w-px h-4 bg-gray-200" />
              <button onClick={reset} className="p-1.5 text-gray-500 hover:text-gray-800" title="Reset"><Maximize2 size={14} /></button>
            </div>
            <p className="absolute bottom-4 left-4 text-[11px] text-[#6b6862]">Drag to pan · Z zoom in · Alt+Z zoom out · scroll to zoom · drag the right bar to zoom</p>
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
                onClick={() => update({ promotionId: p.id, colorSet: 'recommended', promoName: p.label })}
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
            <ProductRow key={i} index={i + 1} value={state.products[i] ?? null} onChange={(v) => setProduct(i, v)}
              onMeta={(m) => update({ productMeta: state.productMeta.map((x, k) => (k === i ? m : x)) })} />
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
  /*
    Hue 슬라이더 대신 **두 벌 중 하나**만 고르게 한다.
    아무 색이나 나오면 브랜드 톤이 흐트러지고, 나라별 법인이 제각각 쓰게 된다.
    추천 = 2단계에서 프로모션을 고를 때 따라온 색, 서브 = 같은 분위기의 대안.
  */
  const sets: { id: ColorSet; label: string }[] = [
    { id: 'recommended', label: 'Recommended' },
    { id: 'sub', label: 'Sub' },
  ];

  return (
    <EditSection label="Color">
      <p className="text-[11px] text-gray-400 -mt-1 mb-2 truncate">{promo.label}</p>
      <div className="flex flex-col gap-1.5">
        {sets.map((set) => {
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
      {/* 색 입히는 방식 — 흑백 무늬에 프로모션 색을 어떻게 얹을지 */}
      <div className="mt-3">
        <p className="text-[11px] text-gray-400 mb-1.5">Coloring</p>
        <div className="flex items-center gap-1">
          {COLOR_MODES_BY_DESIGN[state.designType].map((m) => (
            <button
              key={m.id} type="button" onClick={() => update({ colorMode: m.id })} title={m.desc}
              className={`px-2.5 h-7 rounded-full text-[11px] font-medium border transition-colors ${
                state.colorMode === m.id ? 'border-[#FD312E] text-[#FD312E] bg-[#FD312E]/5'
                                         : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
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
      {/* 선/면 — 도형 선택은 그대로 두고 벌만 바꾼다. 벌이 하나뿐이면 감춘다. */}
      <div className={`items-center gap-1 mb-2 ${GRAPHIC_KINDS.length > 1 ? 'flex' : 'hidden'}`}>
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

/**
 * Copy — 프로모션 명칭까지 한 묶음으로 편집한다.
 *
 * 배너에서 이 셋은 좌패널 한 상자 안에 세로로 쌓이는 한 덩어리다(SpecBannerPreview
 * 의 head 블록). 그래서 편집도 한 자리에서 한다 — 예전엔 "Promotion Name" 이
 * 별도 섹션이라 같은 상자를 두 곳에서 나눠 고치는 꼴이었다.
 * 명칭 자체는 Step 2 에서 프로모션을 고르면 자동으로 채워지고, 여기서 고칠 수 있다.
 * (폰트는 Figma 확정대로 LGEI Headline Semibold 고정)
 */
function EditCopy({ state, update }: StepProps) {
  // 웹폰트가 붙기 전에 잰 폭은 대체 폰트 기준이라 틀리다 — 붙고 나면 다시 잰다
  const fontsReady = useFontsReady();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const budget = useMemo(() => copyBudget(state.designType), [state.designType, fontsReady]);
  /*
    프로모션 명칭 + 헤드카피를 한 칸에서 고친다 — 배너에서 둘은 같은 상자 안에
    위아래로 붙는 한 덩어리라 나눠 놓을 이유가 없다.
    저장은 예전대로 두 값으로 나눠 둔다. 사이즈별로 명칭은 명칭대로(promoBreak·
    fitScale), 헤드카피는 헤드카피대로(headLines) 따로 접히기 때문이다.

    **글은 이 칸이 직접 들고 있는다.** 예전엔 입력값을 쪼갰다 다시 합쳐서 textarea 에
    되돌려줬는데, 그러면 친 것과 되돌아온 것이 달라지는 순간(빈 줄에 \n 을 도로
    붙이거나 공백을 다듬을 때) 커서가 튀고 윗줄이 안 지워졌다.
  */
  const [raw, setRaw] = useState(() => joinCopy(state.promoName, state.headline));
  const total = raw.replace(/\n/g, '').length;

  // 바깥에서 바뀐 값(2단계에서 프로모션을 고르면 명칭이 바뀐다)만 받아 적는다.
  // 내가 방금 올려보낸 값이면 쪼갠 결과가 같으므로 건드리지 않는다.
  useEffect(() => {
    const [p, h] = splitCopy(raw);
    if (p !== state.promoName || h !== state.headline) setRaw(joinCopy(state.promoName, state.headline));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.promoName, state.headline]);

  const onHeadChange = (v: string) => {
    // 글자수 뚜껑은 늘리는 방향일 때만 (지우는 건 언제나 허용)
    if (v.length > raw.length && v.replace(/\n/g, '').length > MAX_HEAD_BLOCK) return;
    // 폭을 넘치면 막는 게 아니라 아랫줄로 흘려보낸다. 그래도 못 담으면 그때 안 받는다.
    const flowed = reflowCopy(v, budget, COPY_LINES);
    if (flowed === null) return;
    setRaw(flowed);
    const [p, h] = splitCopy(flowed);
    update({ promoName: p, headline: h, showHeadline: true });
  };

  return (
    <EditSection label="Copy">
      <div className="flex flex-col gap-2.5">
        <div>
          <label className="flex items-center gap-2 mb-1 select-none">
            <span className="text-xs font-medium text-gray-600">Head copy</span>
            <span className="text-[10px] text-gray-400 ml-auto tabular-nums">Max {MAX_HEAD_BLOCK} chars · {total}/{MAX_HEAD_BLOCK}</span>
          </label>
          <textarea value={raw} rows={2} onChange={(e) => onHeadChange(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-[#FD312E] resize-none" />
        </div>
        <CopyField label="Sub copy" max={MAX_SUBCOPY} multiline value={state.subcopy} onChange={(v) => update({ subcopy: v })} />
      </div>
    </EditSection>
  );
}

/** 헤드카피 칸이 쓰는 줄 수 — 첫 줄 프로모션 명칭 + 둘째 줄 헤드카피. */
const COPY_LINES = 2;

/** 첫 줄 = 프로모션 명칭, 나머지 = 헤드카피. 둘로 나눌 때와 합칠 때가 늘 짝이 맞아야 한다. */
function splitCopy(raw: string): [string, string] {
  const [first = '', ...rest] = raw.split('\n');
  return [first, rest.join(' ').trim()];
}
function joinCopy(promoName: string, headline: string) {
  return headline ? `${promoName}\n${headline}` : promoName;
}

/** checked/onToggle 을 주지 않으면 체크박스 없이 늘 켜진 칸이 된다. */
function CopyField({ label, checked, value, multiline, max, onToggle, onChange }: { label: string; checked?: boolean; value: string; multiline?: boolean; max?: number; onToggle?: (v: boolean) => void; onChange: (v: string) => void }) {
  const cls = 'w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-[#FD312E] disabled:opacity-40 disabled:bg-gray-50';
  const on = checked !== false;
  return (
    <div>
      <label className="flex items-center gap-2 mb-1 cursor-pointer select-none">
        {onToggle && <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} className="accent-[#FD312E]" />}
        <span className="text-xs font-medium text-gray-600">{label}</span>
        {max !== undefined && (
          <span className="text-[10px] text-gray-400 ml-auto tabular-nums">Max {max} chars · {value.length}/{max}</span>
        )}
      </label>
      {multiline ? (
        <textarea value={value} rows={2} maxLength={max} disabled={!on} onChange={(e) => onChange(e.target.value)} className={`${cls} resize-none`} />
      ) : (
        <input type="text" value={value} maxLength={max} disabled={!on} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}

// ── Step 5: Review & Download ──────────────────────────────────────────────────
function ReviewStep({ state, zip }: { state: BannerState; zip: ReturnType<typeof useBannerZip> }) {
  const picked = AD_CHANNELS.filter((c) => state.adChannelIds.includes(c.id));
  const promo = state.promotionId ? getPromotion(state.promotionId) : undefined;
  const { busy, done, total, current, error, failed } = zip.progress;
  return (
    <div>
      <Head title="Review & Download" desc="Downloads a ZIP with one folder per media." />
      <dl className="flex flex-col gap-2 text-sm max-w-md">
        {[
          ['Template', DESIGN_TYPES[state.designType].name],
          ['Media', picked.map((c) => c.label).join(', ') || '—'],
          ['Promotion', promo?.label ?? '—'],
          ['Products', String(state.products.filter(Boolean).length)],
          ['Banners', `${zip.count} files`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-gray-100 pb-2">
            <dt className="text-gray-400">{k}</dt>
            <dd className="text-gray-800 text-right">{v}</dd>
          </div>
        ))}
      </dl>

      {/* ZIP 안에 어떤 폴더로 들어가는지 미리 보여준다 */}
      <div className="mt-6 max-w-md rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] text-gray-400 mb-2">ZIP structure</p>
        <ul className="text-[12px] text-gray-700 font-mono leading-6">
          {picked.map((c) => (
            <li key={c.id}>
              {c.id}/ <span className="text-gray-400">
                {MEDIA_SIZES[c.id].filter((s) => !!getSpec(state.designType, c.id, s.name)).length} png
              </span>
            </li>
          ))}
          {picked.length === 0 && <li className="text-gray-400">Pick media in step 4 first.</li>}
        </ul>
      </div>

      {busy && (
        <div className="mt-5 max-w-md">
          <div className="flex justify-between text-[12px] text-gray-500 mb-1.5">
            <span>Rendering {current ?? ''}</span>
            <span className="tabular-nums">{done} / {total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full bg-[#FD312E] transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      {error && <p className="mt-4 text-[12px] text-[#FD312E]">{error}</p>}
      {!busy && failed.length > 0 && (
        <p className="mt-4 text-[12px] text-gray-500">
          Skipped {failed.length}: {failed.join(', ')}
        </p>
      )}
    </div>
  );
}
