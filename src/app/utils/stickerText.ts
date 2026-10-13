import { STICKER_FONT, STICKER_FREE_LAYOUT } from '../../data/sizeLayouts';
import { measure } from './textFit';

/** B형 스티커 최대 줄 수 */
export const STICKER_TEXT_MAX_LINES = 3;

/**
 * B형 스티커 문구를 줄로 나눈다 — 글자 크기는 고정(피그마 40), 폭 171 에서 접는다.
 *
 *  · 입력의 엔터(\n)는 그대로 줄바꿈.
 *  · 한 줄이 폭을 넘으면 단어 경계에서 접고, 띄어쓰기 없이 긴 단어는 글자 단위로 끊는다.
 *  · 줄 수는 자르지 않고 그대로 돌려준다 — 3줄 제한은 입력창이 막는다(wrapStickerText 길이로 판정).
 * 좌표계는 222px 원 기준(STICKER_FREE_LAYOUT)이라 사이즈와 무관하게 같은 결과가 나온다.
 */
export function wrapStickerText(text: string): string[] {
  const F = STICKER_FREE_LAYOUT;
  const w = (t: string) => measure(t, F.size, 400, STICKER_FONT) + t.length * F.tracking;
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) { out.push(''); continue; }
    let line = '';
    for (let word of words) {
      const cand = line ? `${line} ${word}` : word;
      if (w(cand) <= F.maxW) { line = cand; continue; }
      if (line) { out.push(line); line = ''; }
      // 단어 하나가 폭보다 길면 글자 단위로 끊는다
      while (w(word) > F.maxW) {
        let n = word.length - 1;
        while (n > 1 && w(word.slice(0, n)) > F.maxW) n--;
        out.push(word.slice(0, n));
        word = word.slice(n);
      }
      line = word;
    }
    out.push(line);
  }
  // 앞뒤 빈 줄은 버린다 (가운데 빈 줄은 사용자가 띄운 것이라 둔다)
  while (out.length && !out[0]) out.shift();
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}
