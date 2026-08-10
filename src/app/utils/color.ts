/** HEX ↔ HSL 변환 + Hue 조정 유틸 */

export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export function hexToHsl(hex: string): HSL {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

export function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = lN - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + mm) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * 프로모션 main/secondary 색에서 **Hue만** 조정한 결과를 반환.
 *
 * 두 색을 **각각 독립적으로** 회전한다(예전엔 hue 하나로 둘을 묶어 돌렸다).
 * 각 색의 S/L은 그대로 유지되므로 톤은 프로모션 원본을 따른다.
 * hue가 null이면 그 색은 원래 값 그대로 — 슬라이더로 눈대중하면 반올림 오차가 생기므로
 * "원래 색"은 반드시 null로 표현한다.
 */
export function deriveBannerColors(
  mainHex: string,
  secondaryHex: string,
  mainHue: number | null,
  secondaryHue: number | null,
): { main: string; secondary: string } {
  const m = hexToHsl(mainHex);
  const s = hexToHsl(secondaryHex);
  return {
    main: mainHue === null ? mainHex : hslToHex(mainHue, m.s, m.l),
    secondary: secondaryHue === null ? secondaryHex : hslToHex(secondaryHue, s.s, s.l),
  };
}

/**
 * 프로모션 미선택 시의 폴백 색.
 * 이 상태에서는 배경에 색을 입히지 않고 흑백 텍스처를 그대로 그리므로
 * (Figma 도 그렇다) 이 값은 gradient 모드 폴백 등 제한적으로만 쓰인다.
 */
export const NEUTRAL_BANNER_COLORS = { main: '#dedbd5', secondary: '#f4f1ec' };
