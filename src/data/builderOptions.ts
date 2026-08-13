/**
 * Sales Banner 위저드에서 고르는 선택지 정의.
 * 실제 디자인/에셋은 Figma 정리 후 채워넣을 예정 — 지금은 탭(선택지)만 세운다.
 */

import type { StickerStyle } from './sizeLayouts';

/** Ad Channel Select — 광고 매체 (Figma Banner Template 섹션) */
export interface AdChannel {
  id: string;
  label: string;
}

export const AD_CHANNELS: AdChannel[] = [
  { id: 'criteo', label: 'Criteo' },
  { id: 'dv360', label: 'DV360' },
  { id: 'pmax', label: 'Pmax' },
  { id: 'meta', label: 'META' },
];

/** Background Type — 배경 그래픽 5종. A/B 디자인별로 다른 이미지 세트.
 *  이미지: public/bg/{a|b}/{id}-color.png (썸네일), -bw.png (tint용 텍스처) */
export interface BackgroundType {
  id: string;
  label: string;
  /** 선택 UI 썸네일 (컬러 샘플) */
  thumb: string;
  /** 미리보기용 그레이 텍스처 (프로모션 색으로 tint) */
  texture: string;
  /**
   * 배경 블러 배율 (1 = Figma 값 그대로).
   *
   * B 는 Figma 에서 다섯 배경 모두 레이어 블러 35 인데, 무늬가 굵은 1·3번은
   * 그 세기가 맞고 나머지는 결이 가늘어 과하게 뭉갠다. 그쪽만 눌러 쓴다.
   * A 는 블러가 0 이라 이 값과 무관하다.
   */
  blurScale: number;
}

/** 기본은 Figma 그대로(1). 여기 적힌 배경만 그만큼 덜 흐리게 한다. */
const BG_BLUR_SCALE: Record<string, number> = {
  'b-bg-02': 0.7,
  'b-bg-04': 0.7,
  'b-bg-05': 0.7,
};

function bgSet(design: 'a' | 'b'): BackgroundType[] {
  return [1, 2, 3, 4, 5].map((n) => {
    const id = `${design}-bg-0${n}`;
    return {
      id,
      label: `BG ${n}`,
      thumb: `/bg/${design}/${id}-color.png`,
      texture: `/bg/${design}/${id}-bw.png`,
      blurScale: BG_BLUR_SCALE[id] ?? 1,
    };
  });
}

/** 디자인 방식(A/B)별 배경 타입 5종 */
export const BACKGROUND_TYPES: Record<'A' | 'B', BackgroundType[]> = {
  A: bgSet('a'),
  B: bgSet('b'),
};

/** 기본으로 선택되는 배경. B 는 요청대로 b-bg-03. */
export const DEFAULT_BACKGROUND_ID: Record<'A' | 'B', string> = {
  A: 'a-bg-01',
  B: 'b-bg-03',
};

/** 선택값 → 배경. 미선택(null)이면 그 디자인의 기본 배경. */
export function resolveBackground(design: 'A' | 'B', id: string | null): BackgroundType {
  const set = BACKGROUND_TYPES[design];
  return set.find((b) => b.id === id)
    ?? set.find((b) => b.id === DEFAULT_BACKGROUND_ID[design])
    ?? set[0];
}

/** Asset Select — 배경 위 도형 어셋 6종 (structure.pdf p.6) */
export interface ShapeAsset {
  id: string;
  label: string;
}

export const SHAPE_ASSETS: ShapeAsset[] = [
  { id: 'shape-01', label: 'Shape-01' },
  { id: 'shape-02', label: 'Shape-02' },
  { id: 'shape-03', label: 'Shape-03' },
  { id: 'shape-04', label: 'Shape-04' },
  { id: 'shape-05', label: 'Shape-05' },
  { id: 'shape-06', label: 'Shape-06' },
];

/** Box Type — 제품 박스 스타일. Gradient는 제외(Figma 확정 디자인에 없음). */
export interface BoxStyle {
  id: string;
  label: string;
}

export const BOX_STYLES: BoxStyle[] = [
  { id: 'glass',    label: 'Glass' },
  { id: 'white',    label: 'White' },
];

/** 박스 재질 선택지 — 시안별로 **기본값을 먼저** 보여준다 */
export const BOX_STYLES_BY_DESIGN: Record<'A' | 'B', BoxStyle[]> = {
  A: [{ id: 'glass', label: 'Glass' }, { id: 'white', label: 'White' }],
  B: [{ id: 'white', label: 'White' }, { id: 'glass', label: 'Glass' }],
};

/**
 * 스티커 선택지 — A·B 동일하게 원형/글래스 두 가지.
 * 별(Star)은 뺐다. 모양은 같고 **채움만 다르다** — A 는 반투명, B 는 불투명
 * (figmaStyle 의 stickerCircleOpaque). 색상은 둘 다 Edit 의 Hue 를 따른다.
 */
export const STICKER_STYLES_BY_DESIGN: Record<'A' | 'B', { id: StickerStyle; label: string }[]> = {
  A: [{ id: 'red', label: 'Red circle' }, { id: 'glass', label: 'Glass' }],
  B: [{ id: 'red', label: 'Red circle' }, { id: 'glass', label: 'Glass' }],
};

/**
 * 흑백 무늬에 프로모션 색을 입히는 방식의 기본값.
 *
 * B 는 gradient — 무늬 밝기를 색으로 **매핑**한다(포토샵 그레이디언트 맵).
 * overlay/luminosity 로 섞으면 결과 밝기를 무늬가 정해서(b-bg-03 평균 143)
 * 그 밝기대의 낮은 채도밖에 못 내고 회색빛이 돈다. 매핑은 섞는 게 아니라
 * 갈아끼우는 것이라 탁해질 수가 없다.
 * A 는 Figma 블러가 0 이고 종전 결과가 확정본이라 overlay 그대로 둔다.
 */
export type ColorMode = 'overlay' | 'gradient';

export const DEFAULT_COLOR_MODE: Record<'A' | 'B', ColorMode> = {
  A: 'overlay',
  B: 'gradient',
};

/** Edit 창에 보이는 순서 — 시안별로 **기본값을 먼저** 보여준다 */
export const COLOR_MODES_BY_DESIGN: Record<'A' | 'B', { id: ColorMode; label: string; desc: string }[]> = {
  A: [
    { id: 'overlay',  label: 'Overlay',      desc: '무늬 밝기 + 바탕 색 (A 기본)' },
    { id: 'gradient', label: 'Gradient map', desc: '밝기를 색으로 매핑 — 색이 가장 선명' },
  ],
  B: [
    { id: 'gradient', label: 'Gradient map', desc: '밝기를 색으로 매핑 — 색이 가장 선명 (B 기본)' },
    { id: 'overlay',  label: 'Overlay',      desc: '무늬 밝기 + 바탕 색' },
  ],
};

export const DEFAULT_BOX_STYLE: Record<'A' | 'B', string> = { A: 'glass', B: 'white' };
export const DEFAULT_STICKER_STYLE: Record<'A' | 'B', StickerStyle> = { A: 'red', B: 'red' };

/**
 * 저장된 선택값이 그 시안의 목록에 없으면 기본값으로 되돌린다.
 * (별을 뺐으므로, 예전에 'star' 를 골라둔 상태가 남아 있어도 원형으로 나온다)
 */
export function resolveStickerStyle(design: 'A' | 'B', id: StickerStyle | null): StickerStyle {
  return STICKER_STYLES_BY_DESIGN[design].some((o) => o.id === id)
    ? (id as StickerStyle)
    : DEFAULT_STICKER_STYLE[design];
}

/**
 * 카피 최대 글자수 — 현재 기본 문구 길이를 그대로 상한으로 쓴다.
 * 이보다 길어지면 Figma 에서 잰 상자를 넘어 레이아웃이 깨진다.
 */
export const MAX_HEADLINE = 'Save on LG favorites'.length;          // 20
export const MAX_SUBCOPY = 'Limited-time offers, only on LG.com'.length; // 35

/**
 * Graphic Type — 배경 위 장식 도형 6종 (reference/graphic → public/graphics).
 *
 * 같은 도형이 선(line)/면(full) 두 벌로 있다. 둘 다 흰색 + 알파 이미지라
 * 배너에서는 mix-blend-overlay 로 얹힌다 — 다른 건 채워진 넓이뿐이다
 * (line 은 화면의 1~2%, full 은 11~26%).
 *
 * 배치(위치·크기·개수)는 사이즈별 스펙(sizeLayouts.SizeLayout.graphics)이 정하고,
 * 여기서는 **어떤 도형을 어느 벌로 쓸지**만 고른다.
 */
export type GraphicKind = 'line' | 'full';

/**
 * Edit 창에 보이는 벌.
 *
 * Line 은 요청으로 뺐다 — A·B 모두 Full 만 쓴다. 이미지(public/graphics)와
 * graphicSrc 의 line 처리는 그대로 두었으니, 다시 쓰려면 여기 한 줄만 되살리면 된다.
 * 벌이 하나뿐이면 Edit 창의 선택 줄도 자동으로 숨는다.
 */
export const GRAPHIC_KINDS: Array<{ id: GraphicKind; label: string }> = [
  { id: 'full', label: 'Full' },
];

export const DEFAULT_GRAPHIC_KIND: GraphicKind = 'full';

export interface GraphicType {
  id: string;
  label: string;
  /** 선 버전 경로 — 벌을 가리지 않을 때의 기본값 */
  src: string;
}

export const GRAPHIC_TYPES: GraphicType[] = ['01', '02', '03', '04', '05', '06'].map((n) => ({
  id: `graphic-${n}`,
  label: `Graphic ${Number(n)}`,
  src: `/graphics/graphic-${n}.png`,
}));

/** 이 도형의 해당 벌 이미지 경로. full 은 하위 폴더에 같은 이름으로 들어 있다. */
export function graphicSrc(id: string | null, kind: GraphicKind = DEFAULT_GRAPHIC_KIND) {
  const g = getGraphic(id ?? '');
  return kind === 'full' ? g.src.replace('/graphics/', '/graphics/full/') : g.src;
}

/**
 * 기본은 **도형 없음**. 미리보기에는 아무 도형도 안 그려지고, Edit 에서는
 * None 이 골라진 상태로 시작한다 (아무것도 선택 안 된 것보다 알아보기 쉽다).
 * 벌(line/full)의 기본은 full 이라, 도형을 고르면 면 버전부터 보인다.
 */
export const DEFAULT_GRAPHIC_ID: string | null = 'none';

/**
 * 도형 없음. B 는 도형을 아예 안 쓰는 경우가 있어야 해서 별도 값으로 둔다.
 * (Edit 창에서는 원에 사선 하나 그은 아이콘으로 보여준다)
 * 미선택(null)과는 다르다 — 이쪽은 "안 쓰기로 골랐다"는 뜻이다.
 */
export const NO_GRAPHIC_ID = 'none';

/** 이 선택값이 실제로 도형을 그리는가. 미선택(null)도 안 그린다. */
export function hasGraphic(id: string | null) {
  return !!id && id !== NO_GRAPHIC_ID;
}

export function getGraphic(id: string): GraphicType {
  return GRAPHIC_TYPES.find((g) => g.id === id) ?? GRAPHIC_TYPES[0];
}

/** 박스 개수: 3~6개 (최소 3개부터 — 그 미만은 레이아웃이 성립하지 않음) */
export const BOX_COUNTS = [3, 4, 5, 6] as const;
export const MIN_BOX_COUNT = 3;

/** 할인율 스티커 입력 범위 */
export const MIN_DISCOUNT = 10;
export const MAX_DISCOUNT = 90;

/** 사이즈 베리에이션 (structure.pdf p.9) — 대표 사이즈. 전체 41종은 Figma 확정 후 확장. */
export interface BannerSize {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const BANNER_SIZES: BannerSize[] = [
  { id: '1200x628',  label: '1200×628',  width: 1200, height: 628 },
  { id: '1200x1200', label: '1200×1200', width: 1200, height: 1200 },
  { id: '300x600',   label: '300×600',   width: 300,  height: 600 },
  { id: '120x600',   label: '120×600',   width: 120,  height: 600 },
  { id: '728x90-l',  label: '728×90 · L', width: 728, height: 90 },
  { id: '728x90-r',  label: '728×90 · R', width: 728, height: 90 },
];
