/**
 * Sale Category & Color System
 * ------------------------------------------------------------------
 * reference/Sales Templates_color.pdf p.3–4 "Sale Category & Color System" 기준 확정 데이터.
 * (최초 출처는 structure.pdf p.2–3. New Year는 color.pdf에서 Royal Purple/Gold → Pink/Ivory로 변경됨.)
 * 각 프로모션은 Main 컬러 1개 + 조합(Secondary) 컬러 1개를 가진다.
 * 프로모션을 선택하면 이 컬러값이 배너 기본 색으로 세팅된다.
 */

export interface PromoColor {
  /** 컬러 표시 이름 (e.g. "Red Brown") */
  name: string;
  /** HEX 값 (#RRGGBB) */
  hex: string;
}

export interface Promotion {
  /** 내부 식별자 (kebab-case) */
  id: string;
  /** 화면 표시 명칭 */
  label: string;
  /** Main 컬러 */
  main: PromoColor;
  /** 조합 컬러 */
  secondary: PromoColor;
}

export const PROMOTIONS: Promotion[] = [
  { id: 'valentines-day',       label: "Valentine's Day",        main: { name: 'Red Brown',      hex: '#9f5a52' }, secondary: { name: 'Pink Ivory',     hex: '#e8d8d0' } },
  { id: 'spring-sale',          label: 'Spring Sale',            main: { name: 'Green',          hex: '#7da64c' }, secondary: { name: 'Yellow',         hex: '#f0d05a' } },
  { id: 'summer-sale',          label: 'Summer Sale',            main: { name: 'Aqua Blue',      hex: '#3f9fb8' }, secondary: { name: 'Warm White',     hex: '#faf7f2' } },
  { id: 'back-to-school-spring', label: 'Back To School – Spring', main: { name: 'Sage Green',   hex: '#a5b88c' }, secondary: { name: 'Yellow',         hex: '#f0d05a' } },
  { id: 'womens-day',           label: "Women's Day",            main: { name: 'Pink Beige',     hex: '#d8b8b1' }, secondary: { name: 'Warm Rose',      hex: '#b36a67' } },
  { id: 'easter-sale',          label: 'Easter Sale',            main: { name: 'Lavender',       hex: '#aea3cc' }, secondary: { name: 'Cream Yellow',   hex: '#f5e7ad' } },
  { id: 'mothers-day',          label: "Mother's Day",           main: { name: 'Dusty Rose',     hex: '#a87a82' }, secondary: { name: 'Ivory',          hex: '#eee4d2' } },
  { id: 'fathers-day',          label: "Father's Day",           main: { name: 'Slate Blue',     hex: '#6b7b8c' }, secondary: { name: 'Ivory',          hex: '#eee4d2' } },
  { id: 'cyber-monday',         label: 'Cyber Monday',           main: { name: 'Silver',         hex: '#b8bcc2' }, secondary: { name: 'Carbon Black',   hex: '#262626' } },
  { id: 'bundle-sale',          label: 'Bundle Sale',            main: { name: 'Deep Plum',      hex: '#5f4a72' }, secondary: { name: 'Warm White',     hex: '#faf7f2' } },
  { id: 'anniversary',          label: 'Anniversary',            main: { name: 'LG Red',         hex: '#a50034' }, secondary: { name: 'Warm Gray 06',   hex: '#f0ece4' } },
  { id: 'autumn-sale',          label: 'Autumn Sale',            main: { name: 'Burgundy',       hex: '#7b2846' }, secondary: { name: 'Warm Beige',     hex: '#d8c3a5' } },
  { id: 'rainy-season',         label: 'Rainy Season',           main: { name: 'Mist Blue',      hex: '#6f90a8' }, secondary: { name: 'Cloud Gray',     hex: '#c9d0d4' } },
  { id: 'winter-sale',          label: 'Winter Sale',            main: { name: 'ICE Blue',       hex: '#afc8d8' }, secondary: { name: 'Warm White',     hex: '#faf7f2' } },
  { id: 'back-to-school-autumn', label: 'Back To School – Autumn', main: { name: 'Brown',        hex: '#9a6238' }, secondary: { name: 'Warm Beige',     hex: '#d8c3a5' } },
  { id: 'halloween-sale',       label: 'Halloween Sale',         main: { name: 'Charcoal Black', hex: '#262626' }, secondary: { name: 'Pumpkin Orange', hex: '#c97a24' } },
  { id: 'christmas',            label: 'Christmas',              main: { name: 'Red',            hex: '#b22234' }, secondary: { name: 'Green',          hex: '#2e7d32' } },
  { id: 'new-year',             label: 'New Year',               main: { name: 'Pink',           hex: '#d8a6a3' }, secondary: { name: 'Ivory',          hex: '#eee4d2' } },
];

export function getPromotion(id: string): Promotion | undefined {
  return PROMOTIONS.find((p) => p.id === id);
}
