import type { FigmaFrameSpec } from './figmaSpec';
import { SPEC_A_CRITEO } from './figmaSpec.A';
import { SPEC_B_CRITEO } from './figmaSpec.B';
import { SPEC_A_DV360 } from './figmaSpec.dv360.A';
import { SPEC_B_DV360 } from './figmaSpec.dv360.B';
import { SPEC_A_PMAXMETA } from './figmaSpec.pmaxmeta.A';
import { SPEC_B_PMAXMETA } from './figmaSpec.pmaxmeta.B';
import { METASAUDI_DISC_PAD, METASAUDI_PRODUCT, SPEC_A_METASAUDI, SPEC_B_METASAUDI } from './figmaSpec.metasaudi';
import { SHADE } from './figmaSpec.shade';
import {
  PMAXMETA_DISC_PAD, PMAXMETA_HEAD_CENTER, PMAXMETA_HEAD_NOWRAP, PMAXMETA_PRODUCT,
  PMAXMETA_SHADE_ANGLE,
} from './figmaSpec.pmaxmeta.extra';
import {
  DV360_DISC_PAD, DV360_HEAD_CENTER, DV360_HEAD_NOWRAP, DV360_PRODUCT, DV360_SHADE_ANGLE,
} from './figmaSpec.dv360.extra';
import { DISC_PAD, HEAD_BREAK, HEAD_CENTER, HEAD_NOWRAP, PRODUCT, SHADE_ANGLE, type ProdRect } from './figmaSpec.extra';

export type DesignKind = 'A' | 'B';

/**
 * A/B 스타일 세트 — 기하는 사이즈별 실측값(figmaSpec.*)이 갖고,
 * 여기서는 **두 타입이 다른 재질/색**만 정의한다.
 */
export interface DesignStyle {
  label: string;
  desc: string;
  /** 제품 박스 */
  box: {
    fill: string;
    stroke: string | null;
    strokeRatio: number;   // 박스 폭 대비 테두리 두께
    shadowRatio: number;   // 박스 폭 대비 그림자 offset/blur
    /** Figma Glass 이펙트 사용 여부 (A만) */
    glass: boolean;
  };
  /** 스티커 모양 — A·B 모두 원. (별 렌더 경로는 남겨 뒀다) */
  sticker: 'circle' | 'star';
  /**
   * 원형 스티커를 **불투명**하게 칠할지.
   *
   * A 는 Figma 대로 반투명(STICKER_FILL)이라 뒤 배경이 살짝 비친다.
   * B 는 흰 셰이드 위라 반투명이면 묻혀서, 별에 쓰던 색을 그대로 꽉 채운다.
   * 색상 자체는 둘 다 STICKER_RED 를 Edit 의 Hue 로 돌린 값이다.
   */
  stickerCircleOpaque?: boolean;
  /**
   * 카피 글자색. Figma 의 Mode 배리언트와 대응한다.
   *   A = Dark mode  (검정 셰이드 위) → 흰 글씨
   *   B = Light mode (흰 셰이드 위)   → 검정 글씨
   * CTA 안의 "Shop now" 는 빨간 버튼 위라 두 타입 모두 흰색.
   */
  text: string;
  /** 디스클레이머 — Figma 는 두 타입 모두 검정 글씨 + 흰 글로우(DROP_SHADOW 30/10) */
  discColor: string;
  discShadow: string | undefined;
  /** 장식 도형 표시 여부. Figma 에서 A 는 17개 전부 표시, B 는 17개 전부 숨김. */
  graphics: boolean;
  /** LG 로고. Figma 배리언트 Property 1 = white(A) / color(B) */
  logo: string;
  /**
   * 스티커 안 글자 배율. STICKER_LAYOUT 이 이미 Figma 의 95% 축소를 반영하고 있으므로
   * 여기서는 그 위에 **추가로** 곱해지는 값이다. A/B 모두 1 — 위치·크기 기준을 통일했다.
   */
  stickerTextScale: number;
  /**
   * 스티커 **도형**만의 배율(별/원). 안의 글자에는 영향을 주지 않는다.
   * 중심을 유지한 채 커지므로 배치는 그대로다.
   */
  stickerShapeScale: number;
  /**
   * 셰이드 그라데이션 불투명도 배율. **1 = Figma 그대로.**
   *
   * 램프 모양(각도·위치·이징)은 그대로 두고 알파 전체에 곱해진다.
   * A 의 셰이드는 프로모션 컬러라(shadeTint) 짙은 쪽이 100% 면 바탕이 완전히 덮여
   * 0.85 로 눌러 둔다. B 도 흰 램프가 짙은 쪽을 다 덮지 않도록 0.95 로 살짝 눌렀다.
   * ※ B 의 색 농도는 여기가 아니라 textureOpacity 로 조절할 것.
   */
  shadeOpacity: number;
  /** 셰이드 색 (rgb). Figma 기준 A=검정 / B=흰색. */
  shadeRgb: string;
  /**
   * 셰이드를 배경에 얹는 블렌드 모드.
   *
   * normal 은 검정을 평평하게 덮어 "검정이 눈에 띈다". multiply 는 답이 아니다 —
   * 검정은 곱해도 0 이라 normal 과 결과가 픽셀 단위로 같다.
   * overlay 는 어두운 곳은 더 어둡게, 밝은 곳은 2·Cb−1 로 눌러 **바탕의 색과 구조를
   * 남긴 채** 어둡게 만든다. 그래서 프로모션 컬러에 묻어든다.
   */
  shadeBlend: 'normal' | 'overlay';
  /**
   * 셰이드를 **프로모션 컬러로** 만들지 여부.
   *
   * 켜면 Figma 실측 램프(각도·알파·이징)는 그대로 두고 색만 바꾼다 —
   * 짙은 쪽이 메인, 옅어지는 쪽이 조합색이다. 프로모션을 고르면 셰이드가
   * 그 색으로 바뀌고, Edit 의 Hue 를 돌리면 같이 돌아간다.
   * 프로모션 미선택이면 입힐 색이 없으므로 종전 램프(검정/흰색)로 돌아간다.
   */
  shadeTint?: boolean;
  /**
   * shadeTint 가 실제로 적용될 때 쓰는 블렌드 모드.
   *
   * 검정 셰이드는 바탕을 남기려고 overlay 로 얹었지만, 색이 있는 셰이드는
   * 그 색 자체를 보여주는 게 목적이라 normal 로 그대로 올린다.
   */
  shadeTintBlend?: 'normal' | 'overlay';
  /**
   * 배경 텍스처를 프로모션 컬러 위에 얹는 불투명도 (overlay 블렌드).
   *
   * 텍스처가 대체로 밝아서 overlay 로 얹으면 아래 컬러를 밝은 쪽으로 밀어
   * 색이 옅게 보인다. **낮출수록 컬러가 진해지고**, 대신 텍스처 결이 덜 보인다.
   * 그라데이션은 그대로 두고 색만 조절하는 값이다.
   */
  textureOpacity: number;
  /**
   * 배경 텍스처를 컬러 위에 얹는 블렌드 모드.
   *
   * `overlay` 는 바탕 밝기에 따라 결과가 밝게/어둡게 튀어서, 텍스처의 형태가
   * 얼룩처럼 드러나고 색이 탁해진다(굴곡져 보이는 원인).
   * `luminosity` 는 **텍스처의 명암 + 바탕의 색**을 합쳐 깨끗하게 물들인다.
   * Figma 의 컬러 배경 이미지에 가까운 결과가 나온다.
   */
  textureBlend: 'overlay' | 'luminosity';
  /**
   * 블렌드 전에 텍스처에 거는 필터.
   *
   * luminosity 는 결과 **명도를 텍스처에서** 가져온다. 배경 텍스처가 밝아서
   * (b-bg-03 기준 luma 160~232) 그대로 쓰면 결과가 늘 밝은 톤이 되고,
   * 밝으면 같은 색이라도 옅게 보여 프로모션 컬러가 안 먹는 것처럼 된다.
   * 명도를 중간대로 내려 색이 앉을 자리를 만든다.
   *   brightness 0.75 · contrast 1.15  →  luma 160~232 가 약 119~181 로
   */
  textureFilter?: string;
}

/**
 * 박스 재질 — 시안 고정이 아니라 Edit 에서 고르는 값(state.boxStyleId)이다.
 * 시안은 기본값만 정한다(A=glass / B=white, builderOptions.DEFAULT_BOX_STYLE).
 */
export const BOX_MATERIALS: Record<string, DesignStyle['box']> = {
  glass: { fill: 'rgba(255,255,255,0.15)', stroke: 'rgba(255,255,255,0.15)',
           strokeRatio: 1.573 / 234.748, shadowRatio: 6.29 / 234.748, glass: true },
  white: { fill: '#ffffff', stroke: null,
           strokeRatio: 0, shadowRatio: 6.29 / 234.748, glass: false },
};

export const DESIGN_STYLES: Record<DesignKind, DesignStyle> = {
  A: {
    label: 'Glass',
    desc: '반투명 유리 박스 · 원형 스티커 · 검정 셰이드',
    box: { fill: 'rgba(255,255,255,0.15)', stroke: 'rgba(255,255,255,0.15)',
           strokeRatio: 1.573 / 234.748, shadowRatio: 6.29 / 234.748, glass: true },
    sticker: 'circle',
    text: '#ffffff',
    discColor: '#ffffff',
    discShadow: '0px 0px 30px rgba(255,255,255,0.6), 0px 0px 10px rgba(255,255,255,0.4)',
    graphics: true,
    logo: '/lg-logo-white.svg',
    stickerTextScale: 1,
    stickerShapeScale: 1,
    shadeOpacity: 0.85,
    shadeRgb: '0,0,0',
    shadeBlend: 'overlay',
    shadeTint: true,
    shadeTintBlend: 'normal',
    textureOpacity: 0.9,
    textureBlend: 'overlay',
  },
  B: {
    label: 'Solid',
    desc: '단색 흰 박스 · 원형 스티커(불투명) · 흰 셰이드 · 배경 블러',
    box: { fill: '#ffffff', stroke: null,
           strokeRatio: 0, shadowRatio: 6.29 / 234.748, glass: false },
    sticker: 'circle',
    stickerCircleOpaque: true,
    text: '#141414',
    discColor: '#000000',
    discShadow: '0px 0px 30px rgba(255,255,255,0.9), 0px 0px 10px rgba(255,255,255,0.7)',
    graphics: false,
    logo: '/lg-logo.svg',
    // 예전엔 여기서 한 번 더 5% 줄여 썼다 (글자 크기·위치 기준을 A 하나로 통일)
    stickerTextScale: 1,
    // Figma 그대로 1.0 — 예전엔 도형만 5% 줄여 썼다 (위치·크기 기준을 A 하나로 통일)
    stickerShapeScale: 1,
    // Figma 그대로 1.0 — 예전엔 0.95 로 5% 눌러 썼다 (셰이드 기준을 Figma 하나로 통일)
    shadeOpacity: 1,
    shadeRgb: '255,255,255',
    shadeBlend: 'normal',
    textureOpacity: 1,
    textureBlend: 'luminosity',
    textureFilter: 'brightness(0.75) contrast(1.15)',
  },
};

/**
 * 채널별 스펙. 키가 "채널-사이즈" 라 채널별 스펙을 한 벌로 합쳐 쓴다.
 * (Pmax · META 는 Figma 확정 후 같은 방식으로 추가)
 */
const SPECS: Record<DesignKind, Record<string, FigmaFrameSpec>> = {
  A: { ...SPEC_A_CRITEO, ...SPEC_A_DV360, ...SPEC_A_PMAXMETA, ...SPEC_A_METASAUDI },
  B: { ...SPEC_B_CRITEO, ...SPEC_B_DV360, ...SPEC_B_PMAXMETA, ...SPEC_B_METASAUDI },
};

/**
 * META-Saudi 는 META 의 좌우 미러 판이라 **기하가 아닌 부가 데이터**(제품 사각형·
 * 고지문 패딩·셰이드 각도·줄바꿈 목록)는 META 것을 그대로 물려받는다.
 * 키 기반 조회 앞에서 metasaudi-* → meta-* 로 바꿔 조회한다.
 */
const sharedKey = (key: string) => key.startsWith('metasaudi-') ? key.replace('metasaudi-', 'meta-') : key;

/** A 의 셰이드 각도 — 종전 그대로. B 는 여기 쓰지 않는다(SHADE.B 사용). */
const ANGLES_A: Record<string, number> = {
  ...SHADE_ANGLE, ...DV360_SHADE_ANGLE, ...PMAXMETA_SHADE_ANGLE.A,
};

const PRODUCTS: Record<string, Record<string, ProdRect[]>> = { ...PRODUCT, ...DV360_PRODUCT, ...PMAXMETA_PRODUCT, ...METASAUDI_PRODUCT };
const PADS = { ...DISC_PAD, ...DV360_DISC_PAD, ...PMAXMETA_DISC_PAD, ...METASAUDI_DISC_PAD };
const NOWRAP: Record<DesignKind, string[]> = {
  A: [...HEAD_NOWRAP.A, ...DV360_HEAD_NOWRAP.A, ...PMAXMETA_HEAD_NOWRAP.A],
  B: [...HEAD_NOWRAP.B, ...DV360_HEAD_NOWRAP.B, ...PMAXMETA_HEAD_NOWRAP.B],
};
const CENTERED = [...HEAD_CENTER, ...DV360_HEAD_CENTER, ...PMAXMETA_HEAD_CENTER];

/**
 * 프로모션 명칭의 뒷단어를 **무조건 다음 줄**로 내리는 사이즈.
 *
 * "Back To School – Spring" 처럼 뒤에 계절이 붙는 명칭이 있는데, 세로로 긴 사이즈는
 * 앞말과 계절이 한 줄에 붙어 읽혀서 이 사이즈들만 끊는다.
 *   dv360-300x1050  카피 288px @36px
 *   dv360-120x240   카피 112px @12px
 * 둘 다 가장 긴 앞말("Back To School.")이 한 줄에 들어가는 폭이다 — 그래야 끊는 게
 * 의미가 있다. 앞말이 폭을 넘기면 fitScale 이 접는 대신 줄여서 한 줄을 지킨다.
 */
const PROMO_BREAK = ['dv360-300x1050', 'dv360-120x240'];

/** 앱의 mediaSizes 이름("1200x628") → Figma 프레임 키("criteo-1200x628") */
/**
 * 가로형/세로형 판정.
 *
 * 겉보기 비율이 아니라 **레이아웃**이 갈리는 지점이다 — 가로형은 카피가 왼쪽,
 * 세로형은 아래에 온다. 41개를 재보면 가로형은 최소 1.33:1(1024x768),
 * 세로형은 최대 1.2:1(300x250 · 336x280)이라 그 사이 어디로 잡아도 정확히 나뉜다.
 * 300x250 처럼 가로로 넓어도 카피가 아래 오는 판은 세로형이다.
 */
export const WIDE_RATIO = 1.25;
export const isWideFrame = (w: number, h: number) => w / h >= WIDE_RATIO;

export function specKey(channel: string, size: string) {
  return `${channel}-${size}`;
}

export function getSpec(design: DesignKind, channel: string, size: string): FigmaFrameSpec | undefined {
  return SPECS[design][specKey(channel, size)];
}

/** 이 사이즈가 지원하는 박스 개수들 (Figma 에 있는 버전만) */
export function boxCountsFor(design: DesignKind, channel: string, size: string): number[] {
  const s = getSpec(design, channel, size);
  return s ? Object.keys(s.box).map(Number).sort((a, b) => a - b) : [];
}

/** 요청한 개수에 가장 가까운, 실제 존재하는 버전을 고른다 */
export function resolveBoxCount(spec: FigmaFrameSpec, want: number): string {
  const keys = Object.keys(spec.box);
  if (keys.includes(String(want))) return String(want);
  return keys.reduce((best, k) =>
    Math.abs(Number(k) - want) < Math.abs(Number(best) - want) ? k : best, keys[0]);
}

/**
 * Figma 그라데이션 → CSS linear-gradient.
 *
 * 각도는 노드 rotation 이 아니라 **gradientTransform 에서 역산한 실측값**(SHADE_ANGLE)을 쓴다.
 * rotation 은 전 사이즈가 180 이라 그것만 보면 방향을 알 수 없다.
 */
/**
 * 셰이드 그라데이션 CSS.
 *
 * A 와 B 는 산출 방식이 다르다 — 섞지 말 것.
 *  · A : 종전 방식 그대로. 각도는 ANGLES_A, 스톱은 spec.gr 을 0%→100% 로 편다.
 *        이미 눈으로 맞춰둔 상태라 건드리지 않는다.
 *  · B : gradientTransform 을 CSS 좌표로 투영한 실측표(SHADE.B). 스톱 위치가
 *        0%/100% 가 아니라 19~40% 에서 시작해 57~95% 에서 끝난다.
 */
/** B 셰이드 램프를 몇 단계로 부드럽게 펼칠지. 클수록 매끄럽고 CSS 문자열만 길어진다. */
const SHADE_EASE_STEPS = 12;

/*
  B 셰이드는 **Figma 실측 그대로** 그린다 — 손대는 값이 없다.

  예전엔 두 상수로 흰색을 깎았다: 시작을 램프의 35% 만큼 앞으로 당기고
  (SHADE_START_PULL), 앞쪽 알파를 1.6 제곱으로 빨리 뺐다(SHADE_FALLOFF).
  카피 옆을 부드럽게 풀려는 의도였는데, 둘 다 **램프 길이 대비 비율**이라
  순백 구간이 짧은 사이즈에서는 흰 판이 통째로 사라졌다 —
  criteo-468x60 은 시작점이 5.3% → -21.9% 로 프레임 밖까지 밀려
  왼쪽 끝조차 흰색이 아니었다.
  사이즈별 예외 목록으로 13개를 빼서 쓰다가, 기준을 Figma 하나로 통일했다.
  되살릴 일이 있으면 git 이력에 계산식이 그대로 있다.

  남은 가공은 아래 smoothstep 뿐이고, 그건 보정이 아니라 **띠 방지**다.
*/

/**
 * A 셰이드(검정)를 얼마나 빨리 빼는지.
 *
 * A 는 스톱 2개를 0%→100% 로 그대로 펴서 알파가 직선으로 떨어진다. 그래서
 * 앞쪽 절반이 오래 검게 남아 "검정이 눈에 띈다"는 인상을 준다.
 * (multiply 블렌드는 답이 아니다 — 검정은 곱해도 0 이라 normal 과 결과가 같다.)
 *
 * 1 이면 종전 그대로. 키울수록 앞쪽이 먼저 옅어지고 꼬리만 길게 남는다.
 *   1.0 → 중앙 0.50   1.5 → 중앙 0.35   2.0 → 중앙 0.25
 */
const SHADE_FALLOFF_A = 1;

/** 셰이드를 프로모션 컬러로 만들 때 쓰는 두 색 (rgb 0~255). 짙은 쪽 → 옅어지는 쪽 */
export type ShadeTint = { from: [number, number, number]; to: [number, number, number] };

export function shadeCss(
  gr: FigmaFrameSpec['gr'], design: DesignKind, key: string, boost = 1, tint?: ShadeTint | null,
) {
  if (design === 'B') {
    const s = SHADE.B[sharedKey(key)];
    if (!s) return 'none';
    const [deg, stops] = s;
    const rgb = DESIGN_STYLES.B.shadeRgb;
    /*
      스톱 두 개만 주면 알파가 **직선**으로 떨어진다. 직선 램프는 시작·끝에서
      기울기가 갑자기 꺾여, 그 두 지점이 띠처럼 보인다(흰 셰이드라 특히 잘 보인다).
      끝점(Figma 실측 위치)은 그대로 두고 사이를 smoothstep 으로 채워 꺾임을 없앤다.
      전 사이즈 같은 방식이다.
    */
    const parts: string[] = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const [p0, a0] = stops[i];
      const [p1, a1] = stops[i + 1];
      for (let k = 0; k < SHADE_EASE_STEPS; k++) {
        const t = k / SHADE_EASE_STEPS;
        const e = t * t * (3 - 2 * t);                 // smoothstep
        const pos = p0 + (p1 - p0) * t;
        const a = a1 + (a0 - a1) * (1 - e);
        parts.push(`rgba(${rgb},${Math.min(1, a * boost).toFixed(3)}) ${pos.toFixed(2)}%`);
      }
    }
    const [lp, la] = stops[stops.length - 1];
    parts.push(`rgba(${rgb},${Math.min(1, la * boost).toFixed(3)}) ${lp}%`);
    return `linear-gradient(${deg}deg, ${parts.join(', ')})`;
  }
  if (!gr) return 'none';
  const [, stops] = gr;
  const angle = ANGLES_A[sharedKey(key)] ?? 0;
  const last = stops.length - 1;
  /*
    램프 위 위치 u(0~1) 에서의 색.
    tint 가 없으면 Figma 실측 luma 를 그대로 쓴다(= 검정).
    있으면 각도·알파·이징은 그대로 두고 색만 메인 → 조합색으로 갈아탄다.
  */
  const colorAt = (u: number, luma: number) => {
    if (!tint) { const v = Math.round(luma * 255); return `${v},${v},${v}`; }
    return tint.from.map((c, i) => Math.round(c + (tint.to[i] - c) * u)).join(',');
  };
  // B 와 같은 방식으로 사이를 채운다 — 직선 램프는 앞쪽이 오래 짙게 남는다.
  const parts: string[] = [];
  for (let i = 0; i < last; i++) {
    const [p0, a0, l0] = stops[i];
    const [p1, a1] = stops[i + 1];
    for (let k = 0; k < SHADE_EASE_STEPS; k++) {
      const t = k / SHADE_EASE_STEPS;
      const e = t * t * (3 - 2 * t);                       // smoothstep
      const pos = (p0 + (p1 - p0) * t) * 100;
      const a = a1 + (a0 - a1) * Math.pow(1 - e, SHADE_FALLOFF_A);
      parts.push(`rgba(${colorAt((i + t) / last, l0)},${Math.min(1, a * boost).toFixed(3)}) ${pos.toFixed(2)}%`);
    }
  }
  const [lp, la, ll] = stops[last];
  parts.push(`rgba(${colorAt(1, ll)},${Math.min(1, la * boost).toFixed(3)}) ${(lp * 100).toFixed(2)}%`);
  return `linear-gradient(${angle}deg, ${parts.join(', ')})`;
}

/** 이 사이즈·박스개수의 제품 사각형 목록 (박스 기준). 없으면 빈 배열 */
export function productRects(key: string, boxKey: string): ProdRect[] {
  // 자기 키가 우선(사우디 전용 값), 없으면 공유 키(meta)로 폴백 — 개수 단위로 갈린다
  return PRODUCTS[key]?.[boxKey] ?? PRODUCTS[sharedKey(key)]?.[boxKey] ?? [];
}

/** 이 사이즈의 헤드라인이 줄바꿈하지 않는가 (Figma WIDTH_AND_HEIGHT) */
export function headNoWrap(design: DesignKind, key: string) {
  return NOWRAP[design].includes(sharedKey(key));
}
/** 이 사이즈는 프로모션 명칭의 뒷단어를 다음 줄로 내리는가 */
export function promoBreak(key: string) {
  return PROMO_BREAK.includes(key);
}
/** 헤드라인 자체의 정렬 (블록 정렬과 다를 수 있다). metasaudi 는 RTL 미러라 오른쪽. */
export function headAlign(key: string): 'left' | 'center' | 'right' {
  if (key.startsWith('metasaudi-')) return 'right';
  return CENTERED.includes(key) ? 'center' : 'left';
}

/** 고지문 프레임 안쪽 패딩 [좌, 우, 아래]. 자기 키가 우선, 없으면 공유 키(meta)로. */
export function discPad(key: string): [number, number, number] {
  return PADS[key] ?? PADS[sharedKey(key)] ?? [0, 0, 0];
}

/**
 * 헤드라인 본문을 Figma 의 줄 구성대로 쪼갠다.
 * 줄바꿈이 지정되지 않은 사이즈는 한 줄 그대로 반환한다.
 */
export function headLines(design: DesignKind, key: string, text: string): string[] {
  const at = HEAD_BREAK[design][sharedKey(key)];
  if (!at) return [text];
  const w = text.trim().split(/\s+/);
  if (w.length <= at) return [text];
  return [w.slice(0, at).join(' '), w.slice(at).join(' ')];
}

/**
 * 장식 도형 위치 — **A 기준을 두 시안이 공용**으로 쓴다.
 * Figma 의 B 는 Graphics 레이어가 숨김이지만, 앱에서는 B 도 도형을 고를 수 있어야 하고
 * 그때 위치는 A 와 같아야 한다는 요구에 따른다.
 */
export function graphicRects(key: string): Array<[number, number, number, number]> {
  return (SPECS.A[key]?.gx ?? []) as Array<[number, number, number, number]>;
}

/**
 * 할인율 스티커 위치·크기 — **A 기준을 두 시안이 공용**으로 쓴다(graphicRects 와 같은 이유).
 * A/B 는 Figma 상 별도 프레임이라 각자 실측했더니 사이즈별로 몇 px 씩 어긋나 있었다 —
 * 두 시안이 같은 좌·우 분할 레이아웃을 쓰므로 어긋날 이유가 없다. A 값 하나로 통일한다.
 */
export function stickerRect(key: string): [number, number, number] | null {
  return SPECS.A[key]?.st ?? null;
}
