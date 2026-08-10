/**
 * 매체 사이즈별 레이아웃 스펙 — Figma "Sales-Template-Work-T-" 파일의
 * Banner Template 페이지(canvas 4001:64316) > Sales Template > Dark mode > Criteo 에서 실측.
 *
 * 좌표/치수는 전부 **해당 프레임의 네이티브 px**다. 렌더러가 프레임 전체를
 * transform: scale()로 축소하므로 여기 값은 Figma 숫자를 그대로 적으면 된다.
 *
 * 현재 반영된 사이즈 (Figma에서 완성된 Criteo 8종):
 *   1200x628(메인) · 1200x1200 · 800x1200 · 768x1024 · 320x480 · 300x600 · 160x600 · 120x600
 * 나머지 사이즈와 DV360/Pmax/META는 Figma 작업이 끝나는 대로 추가한다.
 *
 * 사이즈마다 다른 것: 그리드 배열(3×2 / 2×3 / 1×6) · 카피 정렬 · 서브카피 유무 ·
 * 글래스 박스 치수 · 배경 이미지 배치 · 장식 그래픽 개수와 z-order.
 */

// ── Glass ─────────────────────────────────────────────────────────────────────

/**
 * Figma "Glass" 이펙트 파라미터 (Effects 패널 값 그대로).
 *
 * ⚠ CSS로 전부는 재현 불가:
 *   Frost      → backdrop-filter: blur()        ✅ (단, px가 아니라 재질 파라미터 — FROST_TO_PX로 환산)
 *   Light      → inset box-shadow 1px 림        ✅ 근사
 *   Refraction → 가장자리 렌즈 굴절              ❌ SVG feDisplacementMap 필요
 *   Dispersion → 가장자리 색수차                 ❌ 채널별 오프셋 필요
 *   Splay      → 굴절 퍼짐                       ❌
 */
export interface GlassEffect {
  lightAngle: number;
  lightIntensity: number;
  refraction: number;
  depth: number;
  dispersion: number;
  frost: number;
  splay: number;
}

export const GLASS_DEFAULT: GlassEffect = {
  lightAngle: -45,
  lightIntensity: 0.8,
  refraction: 9,
  depth: 29.88,
  dispersion: 19,
  frost: 18.87,
  splay: 0,
};

/** 글래스 박스 fill/stroke 색 — 전 사이즈 공통 */
export const GLASS_FILL = 'rgba(255,255,255,0.15)';
export const GLASS_STROKE = 'rgba(255,255,255,0.15)';

/**
 * Frost(재질 파라미터) → CSS blur 반경(px) 환산 계수.
 * Figma 렌더에서 박스 안/밖 고주파 성분을 비교해 역산: 실효 blur ≈ 10.7px = 18.87 × 0.567.
 */
const FROST_TO_PX = 0.567;

/**
 * Glass 파라미터 → CSS. Light 림은 Figma 렌더의 테두리 픽셀 측정 결과 **1px 얇은 선**이다
 * (바깥 luma 150 → 테두리 233 → 안쪽 168. 안쪽 상승분은 15% fill로 설명되고 넓은 glow는 없음).
 */
export function glassToCss(g: GlassEffect) {
  const rad = (g.lightAngle * Math.PI) / 180;
  const dx = -Math.sin(rad); // -45° → 좌상단
  const dy = Math.cos(rad);
  const blur = g.frost * FROST_TO_PX;
  return {
    backdropFilter: `blur(${blur.toFixed(2)}px)`,
    WebkitBackdropFilter: `blur(${blur.toFixed(2)}px)`,
    innerLight: `inset ${dx.toFixed(2)}px ${dy.toFixed(2)}px 0px rgba(255,255,255,${(g.lightIntensity * 0.375).toFixed(3)})`,
  };
}

// ── 공통 상수 ─────────────────────────────────────────────────────────────────

/** 셰이드 농도 배율. 1 = Figma 원본. */
export const SHADE_BOOST = 1.15;

/**
 * 셰이드 그라데이션 (Figma "Gradient" 레이어 — 검정 100% → 0%).
 *
 * 각도와 스톱이 **사이즈마다 다르다**. Figma 코드젠은 rotate180 래퍼 안의 각도를 주므로
 * 실제 CSS 각도는 `codegen − 180`이다. 예: 238.493deg → 58.493deg.
 *
 * ⚠ 코드젠의 스톱 부호는 믿을 수 없다. 검정 핸들이 프레임 **바깥**에 있을 때 크기만 주고
 * 부호를 빼먹는다. 1200×628 렌더를 픽셀 측정해 확인한 값이 기준이다.
 */
export interface ShadeSpec {
  /** CSS linear-gradient 각도(도) */
  angle: number;
  /** 검정(알파 1) 스톱 위치(%) — 음수면 프레임 바깥 */
  blackStop: number;
  /** 투명(알파 0) 스톱 위치(%) */
  clearStop: number;
}

/** 세로형 공통 — 하단이 어두움 */
export const SHADE_BOTTOM: ShadeSpec = { angle: 0.79, blackStop: -14.089, clearStop: 94.096 };

/**
 * 농도 배율을 적용해 CSS로. 검정 스톱을 당겨 램프 전체 알파를 균일하게 boost배 한다
 * (스톱 간격을 1/boost로 좁히는 것 — 기울기만 가팔라지고 모양은 유지).
 */
export function shadeGradient(sh: ShadeSpec) {
  const black = sh.clearStop - (sh.clearStop - sh.blackStop) / SHADE_BOOST;
  return `linear-gradient(${sh.angle}deg, rgba(0,0,0,1) ${black.toFixed(3)}%, rgba(0,0,0,0) ${sh.clearStop}%)`;
}

/**
 * 장식 도형(Graphics) 레이어 불투명도.
 *
 * 도형은 순백 이미지라 mix-blend-overlay를 100%로 얹으면 어두운 배경에서 정확히 **2.0배**로
 * 튄다(overlay 공식: backdrop<0.5이면 result = 2×backdrop). 그러면 반투명 스티커 뒤에서도
 * 광선이 그대로 비쳐 보인다.
 *
 * Figma 렌더를 픽셀 측정하니 광선이 인접 배경 대비 **1.56배**까지만 밝아졌다
 * (광선 luma 69 / 배경 40, 상위 40개 평균 +20.7 luma). result = b(1 + opacity) 이므로
 * opacity ≈ 0.56.
 */
export const GRAPHIC_OPACITY = 0.56;

/**
 * 벌(line/full)별 도형 불투명도.
 *
 * 0.56 은 **line 기준**으로 잰 값이다. line 은 화면의 1~2%만 칠해져 있어서 그 밝기가
 * 가는 광선 몇 줄로만 보이지만, full 은 11~26% 라 같은 값이면 배경 전체가 뜬다.
 * full 은 0.11 로 낮춘다 — 밝아지는 정도가 1.56배에서 1.11배가 된다.
 *
 * 조절은 이 표만 고치면 된다. (line 값은 Figma 실측이므로 건드리지 말 것)
 */
export const GRAPHIC_OPACITY_BY_KIND: Record<'line' | 'full', number> = {
  line: GRAPHIC_OPACITY,
  full: 0.11,
};

/** 스티커 원형 색 (Figma Ellipse 4 — #EF6464 50%) */
export const STICKER_FILL = 'rgba(239,100,100,0.5)';

/**
 * 레드 스티커의 기준 색. Edit 의 Hue 슬라이더가 이 색을 회전시킨다.
 * (원형 스티커는 반투명 STICKER_FILL, 별은 불투명 — 둘 다 이 Hue 를 따른다)
 */
export const STICKER_RED = '#FF0500';

/** 스티커 배경 스타일 — 레드 원 / 별 / 글래스(제품 박스와 같은 재질) */
export type StickerStyle = 'red' | 'star' | 'glass';
export const STICKER_STYLES: { id: StickerStyle; label: string }[] = [
  { id: 'red', label: 'Red circle' },
  { id: 'star', label: 'Star' },
  { id: 'glass', label: 'Glass' },
];

export const STICKER_FONT = '"Cal Sans", sans-serif';
export const HEADLINE_FONT = '"LGEI Headline", "Apple SD Gothic Neo", sans-serif';
export const BODY_FONT = '"LGEI Text", "Apple SD Gothic Neo", sans-serif';
export const HEADLINE_WEIGHT = 600;

/**
 * 스티커 내부 조판 — Figma 렌더를 픽셀 측정한 값(222px 원 기준 잉크 bbox).
 * 8개 사이즈 전부 원 지름만 다르고 **내부 상대 배치는 소수점까지 동일**해서 공용 상수로 둔다.
 * (검증: 1200x1200의 419.69px 원, 120x600의 74.22px 원 모두 222 환산 시 26.854 / 42.968로 일치)
 *
 * SVG <text>의 y는 곧 베이스라인이라 폰트 메트릭에 영향받지 않는다.
 * "off"의 베이스라인이 "20"과 같은 154인 게 핵심 — Figma의 lineHeight 2줄 구조를
 * CSS로 그대로 옮기면 글자가 겹쳐 어긋난다.
 */
/**
 * ⚠ 아래 값은 Figma 에서 txt 그룹을 95% 로 줄이기 **전에** 측정한 것이다.
 * 축소는 중심 (110.68, 102.48) 기준이었으므로 같은 변환을 여기서도 적용한다:
 *   v' = center + (v - center) × 0.95,   fontSize' = fontSize × 0.95
 * (검증: Figma 252px 스티커의 "20" 이 116.05 → 222 환산 102.24 = 107.618 × 0.95)
 */
const TXT_SCALE = 0.95;
const TXT_CX = 110.68, TXT_CY = 102.48;
const sx = (v: number) => TXT_CX + (v - TXT_CX) * TXT_SCALE;
const sy = (v: number) => TXT_CY + (v - TXT_CY) * TXT_SCALE;

export const STICKER_LAYOUT = {
  circle: 222,
  label:   { cx: sx(111.0), baseline: sy(65),  size: 26.377 * TXT_SCALE },
  number:  { cx: sx(87.5),  baseline: sy(154), size: 107.618 * TXT_SCALE, tracking: -2.1524 * TXT_SCALE },
  percent: { cx: sx(172.0), baseline: sy(125), size: 65.942 * TXT_SCALE },
  off:     { cx: sx(172.5), baseline: sy(154), size: 34.29 * TXT_SCALE },
} as const;

/**
 * 스티커 txt 축소의 기준 중심(222 viewBox 좌표).
 * 추가 축소를 걸 때도 반드시 이 점을 기준으로 해야 Figma 와 같은 결과가 나온다.
 */
export const STICKER_TXT_CENTER = { cx: TXT_CX, cy: TXT_CY } as const;

// ── 타입 ──────────────────────────────────────────────────────────────────────

export interface BoxGridSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  gapX: number;
  gapY: number;
}

/** 글래스 박스 치수 — 사이즈별로 다르다(프레임마다 컴포넌트 스케일이 달라 유도 불가, 실측값 그대로) */
export interface BoxMetrics {
  borderWidth: number;
  radius: number;
  /** 드롭섀도 offsetY = blur = 이 값 */
  shadow: number;
}

export interface CopySpec {
  /** 블록 기준 x */
  x: number;
  /** x가 좌측 가장자리인지 중심인지 */
  anchor: 'left' | 'center';
  /** 블록 폭. null = 내용에 맞춤(nowrap) */
  width: number | null;
  /** 좌우 패딩 */
  padX: number;
  top: number;
  /** 카피 ↔ CTA 간격 */
  gap: number;
  /** 헤드라인 ↔ 서브카피 간격 */
  innerGap: number;
  /** 텍스트 정렬 */
  align: 'left' | 'center';
  headlineSize: number;
  headlineTracking: number;
  headlineMaxH: number;
  /** null = 이 사이즈엔 서브카피가 없다 */
  sub: { size: number; maxH: number; tracking: number } | null;
  opacity: number;
}

export interface CtaSpec {
  h: number;
  padX: number;
  /** @deprecated 코드젠이 주는 축소 전 컴포넌트 값. 실제 렌더는 ctaRadius()를 쓴다. */
  radius: number;
  fontSize: number;
}

/**
 * CTA 라운드 반경 = 버튼 높이 × 이 비율.
 *
 * MCP 코드젠은 전 사이즈에 `rounded-[16px]`를 주는데 그건 **축소 전 컴포넌트 원본 값**이다.
 * 실제 렌더를 측정하니 반경이 높이에 비례했다:
 *   160x600 h36→R6.8 · 1200x628 h54→R11.5 · 768x1024 h80→R14.7 · 800x1200 h84→R15.3
 *   (R/h = 0.189 / 0.213 / 0.184 / 0.185)
 * 기준 800x1200(h 84.184)에서 16 → 16/84.184 = 0.19006.
 */
export const CTA_RADIUS_RATIO = 16 / 84.184;

export function ctaRadius(cta: CtaSpec) {
  return cta.h * CTA_RADIUS_RATIO;
}

export interface StickerSpec {
  x: number;
  y: number;
  size: number;
}

export interface GraphicSpec {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 배경 이미지 배치 (Figma "Sales Template BG" 인스턴스) */
export interface BgSpec {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SizeLayout {
  id: string;
  channel: string;
  /** mediaSizes.MediaSize.name과 매칭 */
  size: string;
  w: number;
  h: number;
  /** 셰이드 그라데이션 (각도 + 스톱). 사이즈마다 다르다. */
  shade: ShadeSpec;
  bg: BgSpec;
  logo: { x: number; y: number; w: number; h: number };
  grid: BoxGridSpec;
  box: BoxMetrics;
  copy: CopySpec;
  cta: CtaSpec;
  sticker: StickerSpec;
  disclaimer: { padX: number; padBottom: number; fontSize: number };
  graphics: GraphicSpec[];
  /** true면 장식 그래픽이 카피/그리드 **위**에 온다 (160x600·120x600이 그렇다) */
  graphicsOnTop?: boolean;
  glass?: Partial<GlassEffect>;
}

export function getGlass(layout: SizeLayout): GlassEffect {
  return { ...GLASS_DEFAULT, ...layout.glass };
}

// ── 사이즈별 스펙 ─────────────────────────────────────────────────────────────

/** 장식 그래픽 기본 크기들 (프레임군별로 다름) */
const G577 = { w: 577, h: 572 };
const G325 = { w: 325.753, h: 322.67 };
const G230 = { w: 230.855, h: 228.67 };
const G179 = { w: 179.368, h: 177.671 };
const G250 = { w: 250.655, h: 248.283 };
const G236 = { w: 236.504, h: 234.266 };
const G79 = { w: 79, h: 78.253 };

export const SIZE_LAYOUTS: SizeLayout[] = [
  // ── 메인 사이즈 — 좌측 카피 + 우측 그리드 (유일한 가로형 구성) ──
  {
    id: 'criteo-1200x628',
    channel: 'criteo',
    size: '1200x628',
    w: 1200,
    h: 628,
    shade: { angle: 58.493, blackStop: -7.702, clearStop: 78.771 },
    bg: { x: 0, y: -412, w: 1200, h: 1200 },
    logo: { x: 40, y: 30, w: 95, h: 42 },
    grid: { x: 560, y: 93, w: 588.423, h: 442.934, cols: 3, rows: 2, gapX: 9.601, gapY: 10.401 },
    box: { borderWidth: 1.271, radius: 12.801, shadow: 5.084 },
    copy: {
      x: 40, anchor: 'left', width: 486, padX: 0, top: 109,
      gap: 20, innerGap: 14, align: 'left',
      headlineSize: 52, headlineTracking: 0, headlineMaxH: 165,
      sub: { size: 29, maxH: 68, tracking: -0.58 },
      opacity: 1,
    },
    cta: { h: 54.061, padX: 24.951, radius: 16, fontSize: 20.79 },
    sticker: { x: 263, y: 335, size: 249.69 },
    disclaimer: { padX: 40, padBottom: 20, fontSize: 20 },
    graphics: [
      { x: -112, y: 213, ...G577 },
      { x: 711, y: -193, ...G577 },
    ],
  },

  // ── 1024x768 — 좌측 카피(3줄) + 우측 2×3 그리드 ──
  {
    id: 'criteo-1024x768',
    channel: 'criteo',
    size: '1024x768',
    w: 1024,
    h: 768,
    shade: { angle: 55.513, blackStop: -10.73, clearStop: 65.262 },
    bg: { x: 0, y: -149, w: 1024, h: 1024 },
    logo: { x: 40, y: 40, w: 90, h: 40 },
    grid: { x: 550, y: 65, w: 420, h: 637.613, cols: 2, rows: 3, gapX: 13.553, gapY: 13.553 },
    box: { borderWidth: 1.355, radius: 13.553, shadow: 5.421 },
    copy: {
      x: 40, anchor: 'left', width: null, padX: 0, top: 115,
      gap: 34, innerGap: 10, align: 'left',
      headlineSize: 56, headlineTracking: 0.56, headlineMaxH: 400,
      sub: null,
      opacity: 1,
    },
    cta: { h: 81.116, padX: 37.438, radius: 16, fontSize: 31.2 },
    sticker: { x: 263, y: 452, size: 249.69 },
    disclaimer: { padX: 40, padBottom: 30, fontSize: 22 },
    graphics: [
      { x: -160, y: 303, ...G577 },
      { x: 652, y: -165, ...G577 },
    ],
  },

  {
    id: 'criteo-1200x1200',
    channel: 'criteo',
    size: '1200x1200',
    w: 1200,
    h: 1200,
    shade: SHADE_BOTTOM,
    bg: { x: 0, y: 0, w: 1200, h: 1201 },
    logo: { x: 33, y: 33, w: 113.501, h: 50 },
    grid: { x: 33, y: 148, w: 1134, h: 546.674, cols: 3, rows: 2, gapX: 13.869, gapY: 15.025 },
    box: { borderWidth: 1.836, radius: 18.492, shadow: 7.344 },
    copy: {
      x: 330.5, anchor: 'center', width: null, padX: 0, top: 755,
      gap: 36, innerGap: 12, align: 'left',
      headlineSize: 68, headlineTracking: 0, headlineMaxH: 144,
      sub: { size: 38, maxH: 88, tracking: 0 },
      opacity: 1,
    },
    cta: { h: 78, padX: 36, radius: 16, fontSize: 30 },
    sticker: { x: 747.087, y: 738.087, size: 419.69 },
    disclaimer: { padX: 30, padBottom: 42, fontSize: 20 },
    graphics: [
      { x: -15, y: -140, ...G577 },
      { x: 716, y: 332, ...G577 },
      { x: 80, y: 786, ...G577 },
    ],
  },

  {
    id: 'criteo-800x1200',
    channel: 'criteo',
    size: '800x1200',
    w: 800,
    h: 1200,
    shade: SHADE_BOTTOM,
    bg: { x: -260, y: -10, w: 1252, h: 1252 },
    logo: { x: 28, y: 34, w: 102.151, h: 45 },
    grid: { x: 36, y: 125, w: 728, h: 548, cols: 3, rows: 2, gapX: 11.878, gapY: 12.868 },
    box: { borderWidth: 1.573, radius: 15.837, shadow: 6.29 },
    copy: {
      x: 0, anchor: 'left', width: 800, padX: 34, top: 733,
      gap: 70, innerGap: 12, align: 'left',
      headlineSize: 65, headlineTracking: -1.3, headlineMaxH: 140,
      sub: { size: 38, maxH: 88, tracking: 0 },
      opacity: 1,
    },
    cta: { h: 84.184, padX: 38.854, radius: 16, fontSize: 32.38 },
    sticker: { x: 540, y: 938, size: 222 },
    disclaimer: { padX: 30, padBottom: 26, fontSize: 20 },
    graphics: [
      { x: -187, y: 8, ...G577 },
      { x: 400, y: 516, ...G577 },
    ],
  },

  {
    id: 'criteo-768x1024',
    channel: 'criteo',
    size: '768x1024',
    w: 768,
    h: 1024,
    shade: SHADE_BOTTOM,
    bg: { x: -138, y: -4, w: 1076, h: 1076 },
    logo: { x: 28, y: 34, w: 102.151, h: 45 },
    grid: { x: 33, y: 109, w: 702, h: 425, cols: 3, rows: 2, gapX: 11.878, gapY: 12.868 },
    box: { borderWidth: 1.573, radius: 15.837, shadow: 6.29 },
    copy: {
      x: 0, anchor: 'left', width: 768, padX: 32, top: 575,
      gap: 70, innerGap: 12, align: 'left',
      headlineSize: 60, headlineTracking: -1.2, headlineMaxH: 134.4,
      sub: { size: 32, maxH: 86, tracking: 0 },
      opacity: 0.85,
    },
    cta: { h: 80.562, padX: 37.182, radius: 16, fontSize: 30.99 },
    sticker: { x: 504, y: 760, size: 222 },
    disclaimer: { padX: 30, padBottom: 26, fontSize: 20 },
    graphics: [
      { x: -256, y: -60, ...G577 },
      { x: 421, y: 355, ...G577 },
    ],
  },

  // ── 970x250 — 좌측 카피 + 우측 3×2 그리드 ──
  {
    id: 'criteo-970x250',
    channel: 'criteo',
    size: '970x250',
    w: 970,
    h: 250,
    shade: { angle: 74.486, blackStop: -7.825, clearStop: 71.032 },
    bg: { x: 0, y: -594, w: 971, h: 971 },
    logo: { x: 30, y: 13, w: 61, h: 27 },
    grid: { x: 518, y: 23, w: 421.613, h: 203.25, cols: 3, rows: 2, gapX: 5.156, gapY: 5.586 },
    box: { borderWidth: 0.683, radius: 6.875, shadow: 2.731 },
    copy: {
      x: 30, anchor: 'left', width: null, padX: 0, top: 51,
      gap: 20, innerGap: 8, align: 'left',
      headlineSize: 36, headlineTracking: 0, headlineMaxH: 100,
      sub: null,
      opacity: 1,
    },
    cta: { h: 38.148, padX: 19.074, radius: 16, fontSize: 15.89 },
    sticker: { x: 377.952, y: 104.952, size: 126.739 },
    disclaimer: { padX: 30, padBottom: 10, fontSize: 14 },
    graphics: [
      { x: 20, y: 75.73, ...G236 },
      { x: 393.46, y: -120, ...G236 },
      { x: 822, y: 34, ...G236 },
    ],
  },

  // ── 480x320 — 좌측 카피(3줄) + 우측 2×3 그리드 ──
  {
    id: 'criteo-480x320',
    channel: 'criteo',
    size: '480x320',
    w: 480,
    h: 320,
    shade: { angle: 60.732, blackStop: -8.447, clearStop: 78.08 },
    bg: { x: 0, y: -128.066, w: 479, h: 479 },
    logo: { x: 18, y: 20, w: 55, h: 24 },
    grid: { x: 279, y: 31, w: 170, h: 258.082, cols: 2, rows: 3, gapX: 5.486, gapY: 5.486 },
    box: { borderWidth: 0.549, radius: 5.486, shadow: 2.194 },
    copy: {
      x: 18, anchor: 'left', width: null, padX: 0, top: 58,
      gap: 14, innerGap: 4, align: 'left',
      headlineSize: 26, headlineTracking: 0.26, headlineMaxH: 160,
      sub: null,
      opacity: 1,
    },
    cta: { h: 38.235, padX: 17.647, radius: 16, fontSize: 14.71 },
    sticker: { x: 130, y: 189, size: 109.909 },
    disclaimer: { padX: 18, padBottom: 14.063, fontSize: 12 },
    graphics: [
      { x: -74.15, y: 125.52, ...G250 },
      { x: 228.35, y: -67.8, ...G250 },
    ],
  },

  // ── 320x100 — 좌측 카피 + 우측 3×2 그리드 (최소형) ──
  {
    id: 'criteo-320x100',
    channel: 'criteo',
    size: '320x100',
    w: 320,
    h: 100,
    shade: { angle: 77.105, blackStop: -7.825, clearStop: 71.032 },
    bg: { x: 1, y: -91, w: 319, h: 319 },
    logo: { x: 8, y: 5, w: 20.43, h: 9 },
    grid: { x: 157, y: 13, w: 154.981, h: 74.713, cols: 3, rows: 2, gapX: 1.895, gapY: 2.053 },
    box: { borderWidth: 0.251, radius: 2.527, shadow: 1.004 },
    copy: {
      x: 8, anchor: 'left', width: 140, padX: 0, top: 18,
      gap: 6, innerGap: 0, align: 'left',
      headlineSize: 14, headlineTracking: 0, headlineMaxH: 45,
      sub: null,
      opacity: 1,
    },
    cta: { h: 20.082, padX: 9.268, radius: 16, fontSize: 7.72 },
    sticker: { x: 110, y: 51, size: 37.69 },
    disclaimer: { padX: 8, padBottom: 4, fontSize: 6 },
    graphics: [
      { x: 11.13, y: 47.91, ...G79 },
      { x: 125, y: -22.74, ...G79 },
      { x: 234, y: 46, ...G79 },
    ],
  },

  // ── 서브카피 없는 소형 사이즈들 ──
  {
    id: 'criteo-320x480',
    channel: 'criteo',
    size: '320x480',
    w: 320,
    h: 480,
    shade: SHADE_BOTTOM,
    bg: { x: -174.783, y: 0, w: 669.564, h: 669.564 },
    logo: { x: 16, y: 12, w: 52.194, h: 22.993 },
    grid: { x: 16, y: 60, w: 288, h: 216.791, cols: 3, rows: 2, gapX: 4.699, gapY: 5.091 },
    box: { borderWidth: 0.622, radius: 6.265, shadow: 2.488 },
    copy: {
      x: 0, anchor: 'left', width: 320, padX: 16, top: 303,
      gap: 25, innerGap: 4, align: 'left',
      headlineSize: 26, headlineTracking: 0, headlineMaxH: 88,
      sub: null,
      opacity: 1,
    },
    cta: { h: 38.235, padX: 17.647, radius: 16, fontSize: 14.71 },
    sticker: { x: 209, y: 367, size: 95.47 },
    disclaimer: { padX: 12, padBottom: 12, fontSize: 10 },
    graphics: [
      { x: 168, y: 227, ...G230 },
      { x: -71, y: -54, ...G230 },
    ],
  },

  {
    id: 'criteo-300x600',
    channel: 'criteo',
    size: '300x600',
    w: 300,
    h: 600,
    shade: SHADE_BOTTOM,
    bg: { x: -209, y: -10, w: 718, h: 718 },
    logo: { x: 10, y: 17, w: 56.811, h: 25.026 },
    grid: { x: 10, y: 63, w: 280, h: 308.376, cols: 2, rows: 3, gapX: 5.168, gapY: 5.599 },
    box: { borderWidth: 0.684, radius: 6.891, shadow: 2.737 },
    copy: {
      x: 0, anchor: 'left', width: 300, padX: 15, top: 398,
      gap: 37, innerGap: 4, align: 'left',
      headlineSize: 28, headlineTracking: 0, headlineMaxH: 90,
      sub: null,
      opacity: 1,
    },
    cta: { h: 40.163, padX: 18.537, radius: 16, fontSize: 15.45 },
    sticker: { x: 173, y: 469, size: 111.889 },
    disclaimer: { padX: 12, padBottom: 12, fontSize: 12 },
    graphics: [
      { x: -114, y: -89, ...G325 },
      { x: 117, y: 292, ...G325 },
    ],
  },

  // ── 가운데 정렬 세로 배너 (장식 그래픽이 텍스트 위에 온다) ──
  {
    id: 'criteo-160x600',
    channel: 'criteo',
    size: '160x600',
    w: 160,
    h: 600,
    shade: SHADE_BOTTOM,
    bg: { x: -220, y: 0, w: 600, h: 600 },
    logo: { x: 11, y: 12, w: 40.751, h: 17.952 },
    grid: { x: 17, y: 59, w: 126, h: 216.843, cols: 2, rows: 3, gapX: 3.109, gapY: 3.368 },
    box: { borderWidth: 0.412, radius: 4.145, shadow: 1.646 },
    copy: {
      x: 0, anchor: 'left', width: 160, padX: 12, top: 303,
      gap: 22, innerGap: 8, align: 'center',
      headlineSize: 20, headlineTracking: 0, headlineMaxH: 84,
      sub: null,
      opacity: 1,
    },
    cta: { h: 36.306, padX: 16.757, radius: 16, fontSize: 13.96 },
    sticker: { x: 30, y: 463, size: 100 },
    disclaimer: { padX: 10, padBottom: 10, fontSize: 10 },
    graphics: [
      { x: 64, y: 174, ...G179 },
      { x: -70, y: 354, ...G179 },
      { x: -71, y: -54, ...G179 },
    ],
    graphicsOnTop: true,
  },

  {
    id: 'criteo-120x600',
    channel: 'criteo',
    size: '120x600',
    w: 120,
    h: 600,
    shade: SHADE_BOTTOM,
    bg: { x: -207, y: 0, w: 601, h: 601 },
    logo: { x: 8, y: 10, w: 41.817, h: 18.421 },
    grid: { x: 12, y: 48, w: 95, h: 289, cols: 1, rows: 6, gapX: 2.403, gapY: 2.603 },
    box: { borderWidth: 0.318, radius: 3.204, shadow: 1.273 },
    copy: {
      x: 0, anchor: 'left', width: 120, padX: 10, top: 354,
      gap: 18, innerGap: 6, align: 'center',
      headlineSize: 18, headlineTracking: -0.36, headlineMaxH: 120,
      sub: null,
      opacity: 1,
    },
    cta: { h: 28, padX: 12.923, radius: 16, fontSize: 10.77 },
    sticker: { x: 23, y: 492, size: 74.222 },
    disclaimer: { padX: 6, padBottom: 10, fontSize: 10 },
    graphics: [
      { x: 17, y: 252, ...G179 },
      { x: -90, y: 440, ...G179 },
      { x: -78, y: -35, ...G179 },
    ],
    graphicsOnTop: true,
  },
];

/** 채널+사이즈로 레이아웃 스펙 찾기. 없으면 undefined(= 아직 Figma 미완성) */
export function getSizeLayout(channel: string, size: string): SizeLayout | undefined {
  return SIZE_LAYOUTS.find((l) => l.channel === channel && l.size === size);
}
