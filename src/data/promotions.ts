/**
 * Sale Category & Color System
 * ------------------------------------------------------------------
 * reference/Sales Templates_color.pdf p.3–4 "Sale Category & Color System" 기준 확정 데이터.
 * (최초 출처는 structure.pdf p.2–3. New Year는 color.pdf에서 Royal Purple/Gold → Pink/Ivory로 변경됨.)
 * 각 프로모션은 추천 한 벌(main + secondary)과 서브 한 벌(sub)을 가진다.
 * 프로모션을 고르면 추천 벌이 배너 기본 색이 되고, Edit 에서 서브로 바꿀 수 있다.
 * Back To School 은 Spring/Autumn 두 개였는데 하나로 합치고, Spring=추천 / Autumn=서브 로 넣었다.
 */

export interface PromoColor {
  /** 컬러 표시 이름 (e.g. "Red Brown") */
  name: string;
  /** HEX 값 (#RRGGBB) */
  hex: string;
}

/** 배너에 쓰이는 한 벌 — 메인 + 조합 */
export interface PromoPair {
  main: PromoColor;
  secondary: PromoColor;
}

export interface Promotion {
  /** 내부 식별자 (kebab-case) */
  id: string;
  /** 화면 표시 명칭 */
  label: string;
  /** Main 컬러 (추천값) */
  main: PromoColor;
  /** 조합 컬러 (추천값) */
  secondary: PromoColor;
  /**
   * 서브 컬러 한 벌.
   *
   * Edit 에서 Hue 를 자유롭게 돌리는 대신 **추천/서브 두 벌 중에서만** 고르게 한다.
   * 아무 색이나 나오면 브랜드 톤이 흐트러지고, 나라별 법인이 제각각 쓰게 된다.
   * ⚠ 지금 값은 각 프로모션의 분위기에 맞춰 임의로 정한 것이다 — 확정본이 나오면 교체할 것.
   * (예외: Back To School 서브는 기존 Autumn 확정 컬러라 그대로 두면 된다.)
   */
  sub: PromoPair;
}

/** 고른 벌 — 'recommended' 는 위의 main/secondary, 'sub' 는 sub */
export type ColorSet = 'recommended' | 'sub';

/** 이 프로모션의 고른 벌 색 (없으면 추천값) */
export function promoPair(p: Promotion, set: ColorSet): PromoPair {
  return set === 'sub' ? p.sub : { main: p.main, secondary: p.secondary };
}

export const PROMOTIONS: Promotion[] = [
  { id: 'valentines-day', label: "Valentine's Day",
    main: { name: 'Red Brown', hex: '#9f5a52' },      secondary: { name: 'Pink Ivory', hex: '#e8d8d0' },
    sub: { main: { name: 'Deep Rose', hex: '#8c3f4a' }, secondary: { name: 'Blush', hex: '#f2dfe0' } } },
  { id: 'spring-sale', label: 'Spring Sale',
    main: { name: 'Green', hex: '#7da64c' },          secondary: { name: 'Yellow', hex: '#f0d05a' },
    sub: { main: { name: 'Fresh Mint', hex: '#6fbf9a' }, secondary: { name: 'Cream', hex: '#f7f0d8' } } },
  { id: 'summer-sale', label: 'Summer Sale',
    main: { name: 'Aqua Blue', hex: '#3f9fb8' },      secondary: { name: 'Warm White', hex: '#faf7f2' },
    sub: { main: { name: 'Deep Ocean', hex: '#1f6f8c' }, secondary: { name: 'Sand', hex: '#f2e6cf' } } },
  // 추천 = 기존 Spring 컬러, 서브 = 기존 Autumn 컬러 (임의값이 아니라 확정 데이터다)
  { id: 'back-to-school', label: 'Back To School',
    main: { name: 'Sage Green', hex: '#a5b88c' },     secondary: { name: 'Yellow', hex: '#f0d05a' },
    sub: { main: { name: 'Brown', hex: '#9a6238' },     secondary: { name: 'Warm Beige', hex: '#d8c3a5' } } },
  { id: 'womens-day', label: "Women's Day",
    main: { name: 'Pink Beige', hex: '#d8b8b1' },     secondary: { name: 'Warm Rose', hex: '#b36a67' },
    sub: { main: { name: 'Mauve', hex: '#a8748a' },     secondary: { name: 'Soft Ivory', hex: '#f2e6e6' } } },
  { id: 'easter-sale', label: 'Easter Sale',
    main: { name: 'Lavender', hex: '#aea3cc' },       secondary: { name: 'Cream Yellow', hex: '#f5e7ad' },
    sub: { main: { name: 'Periwinkle', hex: '#8f8fd0' }, secondary: { name: 'Mint', hex: '#cfe8d8' } } },
  { id: 'mothers-day', label: "Mother's Day",
    main: { name: 'Dusty Rose', hex: '#a87a82' },     secondary: { name: 'Ivory', hex: '#eee4d2' },
    sub: { main: { name: 'Rosewood', hex: '#8a5560' },  secondary: { name: 'Peach', hex: '#f5ded0' } } },
  { id: 'fathers-day', label: "Father's Day",
    main: { name: 'Slate Blue', hex: '#6b7b8c' },     secondary: { name: 'Ivory', hex: '#eee4d2' },
    sub: { main: { name: 'Navy', hex: '#3f4d5f' },      secondary: { name: 'Stone', hex: '#d8d3c8' } } },
  { id: 'cyber-monday', label: 'Cyber Monday',
    main: { name: 'Silver', hex: '#b8bcc2' },         secondary: { name: 'Carbon Black', hex: '#262626' },
    sub: { main: { name: 'Electric Blue', hex: '#2f4de0' }, secondary: { name: 'Graphite', hex: '#3a3a3a' } } },
  { id: 'bundle-sale', label: 'Bundle Sale',
    main: { name: 'Deep Plum', hex: '#5f4a72' },      secondary: { name: 'Warm White', hex: '#faf7f2' },
    sub: { main: { name: 'Indigo', hex: '#464b8c' },    secondary: { name: 'Lilac', hex: '#ded5ea' } } },
  { id: 'anniversary', label: 'Anniversary',
    main: { name: 'LG Red', hex: '#a50034' },         secondary: { name: 'Warm Gray 06', hex: '#f0ece4' },
    sub: { main: { name: 'Wine', hex: '#6e0a2a' },      secondary: { name: 'Champagne', hex: '#e8d8b8' } } },
  { id: 'autumn-sale', label: 'Autumn Sale',
    main: { name: 'Burgundy', hex: '#7b2846' },       secondary: { name: 'Warm Beige', hex: '#d8c3a5' },
    sub: { main: { name: 'Rust', hex: '#a8542a' },      secondary: { name: 'Golden Wheat', hex: '#e2c98a' } } },
  { id: 'rainy-season', label: 'Rainy Season',
    main: { name: 'Mist Blue', hex: '#6f90a8' },      secondary: { name: 'Cloud Gray', hex: '#c9d0d4' },
    sub: { main: { name: 'Storm Navy', hex: '#44607a' }, secondary: { name: 'Pale Sky', hex: '#dde6ea' } } },
  { id: 'winter-sale', label: 'Winter Sale',
    main: { name: 'ICE Blue', hex: '#afc8d8' },       secondary: { name: 'Warm White', hex: '#faf7f2' },
    sub: { main: { name: 'Frost Navy', hex: '#4a6d8c' }, secondary: { name: 'Snow', hex: '#eef4f8' } } },
  { id: 'halloween-sale', label: 'Halloween Sale',
    main: { name: 'Charcoal Black', hex: '#262626' }, secondary: { name: 'Pumpkin Orange', hex: '#c97a24' },
    sub: { main: { name: 'Deep Purple', hex: '#4a2a5f' }, secondary: { name: 'Amber', hex: '#e0952f' } } },
  { id: 'christmas', label: 'Christmas',
    main: { name: 'Red', hex: '#b22234' },            secondary: { name: 'Green', hex: '#2e7d32' },
    sub: { main: { name: 'Pine', hex: '#1f5c3a' },      secondary: { name: 'Gold', hex: '#d4a84b' } } },
  { id: 'new-year', label: 'New Year',
    main: { name: 'Pink', hex: '#d8a6a3' },           secondary: { name: 'Ivory', hex: '#eee4d2' },
    sub: { main: { name: 'Royal Purple', hex: '#5b3a7a' }, secondary: { name: 'Gold', hex: '#d4a84b' } } },
];

export function getPromotion(id: string): Promotion | undefined {
  return PROMOTIONS.find((p) => p.id === id);
}
