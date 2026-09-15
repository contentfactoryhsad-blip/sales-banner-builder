/**
 * LG.com 배너의 혜택 아이콘 — Figma "Icon Row" 컴포넌트(Templates & Assets ›
 * LG.com Banner templates › Components, 128:29589)에서 추출한 36종.
 *
 * 파일: public/icons/lgcom/{solid|line}/{id}.svg — **검정 판**만 저장한다.
 *   · solid: 검정 알약판(불투명 80%) + 흰 글리프
 *   · line : 투명판 + 검정 라인
 * 흰색은 CSS `filter: invert(1)` 로 만든다 — 원본이 순수 흑백이라 뒤집으면
 * Figma 의 white 변형과 정확히 같다 (solid → 흰 판 + 검정 글리프).
 *
 * 이 아이콘 줄은 LG.com ST0001 두 사이즈(1920x720·720x960)에만 그려진다.
 */

export type LgcomIconStyle = 'solid' | 'line';
export type LgcomIconColor = 'black' | 'white';

export interface LgcomIconOption { id: string; label: string }

/** 드롭다운 선택지 — Figma 컴포넌트의 아이콘 이름 그대로 (오타는 바로잡음) */
export const LGCOM_ICON_OPTIONS: LgcomIconOption[] = [
  { id: 'membership', label: 'Membership' },
  { id: 'vip', label: 'VIP' },
  { id: 'loyalty', label: 'Loyalty' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'event', label: 'Event' },
  { id: 'vip-event', label: 'VIP Event' },
  { id: 'membership-event', label: 'Membership Event' },
  { id: 'coupon', label: 'Coupon' },
  { id: 'welcome-coupon', label: 'Welcome Coupon' },
  { id: 'membership-coupon', label: 'Membership Coupon' },
  { id: 'vip-coupon', label: 'VIP Coupon' },
  { id: 'newsletter-coupon', label: 'Newsletter Coupon' },
  { id: 'percentage', label: 'Percentage' },
  { id: 'discount', label: 'Discount' },
  { id: 'pre-order', label: 'Pre-order' },
  { id: 'obs-only', label: 'OBS Only' },
  { id: 'finance', label: 'Finance' },
  { id: 'zero-interest-payment', label: 'Zero-Interest Payment' },
  { id: 'point', label: 'Point' },
  { id: 'mileage', label: 'Mileage' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'free-delivery', label: 'Free Delivery' },
  { id: 'scheduled-delivery', label: 'Scheduled Delivery' },
  { id: 'next-day-delivery', label: 'Next-Day Delivery' },
  { id: 'fast-delivery', label: 'Fast Delivery' },
  { id: 'return', label: 'Return' },
  { id: 'free-return', label: 'Free Return' },
  { id: 'trade-in-program', label: 'Trade-In Program' },
  { id: '1-1-care', label: '1:1 Care' },
  { id: 'installation', label: 'Installation' },
  { id: 'free-installation', label: 'Free Installation' },
  { id: 'vip-installation', label: 'VIP Installation' },
  { id: 'disposal', label: 'Disposal' },
  { id: 'free-disposal', label: 'Free Disposal' },
  { id: 'warranty', label: 'Warranty' },
  { id: '2-year-warranty', label: '2-Year Warranty' },
];

export function lgcomIconSrc(style: LgcomIconStyle, id: string): string {
  return `/icons/lgcom/${style}/${id}.svg`;
}

/** 흰색 선택 시 이미지에 얹는 CSS 필터 (원본은 검정 판) */
export function lgcomIconFilter(color: LgcomIconColor): string | undefined {
  return color === 'white' ? 'invert(1)' : undefined;
}
