import { useEffect, useState } from 'react';

/**
 * 한 줄로 유지해야 하는 글줄을, 넘치는 만큼만 줄이는 배율.
 *
 * Figma 는 글자에 맞춰 상자가 늘어나지만 웹은 상자 폭이 고정이라 같은 문구도 접힌다.
 * 접으면 안 되는 자리에서는 접는 대신 줄인다.
 *
 * 실제 폰트를 캔버스로 재기 때문에 문구가 바뀌어도(프로모션을 다시 고르면)
 * 사이즈별 표를 따로 만들어 둘 필요가 없다.
 */
let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, number>();

function measure(text: string, px: number, weight: number, family: string) {
  const key = `${px}|${weight}|${family}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (ctx === undefined) ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return 0;
  ctx.font = `${weight} ${px}px ${family}`;
  const w = ctx.measureText(text).width;
  cache.set(key, w);
  return w;
}

/** maxWidth 를 넘치면 넘친 비율만큼 줄인다. 넉넉하면 1(원래 크기). */
export function fitScale(text: string, px: number, weight: number, family: string, maxWidth: number) {
  if (!text || maxWidth <= 0) return 1;
  const w = measure(text, px, weight, family);
  return w > maxWidth ? maxWidth / w : 1;
}

/**
 * 웹폰트가 아직 안 붙었을 때 잰 값은 대체 폰트 기준이라 틀리다.
 * 로드가 끝나면 캐시를 비우고 한 번 더 그리게 한다.
 */
export function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => {
      if (!live) return;
      cache.clear();
      setReady(true);
    });
    return () => { live = false; };
  }, []);
  return ready;
}
