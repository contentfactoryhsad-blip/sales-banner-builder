import type { FigmaFrameSpec } from './figmaSpec';
import { SPEC_A_CRITEO } from './figmaSpec.A';
import { SPEC_B_CRITEO } from './figmaSpec.B';
import { SPEC_A_DV360 } from './figmaSpec.dv360.A';
import { SPEC_B_DV360 } from './figmaSpec.dv360.B';
import { SPEC_A_PMAXMETA } from './figmaSpec.pmaxmeta.A';
import { SPEC_B_PMAXMETA } from './figmaSpec.pmaxmeta.B';
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
  /** 스티커 */
  sticker: 'circle' | 'star';
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
   * 여기서는 그 위에 **추가로** 곱해지는 값이다. B 만 한 번 더 5% 줄인다.
   */
  stickerTextScale: number;
  /**
   * 스티커 **도형**만의 배율(별/원). 안의 글자에는 영향을 주지 않는다.
   * 중심을 유지한 채 커지므로 배치는 그대로다.
   */
  stickerShapeScale: number;
  /**
   * 셰이드 그라데이션 불투명도 배율. **1 = Figma 그대로.**
   * 그라데이션 자체를 건드리는 값이라 A·B 모두 1 로 둔다.
   * 색 농도는 여기가 아니라 textureOpacity 로 조절할 것.
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
    shadeOpacity: 1,
    shadeRgb: '0,0,0',
    shadeBlend: 'overlay',
    shadeTint: true,
    shadeTintBlend: 'normal',
    textureOpacity: 0.9,
    textureBlend: 'overlay',
  },
  B: {
    label: 'Solid',
    desc: '단색 흰 박스 · 별 스티커 · 흰 셰이드 · 배경 블러',
    box: { fill: '#ffffff', stroke: null,
           strokeRatio: 0, shadowRatio: 6.29 / 234.748, glass: false },
    sticker: 'star',
    text: '#141414',
    discColor: '#000000',
    discShadow: '0px 0px 30px rgba(255,255,255,0.9), 0px 0px 10px rgba(255,255,255,0.7)',
    graphics: false,
    logo: '/lg-logo.svg',
    stickerTextScale: 0.95,
    stickerShapeScale: 1.05,
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
  A: { ...SPEC_A_CRITEO, ...SPEC_A_DV360, ...SPEC_A_PMAXMETA },
  B: { ...SPEC_B_CRITEO, ...SPEC_B_DV360, ...SPEC_B_PMAXMETA },
};

/** A 의 셰이드 각도 — 종전 그대로. B 는 여기 쓰지 않는다(SHADE.B 사용). */
const ANGLES_A: Record<string, number> = {
  ...SHADE_ANGLE, ...DV360_SHADE_ANGLE, ...PMAXMETA_SHADE_ANGLE.A,
};

const PRODUCTS = { ...PRODUCT, ...DV360_PRODUCT, ...PMAXMETA_PRODUCT };
const PADS = { ...DISC_PAD, ...DV360_DISC_PAD, ...PMAXMETA_DISC_PAD };
const NOWRAP: Record<DesignKind, string[]> = {
  A: [...HEAD_NOWRAP.A, ...DV360_HEAD_NOWRAP.A, ...PMAXMETA_HEAD_NOWRAP.A],
  B: [...HEAD_NOWRAP.B, ...DV360_HEAD_NOWRAP.B, ...PMAXMETA_HEAD_NOWRAP.B],
};
const CENTERED = [...HEAD_CENTER, ...DV360_HEAD_CENTER, ...PMAXMETA_HEAD_CENTER];

/**
 * 프로모션 명칭의 뒷단어를 **무조건 다음 줄**로 내리는 사이즈.
 *
 * "Back To School – Spring" 처럼 뒤에 계절이 붙는 명칭이 있는데,
 * 세로로 긴 이 사이즈는 앞말과 계절이 한 줄에 붙어 읽혀서 여기서만 끊는다.
 * 카피 폭 288px 이면 가장 긴 앞말("Back To School." 245px @36px)도 한 줄에 들어간다 —
 * Figma 에서 이 사이즈 카피를 넓혀둔 것이 그 조건을 만든다.
 */
const PROMO_BREAK = ['dv360-300x1050'];

/** 앱의 mediaSizes 이름("1200x628") → Figma 프레임 키("criteo-1200x628") */
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

/**
 * B 셰이드가 흰색에서 **얼마나 빨리 빠지는지**.
 *
 * 1 이면 좌우 대칭이라 램프 앞쪽(카피가 놓이는 구간)이 오래 흰색으로 남아 진해 보인다.
 * 1 보다 키우면 앞쪽이 먼저 옅어지고 꼬리가 길어져 자연스럽게 풀린다.
 * 끝점(Figma 실측 위치)과 시작 알파 1 은 그대로다.
 *   1.0 → 중앙 0.50   1.6 → 중앙 0.33   2.0 → 중앙 0.25
 */
const SHADE_FALLOFF = 1.6;

/**
 * B 셰이드 램프 **시작을 앞으로 당기는 정도** (램프 길이 대비 비율).
 *
 * Figma 의 첫 스톱(예: 1200x628 은 31.4%) 앞쪽은 알파가 1 인 순백 구간이라
 * falloff 로는 절대 옅어지지 않는다. 시작을 당기면 그 구간부터 빠지기 시작해
 * 카피 옆이 자연스럽게 풀린다. 끝점은 그대로 둔다.
 *   0 = Figma 그대로,  0.35 → 31.4% 가 18.1% 로 당겨짐
 * ⚠ 너무 키우면 카피가 놓이는 왼쪽까지 배경이 비쳐 검정 글자 대비가 떨어진다.
 */
const SHADE_START_PULL = 0.35;

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
    const s = SHADE.B[key];
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
      const [rawP0, a0] = stops[i];
      const [p1, a1] = stops[i + 1];
      // 첫 구간만 시작을 앞으로 당긴다 (끝점·마지막 구간은 그대로)
      const p0 = i === 0 ? rawP0 - (p1 - rawP0) * SHADE_START_PULL : rawP0;
      for (let k = 0; k < SHADE_EASE_STEPS; k++) {
        const t = k / SHADE_EASE_STEPS;
        const e = t * t * (3 - 2 * t);                 // smoothstep
        const pos = p0 + (p1 - p0) * t;
        // 알파를 falloff 로 눌러 앞쪽이 먼저 옅어지게 한다 (1-e 가 남은 알파 비율)
        const a = a1 + (a0 - a1) * Math.pow(1 - e, SHADE_FALLOFF);
        parts.push(`rgba(${rgb},${Math.min(1, a * boost).toFixed(3)}) ${pos.toFixed(2)}%`);
      }
    }
    const [lp, la] = stops[stops.length - 1];
    parts.push(`rgba(${rgb},${Math.min(1, la * boost).toFixed(3)}) ${lp}%`);
    return `linear-gradient(${deg}deg, ${parts.join(', ')})`;
  }
  if (!gr) return 'none';
  const [, stops] = gr;
  const angle = ANGLES_A[key] ?? 0;
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
  return PRODUCTS[key]?.[boxKey] ?? [];
}

/** 이 사이즈의 헤드라인이 줄바꿈하지 않는가 (Figma WIDTH_AND_HEIGHT) */
export function headNoWrap(design: DesignKind, key: string) {
  return NOWRAP[design].includes(key);
}
/** 이 사이즈는 프로모션 명칭의 뒷단어를 다음 줄로 내리는가 */
export function promoBreak(key: string) {
  return PROMO_BREAK.includes(key);
}
/** 헤드라인 자체의 정렬 (블록 정렬과 다를 수 있다) */
export function headAlign(key: string): 'left' | 'center' {
  return CENTERED.includes(key) ? 'center' : 'left';
}

/** 고지문 프레임 안쪽 패딩 [좌, 우, 아래] */
export function discPad(key: string): [number, number, number] {
  return PADS[key] ?? [0, 0, 0];
}

/**
 * 헤드라인 본문을 Figma 의 줄 구성대로 쪼갠다.
 * 줄바꿈이 지정되지 않은 사이즈는 한 줄 그대로 반환한다.
 */
export function headLines(design: DesignKind, key: string, text: string): string[] {
  const at = HEAD_BREAK[design][key];
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
