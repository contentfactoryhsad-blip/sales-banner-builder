/**
 * Figma "Banner Template" 실측 스펙 (원시 데이터).
 *
 * 추출: Figma Plugin API 로 Sales Template (A)/(B) 의 사이즈 프레임을 일괄 스캔.
 * 좌표·크기는 전부 **프레임 네이티브 px**. 렌더러가 transform: scale() 로 축소한다.
 *
 * 배열 인코딩 (용량 때문에 튜플로 저장):
 *   f     [w, h]                                  프레임 크기
 *   bg    [x, y, w, h, blur]                      배경 이미지 배치 + 레이어 블러(0=없음)
 *   gr    [rotation, [[pos, alpha, luma], ...]]   셰이드 그라데이션 (luma 0=검정 1=흰색)
 *   gx    [[x, y, w, h], ...]                     장식 도형 (mix-blend-overlay)
 *   st    [x, y, size]                            스티커 (정사각)
 *   in.logo [x, y, w, h]                          프레임 기준
 *   in.copy [x, y, w, h, gap, align]              프레임 기준. align: MIN=좌 CENTER=중앙
 *   in.head [x, y, w, h, fontSize, letterSpacing] copy 블록 기준
 *   in.sub  [x, y, w, h, fontSize] | null         copy 블록 기준. null=이 사이즈엔 서브카피 없음
 *   in.cta  [x, y, w, h, radius, fontSize]        copy 블록 기준
 *   in.disc [x, y, w, h, fontSize]                프레임 기준
 *   box["3"|"4"|"5"|"6"] [ox, oy, [[x,y,w,h,r], ...]]
 *         박스 컨테이너 원점 + 박스별 사각형(컨테이너 기준).
 *         ⚠ 균일 그리드가 아니다 — 5개 버전은 3+2 가운데정렬, 일부는 마지막 칸이 가로로 합쳐진다.
 *         그래서 cols/rows/gap 이 아니라 사각형을 그대로 들고 있는다.
 */

export type Rect4 = [number, number, number, number];
export type Box5 = [number, number, number, number, number];

export interface FigmaInner {
  logo: Rect4 | null;
  copy: [number, number, number, number, number, string] | null;
  head: [number, number, number, number, number, number] | null;
  sub: [number, number, number, number, number] | null;
  cta: [number, number, number, number, number, number] | null;
  disc: [number, number, number, number, number] | null;
}

export interface FigmaFrameSpec {
  f: [number, number];
  bg: [number, number, number, number, number] | null;
  gr: [number, Array<[number, number, number]>] | null;
  gx: Rect4[];
  st: [number, number, number] | null;
  in: FigmaInner;
  box: Record<string, [number, number, Box5[]]>;
}

/** 디자인 타입 → 채널-사이즈 → 스펙 */
export type FigmaSpecMap = Record<'A' | 'B', Record<string, FigmaFrameSpec>>;
