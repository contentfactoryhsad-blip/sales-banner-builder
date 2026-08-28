import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from './AppHeader';
import { WizardBreadcrumb } from './WizardBreadcrumb';
import { PreviewPanel } from './PreviewPanel';
import { ProductRow } from './LeftOptionsPanel';
import { createInitialState, DESIGN_TYPES, type BannerState, type DesignType } from '../types';
import { PROMOTIONS, getPromotion, promoPair, type ColorSet } from '../../data/promotions';
import { AD_CHANNELS, BACKGROUND_TYPES, BOX_STYLES_BY_DESIGN, BOX_COUNTS, COLOR_MODES_BY_DESIGN, DEFAULT_BOX_STYLE, DEFAULT_COLOR_MODE, DEFAULT_STICKER_STYLE, GRAPHIC_KINDS, GRAPHIC_TYPES, graphicSrc, NO_GRAPHIC_ID, MAX_HEADLINE, MAX_HEAD_BLOCK, MAX_SUBCOPY, MIN_DISCOUNT, MAX_DISCOUNT, STICKER_STYLES_BY_DESIGN, resolveStickerStyle } from '../../data/builderOptions';
import { resolveBackground } from '../../data/builderOptions';
import { MEDIA_SIZES, type MediaSize } from '../../data/mediaSizes';
import { LOGO_VARIANTS } from '../../data/logos';
import { ENABLE_COLORING_OPTION, ENABLE_LOGO_CHANGE } from '../featureFlags';
import { copyBudget, reflowCopy } from '../utils/copyFit';
import { useFontsReady } from '../utils/textFit';
import { HEADLINE_FONT, HEADLINE_WEIGHT, STICKER_STYLES, STICKER_RED } from '../../data/sizeLayouts';
import { SpecBannerPreview } from './SpecBannerPreview';
import { BOX_MATERIALS, getSpec, isWideFrame, specKey } from '../../data/figmaStyle';
import { useBannerZip } from './useBannerZip';
import { alphaOf, hexToHsl, hslToHex, NEUTRAL_BANNER_COLORS } from '../utils/color';

/** 의견 입력 상한 — 기록 CSV 한 칸에 들어갈 만한 길이 */
const MAX_COMMENT = 300;

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
  // 1단계 카드에 고른 테두리를 보일지. 바탕을 누르면 내려간다 (DesignStep 설명 참고)
  const [designPicked, setDesignPicked] = useState(true);

  /*
    헤더의 "Sales Banner Builder" 를 누르면 어느 단계에 있든 첫 화면(1단계)으로.

    **고른 값은 지우지 않는다.** 홈으로 간다고 입력을 날리면 5단계까지 채워 둔
    제품 주소·카피를 한 번의 오발로 잃는다. 자리만 1단계로 옮기므로 브레드크럼으로
    바로 돌아올 수 있다. (처음부터 다시 하려면 새로고침이 여전히 그 역할을 한다)

    스크롤도 같이 올린다 — 안 그러면 아래로 내려간 자리 그대로 1단계가 열려
    화면이 깨진 것처럼 보인다.
  */
  const bodyRef = useRef<HTMLDivElement>(null);
  const goHome = () => {
    setStep(1);
    setDesignPicked(true);
    bodyRef.current?.scrollTo({ top: 0 });
  };

  return (
    <div className="h-screen flex flex-col bg-[#f8f7f5]">
      <AppHeader title="Sales Banner Builder" onBack={onExit} onHome={goHome} right={onExit ? <span className="text-xs text-gray-500">Mode A · Step by step</span> : undefined} />
      <WizardBreadcrumb steps={STEPS} activeStep={step} onStepClick={setStep} />

      {/*
        Body — 1단계에서는 **바탕을 누르면 고른 티를 내린다.**
        빈자리까지 포함해야 해서 카드가 아니라 이 스크롤 영역이 클릭을 받는다.
        (카드 쪽에서 stopPropagation 하므로 고를 때는 안 내려간다)
      */}
      <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto px-10 py-8"
        onClick={step === 1 ? () => setDesignPicked(false) : undefined}>
        <div className="max-w-5xl mx-auto">
          {step === 1 && (
            <DesignStep state={state} update={update}
              picked={designPicked} onPick={() => setDesignPicked(true)}
              onChosen={() => setStep(2)} />
          )}
          {step === 2 && <ProductUrlsStep state={state} update={update} setProduct={setProduct} />}
          {step === 3 && <EditStep state={state} update={update} />}
          {step === 4 && <AdMediaStep state={state} update={update} />}
          {step === 5 && <ReviewStep state={state} update={update} zip={zip} />}
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
        {/*
          1단계에는 Next 가 없다 — 시안을 고르는 순간 넘어가므로(DesignStep 참고)
          버튼이 남아 있으면 "골랐는데 또 눌러야 하나" 싶은 군더더기가 된다.
          자리만 지켜 가운데 단계 표시가 안 흔들리게 한다.
        */}
        {step === 1 ? (
          <span />
        ) : step < STEPS.length ? (
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

/** Step 1 썸네일 — 라이브 렌더 대신 레퍼런스 완성본 이미지를 그대로 쓴다 */
const DESIGN_STEP_THUMBS: Record<DesignType, string> = {
  A: '/main/main-a.png',
  B: '/main/main-b.png',
};

// ── Step 1: Select Template (A/B) ──────────────────────────────────────────────
/**
 * `picked` 는 **테두리를 보일지**만 정한다.
 *
 * state.designType 은 뒤 단계가 계속 필요하므로(무엇을 그릴지 정한다) 끄지 않는다.
 * 바탕을 눌렀을 때 고른 티만 내려서, 다시 고르라는 신호로 쓴다.
 */
/**
 * 1단계 — 시안(A/B) 고르기.
 *
 * **고르는 순간 2단계로 넘어간다.** 둘 중 하나를 고르는 것 말고는 할 일이 없는
 * 화면이라, 고른 뒤 오른쪽 아래 Next 를 또 찾아 눌러야 하는 게 군더더기였다.
 * 그래서 이 단계에는 Next 버튼 자체가 없다(아래 bottom nav 참고).
 */
function DesignStep({ state, update, picked, onPick, onChosen }: StepProps & { picked: boolean; onPick: () => void; onChosen: () => void }) {
  return (
    <div>
      <Head title="Design Template Select" desc="Pick the background design approach." />
      <div className="grid grid-cols-2 gap-5">
        {(['A', 'B'] as DesignType[]).map((key) => {
          const d = DESIGN_TYPES[key];
          const selected = picked && state.designType === key;
          /*
            시안을 바꾸면 박스 **재질도 함께 바뀐다**(A=glass / B=white). 그러면
            투명도도 같이 되돌려야 한다 — EditBox 의 재질 버튼이 하는 것과 같은 이유다:
            알파는 재질이 원래 갖고 있던 값(glass 0.15 · white 1) 기준이라, 글래스에서
            잡아둔 값이 화이트로 넘어오면 흰 박스가 반투명해져 **박스가 사라져 보인다.**

            카드 클릭이 바탕까지 올라가면 고르자마자 테두리가 도로 내려가므로,
            여기서 stopPropagation 으로 끊는다.
          */
          return (
            <button key={key} onClick={(e) => { e.stopPropagation(); onPick(); update({ designType: key, backgroundTypeId: null, boxStyleId: DEFAULT_BOX_STYLE[key], boxOpacity: null, stickerStyle: DEFAULT_STICKER_STYLE[key], colorMode: DEFAULT_COLOR_MODE[key] }); onChosen(); }} className={`text-left rounded-2xl border p-4 transition-all cursor-pointer ${selected ? 'border-[#FD312E] ring-1 ring-[#FD312E] shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}`}>
              <div className="mb-3 flex justify-center rounded-lg overflow-hidden" style={{ background: '#F8F7F5' }}>
                <img src={DESIGN_STEP_THUMBS[key]} alt={d.name} className="w-full h-auto block" />
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

/**
 * 사이즈들을 **세로 칸으로 묶는다** — 큰 배너 위에 남는 자리에 작은 배너를 올린다.
 *
 * 그냥 한 줄에 늘어놓으면 세로로 긴 배너(1080x1920) 옆이 통째로 비어, 매체 하나가
 * 화면을 한참 차지한다. 큰 것부터 칸을 만들고, 뒤에 오는 작은 배너는 **폭이 들어가고
 * 가장 높은 칸을 넘지 않는** 칸에 얹는다. 칸 안은 작은 것이 위, 큰 것이 아래다.
 *
 * 칸 자체는 바깥 flex-wrap 이 접어 주므로 여기서는 폭 제한을 신경 쓰지 않는다.
 */
const isWide = (s: MediaSize) => isWideFrame(s.w, s.h);

const CAPTION_H = 34;   // 배너 아래 사이즈 이름이 차지하는 높이 (네이티브 px 기준)
const STACK_GAP = 20;

function packSizes(sizes: MediaSize[]): MediaSize[][] {
  const items = [...sizes].sort((a, b) => b.h - a.h);
  const cols: { w: number; h: number; items: MediaSize[] }[] = [];
  for (const s of items) {
    const h = s.h + CAPTION_H;
    const tallest = cols.reduce((m, c) => Math.max(m, c.h), 0);
    let best: (typeof cols)[number] | null = null;
    for (const c of cols) {
      if (s.w > c.w) continue;                       // 칸보다 넓으면 못 들어간다
      if (c.h + STACK_GAP + h > tallest) continue;   // 넣으면 칸이 가장 높은 칸보다 커진다
      if (!best || c.h < best.h) best = c;           // 가장 빈 칸에
    }
    if (best) { best.items.push(s); best.h += STACK_GAP + h; }
    else cols.push({ w: s.w, h, items: [s] });
  }
  /*
    칸 높이는 서로 맞추고(stretch) 칸 안은 위·아래로 벌린다(justify-between) —
    첫 배너가 매체 제목 바로 아래에 붙고 마지막 배너는 바닥에 맞춰진다.
    칸 순서는 **낮은 칸이 왼쪽**이다 — 담을 때는 큰 것부터 넣어 가장 높은 칸이 먼저
    만들어지므로, 그대로 두면 제일 긴 배너가 왼쪽에 서서 그림과 반대가 된다.
    칸 안은 작은 것이 위다 (담긴 순서가 큰 것부터라 뒤집는다).
  */
  return [...cols]
    .sort((a, b) => a.h - b.h)
    .map((c) => [...c.items].reverse());
}

/** 스크롤 바 굵기(px). 얇게 두고 손잡이만 보이게 한다. */
const SB_SIZE = 12;
/** 오른쪽 세로 줌 슬라이더 — 스크롤바(SB_SIZE)를 피해 안쪽에 둔다. */
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
  const [zOn, setZOn] = useState(false);
  const [altOn, setAltOn] = useState(false);
  const dragging = useRef(false);
  const zHeld = useRef(false);
  const lastPt = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ x: 24, y: 24 });
  const zoomRef = useRef(0.32);
  const hThumbRef = useRef<HTMLDivElement>(null);
  const vThumbRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const zFillRef = useRef<HTMLDivElement>(null);
  const zThumbRef = useRef<HTMLDivElement>(null);
  const [grabbing, setGrabbing] = useState(false);

  /*
    확인창에서 고른 사이즈 — 아래 편집줄이 이걸 대상으로 삼는다.
    끌어서 팬을 하면 mouseup 뒤에 click 이 따라오므로, 움직인 거리를 재서
    **끌었으면 고르지 않는다**. 안 그러면 화면을 옮길 때마다 선택이 바뀐다.
  */
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const moved = useRef(false);
  const pickSize = (k: string) => { if (!moved.current) setPickedKey((p) => (p === k ? null : k)); };

  const applyTransform = () => {
    const el = contentRef.current;
    if (el) el.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoomRef.current})`;
    syncBars();
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
  const onDown = (e: React.MouseEvent) => { dragging.current = true; moved.current = false; setGrabbing(true); setSmoothPan(true); lastPt.current = { x: e.clientX, y: e.clientY }; };
  const onMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    // 손떨림으로 선택이 막히지 않게 4px 여유를 둔다
    if (Math.abs(e.clientX - lastPt.current.x) > 4 || Math.abs(e.clientY - lastPt.current.y) > 4) moved.current = true;
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
  /*
    스크롤 바 — 줌으로 화면 밖으로 나간 만큼만 손잡이가 생긴다.

    팬은 리렌더 없이 DOM transform 만 갱신하므로(부드럽게), 손잡이도 같은 자리에서
    ref 로 직접 옮긴다. 상태로 두면 끌 때마다 리렌더가 걸려 배너 40장이 다시 그려진다.
  */
  const syncBars = () => {
    const cv = canvasRef.current, ct = contentRef.current;
    if (!cv || !ct) return;
    const z = zoomRef.current;
    const vw = cv.clientWidth, vh = cv.clientHeight;
    const cw = ct.offsetWidth * z, ch = ct.offsetHeight * z;
    const put = (el: HTMLDivElement | null, view: number, content: number, pan: number, horiz: boolean) => {
      if (!el) return;
      // 내용이 화면 안에 다 들어오면 손잡이를 감춘다
      if (content <= view + 1) { el.style.display = 'none'; return; }
      el.style.display = 'block';
      const track = view - SB_SIZE;                       // 양 끝 여백만큼 뺀 길이
      const len = Math.max(28, (view / content) * track);
      const max = content - view;                          // 움직일 수 있는 총량
      const t = Math.min(1, Math.max(0, -pan / max));
      const pos = SB_SIZE / 2 + t * (track - len);
      if (horiz) { el.style.width = `${len}px`; el.style.left = `${pos}px`; }
      else { el.style.height = `${len}px`; el.style.top = `${pos}px`; }
    };
    put(hThumbRef.current, vw, cw, panRef.current.x, true);
    put(vThumbRef.current, vh, ch, panRef.current.y, false);

    /*
      줌 슬라이더 손잡이도 같은 자리에서 옮긴다. 배율은 **로그로** 잡는다 —
      0.1→0.5 와 3.6→4 는 더한 값은 같아도 체감이 전혀 달라, 선형으로 깔면
      아래쪽 절반이 거의 안 움직이는 것처럼 느껴진다.
    */
    const t = Math.min(1, Math.max(0, Math.log(z / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN)));
    const y = BAR_PAD + (1 - t) * (BAR_H - BAR_PAD * 2);
    if (zFillRef.current) zFillRef.current.style.top = `${y}px`;
    if (zThumbRef.current) zThumbRef.current.style.top = `${y - 6.5}px`;
  };

  /** 슬라이더 위치 → 배율. 확대 기준점은 확인창 한가운데라 보던 자리가 안 밀린다. */
  const zoomFromBar = (clientY: number) => {
    const r = barRef.current?.getBoundingClientRect();
    const c = canvasRef.current?.getBoundingClientRect();
    if (!r || !c) return;
    const span = r.height - BAR_PAD * 2;
    const t = Math.min(1, Math.max(0, 1 - (clientY - (r.top + BAR_PAD)) / span));
    const nz = ZOOM_MIN * Math.pow(ZOOM_MAX / ZOOM_MIN, t);
    zoomAt(c.width / 2, c.height / 2, nz / zoomRef.current);
  };
  const startZoomBar = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    zoomFromBar(e.clientY);
    const move = (ev: MouseEvent) => zoomFromBar(ev.clientY);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  /** 손잡이를 끌면 그 비율만큼 내용을 옮긴다 */
  const startThumb = (e: React.MouseEvent, axis: 'x' | 'y') => {
    e.stopPropagation();
    e.preventDefault();
    const cv = canvasRef.current, ct = contentRef.current;
    if (!cv || !ct) return;
    const z = zoomRef.current;
    const view = axis === 'x' ? cv.clientWidth : cv.clientHeight;
    const content = (axis === 'x' ? ct.offsetWidth : ct.offsetHeight) * z;
    const max = content - view;
    if (max <= 0) return;
    const track = view - SB_SIZE;
    const len = Math.max(28, (view / content) * track);
    const start = axis === 'x' ? e.clientX : e.clientY;
    const from = axis === 'x' ? panRef.current.x : panRef.current.y;
    setSmoothPan(true);
    const move = (ev: MouseEvent) => {
      const d = (axis === 'x' ? ev.clientX : ev.clientY) - start;
      // 손잡이가 움직인 거리 → 내용이 움직여야 할 거리
      const delta = (d / Math.max(1, track - len)) * max;
      const v = Math.min(0, Math.max(-max, from - delta));
      if (axis === 'x') panRef.current.x = v; else panRef.current.y = v;
      applyTransform();
    };
    const up = () => {
      setSmoothPan(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const cursor = zOn ? (altOn ? 'zoom-out' : 'zoom-in') : grabbing ? 'grabbing' : 'grab';

  const promo = state.promotionId ? getPromotion(state.promotionId) : undefined;
  const derived = promo
    ? (() => { const q = promoPair(promo, state.colorSet); return { main: q.main.hex, secondary: q.secondary.hex }; })()
    : NEUTRAL_BANNER_COLORS;
  const texture = resolveBackground(state.designType, state.backgroundTypeId).texture;

  return (
    <div>
      <Head title="AD Media" desc="Select media — the 1200×628 design applies to all its sizes." />

      <p className="font-lgei font-bold text-[15px] text-gray-900 mb-2">Media Select</p>
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

      {/* 로고 갈아끼우기 — 확인창에서 고른 사이즈 하나만 대상으로 한다 */}
      {ENABLE_LOGO_CHANGE && channels.length > 0 && (
        <div className="mt-7">
          <div className="flex items-baseline gap-4 mb-2 flex-wrap">
            <p className="font-lgei font-bold text-[15px] text-gray-900">Logo Change</p>
            <p className="text-xs text-gray-500">Check the logo against each background below, then pick the version that stays legible.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-center gap-4 min-h-[56px]">
            {!pickedKey ? (
              <p className="text-xs text-gray-400">Click a size in the preview below to change its logo.</p>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 leading-none mb-1">Selected size</p>
                  <p className="text-[13px] font-medium text-gray-900 leading-none">{pickedKey}</p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Logo</span>
                  {LOGO_VARIANTS.map((v) => {
                    const on = (state.logoBySize[pickedKey] ?? '') === v.id;
                    return (
                      <button
                        key={v.id} type="button"
                        onClick={() => update({ logoBySize: { ...state.logoBySize, [pickedKey]: v.id } })}
                        title={v.label}
                        className={`h-9 px-2.5 rounded-lg border flex items-center gap-2 transition-colors ${
                          on ? 'border-[#FD312E] bg-[#FD312E]/5' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {/* 흰 로고는 흰 바탕에서 안 보이므로 어두운 칸에 얹어 보여준다 */}
                        <span className="flex items-center justify-center rounded"
                          style={{ width: 40, height: 18, background: v.id === 'white' ? '#4a4946' : '#f3f1ee' }}>
                          <img src={v.src} alt="" style={{ height: 12 }} draggable={false} />
                        </span>
                        <span className={`text-[12px] ${on ? 'text-[#FD312E] font-medium' : 'text-gray-600'}`}>{v.label}</span>
                      </button>
                    );
                  })}
                  {state.logoBySize[pickedKey] && (
                    <button
                      type="button"
                      onClick={() => { const n = { ...state.logoBySize }; delete n[pickedKey]; update({ logoBySize: n }); }}
                      className="text-[11px] text-[#FD312E] underline ml-1"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <span className="ml-auto text-[11px] text-gray-400">
                  {Object.keys(state.logoBySize).length} size(s) changed
                </span>
              </>
            )}
          </div>
        </div>
      )}

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
            <div ref={contentRef} style={{ position: 'absolute', top: 0, left: 0, width: 'max-content', transformOrigin: 'top left' }}>
              {/* 매체가 늘어나면 오른쪽으로 붙는다 — 세로로 쌓으면 아래로만 길어져 비교가 안 된다 */}
              <div className="flex items-start" style={{ gap: NS(56) }}>
                {channels.map((c) => (
                  /*
                    칸 폭은 **내용에 맞춘다.** CANVAS_MAX_W 로 고정하면 사이즈가 적은 매체
                    (META 는 3개)의 칸이 텅 비어 다음 매체가 멀리 밀린다.
                    max-width 는 그대로라 사이즈가 많은 매체는 예전처럼 그 폭에서 접힌다.
                  */
                  <div key={c.id} className="shrink-0" style={{ width: 'max-content', maxWidth: CANVAS_MAX_W }}>
                    {(() => {
                      // Figma 에서 완성된(스펙이 있는) 사이즈만 보여준다.
                      // 숨김 처리된 프레임은 스펙이 없으므로 자연히 제외된다.
                      const ready = MEDIA_SIZES[c.id].filter((s) => !!getSpec(state.designType, c.id, s.name));
                      /*
                        META 만 칸으로 묶는다 — 1080x1920 옆이 통째로 비어서
                        작은 398x208 을 그 빈자리에 올린다. 사이즈가 많은 매체는
                        묶으면 순서가 뒤섞여 찾기 어려워지므로 그대로 둔다.
                      */
                      const columns = c.id === 'meta' ? packSizes(ready) : null;
                      const rows = columns ? null : [ready.filter(isWide), ready.filter((s) => !isWide(s))].filter((r) => r.length > 0);
                      return (
                        <>
                          <p className="font-lgei font-bold text-[#4A4946]" style={{ fontSize: NS(13), marginBottom: NS(6) }}>
                            {c.label} · {ready.length} sizes
                          </p>
                          {ready.length === 0 ? (
                            <p className="text-[#6b6862]" style={{ fontSize: NS(12) }}>No sizes ready for this channel yet.</p>
                          ) : (
                            <div className={columns ? 'flex flex-wrap items-stretch' : ''} style={{ gap: NS(20), maxWidth: CANVAS_MAX_W }}>
                              {(columns ?? rows!).map((col, ci) => (
                            <div key={ci} className={columns ? 'flex flex-col justify-between' : 'flex flex-wrap items-end'}
                              style={{ gap: NS(20), maxWidth: CANVAS_MAX_W, marginBottom: columns ? undefined : NS(24) }}>
                              {col.map((s) => (
                                <div
                                  key={`${c.id}-${s.name}`}
                                  className="shrink-0 cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); pickSize(specKey(c.id, s.name)); }}
                                  style={{
                                    outline: pickedKey === specKey(c.id, s.name) ? `${NS(3)}px solid #FD312E` : undefined,
                                    outlineOffset: NS(3),
                                  }}
                                >
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
            {/* 스크롤 바 — 줌으로 화면 밖으로 나간 만큼만 나타난다 */}
            <div className="absolute left-0 right-0 bottom-0" style={{ height: SB_SIZE, pointerEvents: 'none' }}>
              <div ref={hThumbRef} onMouseDown={(e) => startThumb(e, 'x')}
                className="absolute rounded-full bg-black/25 hover:bg-black/40 transition-colors"
                style={{ top: 3, height: SB_SIZE - 6, pointerEvents: 'auto', cursor: 'grab' }} />
            </div>
            <div className="absolute top-0 bottom-0 right-0" style={{ width: SB_SIZE, pointerEvents: 'none' }}>
              <div ref={vThumbRef} onMouseDown={(e) => startThumb(e, 'y')}
                className="absolute rounded-full bg-black/25 hover:bg-black/40 transition-colors"
                style={{ left: 3, width: SB_SIZE - 6, pointerEvents: 'auto', cursor: 'grab' }} />
            </div>

            {/* 세로 줌 슬라이더 — 잡고 올리면 줌인, 내리면 줌아웃 (스크롤바 안쪽) */}
            <div
              ref={barRef}
              onMouseDown={startZoomBar}
              onClick={(e) => e.stopPropagation()}
              className="absolute w-7 rounded-full bg-white/90 shadow-md border border-gray-200 cursor-ns-resize"
              style={{ height: BAR_H, top: 16, right: SB_SIZE + 8 }}
              title="Drag up to zoom in, down to zoom out"
            >
              <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-gray-200" style={{ top: BAR_PAD, bottom: BAR_PAD, width: 3 }} />
              <div ref={zFillRef} className="absolute left-1/2 -translate-x-1/2 rounded-full bg-[#FD312E]"
                style={{ bottom: BAR_PAD, width: 3 }} />
              <div ref={zThumbRef} className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white border-2 border-[#FD312E] shadow"
                style={{ width: 13, height: 13 }} />
            </div>

          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#6b6862] text-sm">Select media above to preview all sizes.</div>
        )}
      </div>
      {channels.length > 0 && (
        <p className="mt-2 text-[11px] text-gray-400">
          Drag to pan · Z zoom in · Alt+Z zoom out · scroll to zoom · drag the right slider to zoom
        </p>
      )}

      {/*
        간편 편집줄 — 확인창에서 고른 사이즈 하나만 손본다.

        같은 디자인을 41개로 펼치면 로고 자리에 오는 배경 밝기가 사이즈마다 달라져
        로고가 묻히는 사이즈가 생긴다. 어디가 묻히는지는 규칙으로 정하기 어렵고
        보면 바로 아는 문제라, 눈으로 고르고 그 사이즈만 갈아 끼우게 한다.
      */}
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
      {/*
        색 입히는 방식 — 시안별로 확정됐으므로 기본은 숨긴다(ENABLE_COLORING_OPTION).
        A = Overlay · B = Gradient map. 되살리려면 플래그만 true 로.
      */}
      {ENABLE_COLORING_OPTION && (
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
      )}
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
  const styleId = state.boxStyleId ?? DEFAULT_BOX_STYLE[state.designType];
  /*
    슬라이더는 **재질이 원래 갖고 있던 알파**에서 시작한다 (glass 0.15 · white 1).
    재질을 바꾸면 null 로 되돌려, 그 재질 기본값부터 다시 잡게 한다 —
    글래스에서 0.6 으로 올려둔 값이 화이트로 넘어가면 흰 박스가 반투명해진다.
  */
  const base = alphaOf(BOX_MATERIALS[styleId]?.fill ?? '#ffffff');
  const value = state.boxOpacity ?? base;
  return (
    <EditSection label="Box">
      {/* Sticker 스타일 버튼과 동일한 규격(flex-1 · h-9 · rounded-lg)으로 폭을 채운다 */}
      <div className="flex items-center gap-1.5">
        {BOX_STYLES_BY_DESIGN[state.designType].map((b) => (
          <button key={b.id} type="button" onClick={() => update({ boxStyleId: b.id, boxOpacity: null })}
            className={`flex-1 h-9 rounded-lg border text-xs transition-colors ${styleId === b.id ? 'border-[#FD312E] text-[#FD312E] bg-[#FD312E]/5' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            {b.label}
          </button>
        ))}
      </div>

      <div className="mt-2.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-500">Opacity</span>
          <span className="text-[11px] text-gray-400 tabular-nums ml-auto">{Math.round(value * 100)}%</span>
          {state.boxOpacity !== null && (
            <button type="button" onClick={() => update({ boxOpacity: null })}
              className="text-[11px] text-[#FD312E] underline">Reset</button>
          )}
        </div>
        <input
          type="range" min={0} max={100} step={1}
          value={Math.round(value * 100)}
          onChange={(e) => update({ boxOpacity: Number(e.target.value) / 100 })}
          className="w-full accent-[#FD312E]"
        />
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
function ReviewStep({ state, update, zip }: StepProps & { zip: ReturnType<typeof useBannerZip> }) {
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

      {/*
        의견 — 배너에는 안 들어간다. 다운로드할 때 사용 기록에 함께 실려
        통계 화면(#stats)에서 보인다. 안 써도 다운로드에는 영향이 없다.
      */}
      <div className="mt-6 max-w-md">
        <label className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-gray-600">Comment</span>
          <span className="text-[11px] text-gray-400">optional</span>
          <span className="text-[10px] text-gray-400 ml-auto tabular-nums">{state.comment.length}/{MAX_COMMENT}</span>
        </label>
        <textarea
          value={state.comment} rows={3} maxLength={MAX_COMMENT}
          onChange={(e) => update({ comment: e.target.value })}
          placeholder="Anything we should know? Requests, issues, missing sizes…"
          className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-[#FD312E] resize-none"
        />
        <p className="text-[11px] text-gray-400 mt-1">Sent with the download so we can see what teams need.</p>
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
