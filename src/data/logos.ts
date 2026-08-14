/**
 * 사이즈별로 바꿔 끼울 수 있는 LG 로고.
 *
 * 같은 1200×628 디자인을 41개 사이즈로 펼치면, 사이즈마다 로고 자리에 오는 배경
 * 밝기가 제각각이라 시안 기본 로고가 묻히는 사이즈가 생긴다. 어느 사이즈가 묻히는지는
 * 규칙으로 정하기 어렵고 사람이 보면 바로 아는 문제라, AD Media 확인창에서 사이즈를
 * 골라 로고만 갈아 끼우게 한다.
 *
 * 벡터(SVG)를 쓴다. reference/logos 의 원본 PNG 는 7154×3156 이라 배너 크기로 줄이면
 * 원이 뭉개지고 용량만 크다. `lg-logo-white.svg` 는 Figma 아트를 흰색으로 다시 그린
 * 것이다 — 컬러 SVG 에 filter 를 걸어 하얗게 만들면 원 안쪽이 뭉개진다.
 * `lg-logo-black.svg` 도 같은 이유로 흰색본의 fill 만 검정으로 바꿔 만들었다
 * (컬러본에 filter 를 걸면 원과 얼굴 선이 뭉개진다).
 */
export interface LogoVariant {
  id: string;
  label: string;
  src: string;
}

export const LOGO_VARIANTS: LogoVariant[] = [
  { id: 'color', label: 'Color', src: '/lg-logo.svg' },
  { id: 'white', label: 'White', src: '/lg-logo-white.svg' },
  { id: 'black', label: 'Black', src: '/lg-logo-black.svg' },
];

/** 고른 로고의 경로. 안 골랐거나 없는 값이면 시안 기본 로고를 그대로 쓴다. */
export function logoSrc(id: string | undefined, fallback: string) {
  return LOGO_VARIANTS.find((v) => v.id === id)?.src ?? fallback;
}
