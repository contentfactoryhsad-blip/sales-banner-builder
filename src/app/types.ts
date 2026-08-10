import { DEFAULT_GRAPHIC_ID, DEFAULT_GRAPHIC_KIND, MIN_BOX_COUNT, DEFAULT_BOX_STYLE, DEFAULT_STICKER_STYLE, type GraphicKind } from '../data/builderOptions';
import type { StickerStyle } from '../data/sizeLayouts';

/** 배경 디자인 방식 — A: Fractal Glass / B: Graphic Type (structure.pdf) */
export type DesignType = 'A' | 'B';

/** Sales Banner 빌더의 전체 선택 상태 */
export interface BannerState {
  /** 배경 디자인 방식 (첫 화면에서 선택) */
  designType: DesignType;
  /** 1. 선택한 프로모션 id (promotions.ts) */
  promotionId: string | null;
  /** Main 컬러 Hue (0-360). null = 프로모션 원래 색. S/L은 유지, Hue만 변경 */
  mainHue: number | null;
  /** 조합(Secondary) 컬러 Hue. main과 독립적으로 조정한다. */
  secondaryHue: number | null;
  /** 배경 색 입히는 방식: 'overlay'(기본, 흑백+overlay) | 'gradient'(그라데이션 맵 LUT) */
  colorMode: 'overlay' | 'gradient';
  /** 2. 광고 매체 id (한판/Single-page — 단일 선택) */
  adChannelId: string | null;
  /** 광고 매체 복수 선택 (단계별/Step 모드 — 여러 매체) */
  adChannelIds: string[];
  /** 3. 배경 타입 id (builderOptions.BACKGROUND_TYPES[design]) */
  backgroundTypeId: string | null;
  /** 3a. 장식 도형 id (builderOptions.GRAPHIC_TYPES). 사이즈별 스펙 위치에 배치된다. */
  graphicId: string;
  /** 3b. 도형을 선(line)으로 쓸지 면(full)으로 쓸지. 도형 선택과는 별개다. */
  graphicKind: GraphicKind;
  /** (미사용) 도형 어셋 — Background Type로 대체됨 */
  shapeId: string | null;
  /** 4a. 박스 스타일 id (builderOptions.BOX_STYLES) */
  boxStyleId: string | null;
  /** 4b. 박스(제품) 개수 3~6. 최소 3개부터 시작한다. */
  /** 제품 박스 개수. null = 아직 안 고름 (버튼이 아무것도 선택 안 된 상태로 보인다) */
  boxCount: number | null;
  /** 5. 제품 이미지 (박스 슬롯별, 최대 6개). null = 비어있음. URL(프록시) 또는 dataURL. */
  products: (string | null)[];
  /** 세일 프로모션 명칭 (사용자 입력) */
  promoName: string;

  /** 할인율 스티커의 숫자 (10~90). "UP TO {discount}% off" */
  discount: number;
  /** 스티커 배경 스타일 */
  stickerStyle: StickerStyle;
  /** 레드 스티커 Hue 회전. null = 기본 빨강 그대로 */
  stickerHue: number | null;
  /** 스티커 표시 여부 (Copy 처럼 체크박스로 끄고 켠다) */
  showSticker: boolean;

  /** 카피 텍스트 — 실시간 편집, auto-layout(flex)으로 reflow.
   *  (Eyebrow는 전 사이즈에서 제외하기로 확정되어 제거됨) */
  headline: string;
  subcopy: string;
  /** 카피 요소 표시 여부 (체크 해제 시 auto-layout에서 빠지며 줄어듦) */
  showHeadline: boolean;
  showSubcopy: boolean;
}

export const MAX_BOXES = 6;

export function createInitialState(designType: DesignType): BannerState {
  return {
    designType,
    promotionId: null,
    mainHue: null,
    secondaryHue: null,
    colorMode: 'overlay',
    adChannelId: null,
    adChannelIds: [],
    backgroundTypeId: null,
    graphicId: DEFAULT_GRAPHIC_ID,
    graphicKind: DEFAULT_GRAPHIC_KIND,
    shapeId: null,
    boxStyleId: DEFAULT_BOX_STYLE[designType],
    boxCount: null,
    products: Array(MAX_BOXES).fill(null),
    promoName: '[Promotion Name]',
    discount: 20,
    stickerStyle: DEFAULT_STICKER_STYLE[designType],
    stickerHue: null,
    showSticker: true,
    headline: 'Save on LG favorites',
    subcopy: 'Limited-time offers, only on LG.com',
    showHeadline: true,
    showSubcopy: true,
  };
}

/** 디자인 방식 메타 (라벨/설명/대표 썸네일) */
export const DESIGN_TYPES: Record<DesignType, { key: DesignType; name: string; desc: string; thumb: string }> = {
  A: { key: 'A', name: 'Fractal Glass', desc: 'Fractal glass overlay on a gradient background', thumb: '/samples/a-fractal-glass.png' },
  B: { key: 'B', name: 'Graphic Type',  desc: '5 graphic background types, color-parameterized', thumb: '/samples/b-graphic-type.png' },
};
