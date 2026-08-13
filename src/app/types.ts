import { DEFAULT_COLOR_MODE, DEFAULT_GRAPHIC_ID, DEFAULT_GRAPHIC_KIND, MIN_BOX_COUNT, DEFAULT_BOX_STYLE, DEFAULT_STICKER_STYLE, type GraphicKind } from '../data/builderOptions';
import type { StickerStyle } from '../data/sizeLayouts';
import { PROMOTIONS, type ColorSet } from '../data/promotions';

/** 배경 디자인 방식 — A: Fractal Glass / B: Graphic Type (structure.pdf) */
export type DesignType = 'A' | 'B';

/** Sales Banner 빌더의 전체 선택 상태 */
export interface BannerState {
  /** 배경 디자인 방식 (첫 화면에서 선택) */
  designType: DesignType;
  /** 1. 선택한 프로모션 id (promotions.ts) */
  promotionId: string | null;
  /**
   * 프로모션 컬러를 어느 벌로 쓸지 — 추천(promotion.main/secondary) 또는 서브(promotion.sub).
   * 예전에는 Hue 를 자유롭게 돌렸는데, 아무 색이나 나오면 브랜드 톤이 흐트러져 두 벌로 좁혔다.
   */
  colorSet: ColorSet;
  /** 배경 색 입히는 방식: 'overlay'(기본, 흑백+overlay) | 'gradient'(그라데이션 맵 LUT) */
  colorMode: 'overlay' | 'gradient';
  /** 2. 광고 매체 id (한판/Single-page — 단일 선택) */
  adChannelId: string | null;
  /** 광고 매체 복수 선택 (단계별/Step 모드 — 여러 매체) */
  adChannelIds: string[];
  /** 3. 배경 타입 id (builderOptions.BACKGROUND_TYPES[design]) */
  backgroundTypeId: string | null;
  /**
   * 3a. 장식 도형 id (builderOptions.GRAPHIC_TYPES). 사이즈별 스펙 위치에 배치된다.
   * null = 아직 안 고름 — 미리보기에도 안 그려진다. 'none' 은 "안 쓰기로 골랐다".
   */
  graphicId: string | null;
  /**
   * 제품 칸별 Import 정보 (모델명·제품명). 배너에는 안 쓰이고, 다운로드할 때
   * "어떤 제품으로 만들었나"를 사용 기록에 남기는 용도다. Upload 로 넣으면 null.
   */
  productMeta: ({ model: string; name: string } | null)[];
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
    /**
     * 첫 프로모션이 골라진 채로 시작한다 — 시안(A/B)이 그렇듯 아무것도 안 골라진
     * 상태로 두면 미리보기가 흑백이라 무엇을 만드는 화면인지 알아보기 어렵다.
     * 명칭도 같이 맞춰 둔다 (선택 버튼이 promoName 을 함께 바꾸므로).
     */
    promotionId: PROMOTIONS[0].id,
    colorSet: 'recommended',
    colorMode: DEFAULT_COLOR_MODE[designType],
    adChannelId: null,
    adChannelIds: [],
    backgroundTypeId: null,
    graphicId: DEFAULT_GRAPHIC_ID,
    graphicKind: DEFAULT_GRAPHIC_KIND,
    shapeId: null,
    boxStyleId: DEFAULT_BOX_STYLE[designType],
    boxCount: null,
    products: Array(MAX_BOXES).fill(null),
    productMeta: Array(MAX_BOXES).fill(null),
    promoName: PROMOTIONS[0].label,
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

/**
 * 첫 화면 A/B 카드에 보여줄 **대표 시안** 상태.
 *
 * 빈 초기 상태(createInitialState)로 그리면 프로모션도 제품 박스도 없어서
 * 무늬만 있는 회색 배너가 나온다 — 고르는 사람이 두 시안의 차이를 못 본다.
 * 그래서 완성된 배너 한 장을 보여준다: Anniversary · 박스 6개.
 *
 * 박스 재질·스티커·배경은 **일부러 손대지 않는다.** 시안별 기본값이 곧 그 시안의
 * 얼굴이라, 기본값이 바뀌면 이 카드도 같이 따라가야 한다.
 * (A = 글래스 박스 + 반투명 스티커 + BG1, B = 흰 박스 + 불투명 스티커 + BG5)
 *
 * 색 입히는 방식만 예외로 못박는다 — 카드는 A·B 둘 다 그라데이션 맵으로 보여준다.
 * A 의 기본값은 overlay 라(Figma 확정본이 그쪽이다) 여기서만 갈라진다.
 */
export function sampleState(designType: DesignType): BannerState {
  return {
    ...createInitialState(designType),
    promotionId: 'anniversary',
    promoName: 'Anniversary',
    boxCount: MAX_BOXES,
    colorMode: 'gradient',
  };
}

/** 디자인 방식 메타 (라벨/설명/대표 썸네일) */
export const DESIGN_TYPES: Record<DesignType, { key: DesignType; name: string; desc: string; thumb: string }> = {
  A: { key: 'A', name: 'Fractal Glass', desc: 'Fractal glass overlay on a gradient background', thumb: '/samples/a-fractal-glass.png' },
  B: { key: 'B', name: 'Graphic Type',  desc: '5 graphic background types, color-parameterized', thumb: '/samples/b-graphic-type.png' },
};
