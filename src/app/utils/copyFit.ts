import { getSpec } from '../../data/figmaStyle';
import { HEADLINE_FONT, HEADLINE_WEIGHT } from '../../data/sizeLayouts';
import { measure } from './textFit';
import type { DesignType } from '../types';

/**
 * 좌패널 카피(프로모션 명칭 + 헤드카피)가 넘치지 않게 가두는 기준.
 *
 * **글자수가 아니라 폭으로 막는다.** 글자마다 폭이 달라서 글자수로는 넘침을 못 막는다
 * — "WWWWW" 는 "iiiii" 보다 세 배 넘게 넓다. 상한을 25자로 걸어도 넓은 글자만
 * 쓰면 상자를 넘어간다. 그래서 실제 폰트로 재서 판단한다.
 *
 * 기준선은 **1200×628 에서 기본 헤드카피가 끝나는 지점**이다. Figma 헤드 상자
 * 폭(in.head[2])이 아니라 글줄 폭을 쓴다 — 상자는 글자보다 여유가 있어서, 상자를
 * 기준으로 잡으면 확정 시안보다 길어져도 통과해 버린다.
 *
 * 나머지 40개 사이즈는 이미 사이즈별로 접거나(headLines) 줄여서(fitScale) 담고
 * 있으므로, 대표 사이즈 하나만 지키면 된다.
 */
export const COPY_REF_TEXT = 'Save on LG favorites';

export interface CopyBudget {
  /** 1200×628 헤드카피 글자 크기 */
  px: number;
  /** 기준 폭 — 이 폭을 넘는 글줄은 받지 않는다 */
  maxWidth: number;
}

/**
 * 이 시안의 기준 폭. 폰트가 아직 안 붙었으면 대체 폰트로 잰 값이라 틀리므로,
 * 부르는 쪽에서 useFontsReady() 로 한 번 더 그리게 한다(textFit 이 캐시를 비운다).
 */
export function copyBudget(design: DesignType): CopyBudget | null {
  const head = getSpec(design, 'criteo', '1200x628')?.in.head;
  if (!head) return null;
  const px = head[4];
  return { px, maxWidth: measure(COPY_REF_TEXT, px, HEADLINE_WEIGHT, HEADLINE_FONT) };
}

/** 이 글줄이 기준 폭의 몇 %를 쓰는가 (100 초과 = 넘침) */
export function copyFillPct(text: string, b: CopyBudget | null): number {
  if (!b || !b.maxWidth) return 0;
  return Math.round((measure(text, b.px, HEADLINE_WEIGHT, HEADLINE_FONT) / b.maxWidth) * 100);
}

/**
 * 받아도 되는 글줄인가. 소수점 반올림 오차로 딱 맞는 기본 문구가 거부되지 않게
 * 0.5px 여유를 둔다.
 */
export function copyFits(text: string, b: CopyBudget | null): boolean {
  if (!b || !b.maxWidth) return true;
  return measure(text, b.px, HEADLINE_WEIGHT, HEADLINE_FONT) <= b.maxWidth + 0.5;
}

/**
 * 기준 폭을 넘치는 낱말을 **아랫줄로 내려보낸다.** 쭉 이어 쓰면 저절로 다음 줄로
 * 넘어가라는 것 — 폭이 차는 순간 입력이 막히면 쓰다 만 것처럼 보인다.
 *
 * 위로는 절대 끌어올리지 않는다. 줄바꿈은 "여기까지가 프로모션 명칭"이라는 사용자의
 * 지시라서, 앞줄에 자리가 났다고 뒷줄을 당겨 올리면 그 구분이 멋대로 무너진다.
 *
 * 담을 수 없으면 null — 줄 수가 모자라거나, 낱말 하나가 통째로 한 줄보다 넓은 경우다.
 */
export function reflowCopy(text: string, b: CopyBudget | null, maxLines: number): string | null {
  if (!b || !b.maxWidth) return text;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    while (!copyFits(lines[i], b)) {
      const trimmed = lines[i].trimEnd();
      const at = trimmed.lastIndexOf(' ');
      if (at <= 0) return null;              // 낱말 하나가 한 줄을 넘는다 — 쪼갤 데가 없다
      if (i + 1 >= maxLines) return null;    // 내려보낼 줄이 더 없다
      lines[i] = trimmed.slice(0, at);
      const move = trimmed.slice(at + 1);
      lines[i + 1] = lines[i + 1] ? `${move} ${lines[i + 1]}` : move;
    }
  }
  return lines.length > maxLines ? null : lines.join('\n');
}
