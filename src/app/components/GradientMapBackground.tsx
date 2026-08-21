import { useEffect, useState } from 'react';
import { hexToRgb } from '../utils/color';

/**
 * 그라데이션 맵(Gradient Map) — 포토샵 "그레이디언트 맵" 조정 레이어와 동일 원리.
 * 흑백 텍스처의 밝기값(0~255)을 256칸 LUT로 색에 대응:
 *   어두움 → 그림자(메인 어둡게), 중간 → 메인 색, 밝음 → 조합 색 → 하이라이트.
 * 무늬(모양·명암)는 원본 텍스처 그대로 유지하고 색만 매핑한다.
 *
 * ⚠ 결과는 **한 번만 굽고 모든 사이즈가 공유한다.**
 *
 * 예전에는 이 컴포넌트가 사이즈마다 캔버스를 하나씩 들고 직접 그렸다. 그런데 AD Media 는
 * 배너를 41장 동시에 띄우므로 캔버스가 41개 생기고, 각각 480×492 를 읽어들이는
 * ~945KB 버퍼를 잡는다. Edit 에서 Gradient map ↔ Overlay 를 반복해 누르면 그 41개가
 * 매번 통째로 버려지고 새로 만들어져, GC 가 따라오기 전에 메모리가 쌓였다.
 *
 * 그 상태에서 getImageData 가 던지면 **onload 안이라 예외가 조용히 삼켜지고**,
 * 캔버스에는 바로 앞 drawImage 가 그려 둔 **흑백 텍스처가 그대로 남았다** — 색을
 * "그린 다음 덧칠"하는 구조라 덧칠만 빠지면 흑백이 된다. 그래서 일부 사이즈만
 * 회색으로 굳어 보였다(Edit 은 캔버스가 하나뿐이라 멀쩡했다).
 *
 * 매핑 결과는 (텍스처, 메인색, 조합색) 에만 달려 있고 **배너 사이즈와 무관**하다.
 * 그래서 캔버스 한 장으로 굽고, 사이즈들은 그 결과를 <img> 로 받아 쓴다.
 * 캔버스가 1개로 줄어 메모리 압박 자체가 사라지고, 혹시 실패하더라도 흑백이 남는 게
 * 아니라 아무것도 안 그려진다(= 흑백으로 굳는 증상이 구조적으로 불가능해진다).
 */

/** 굽는 크기 — KV 비율(≈612×628)에 cover 로 맞춘다. 사이즈별로 늘려 쓴다. */
const CW = 480;
const CH = 492;

/** 하이라이트 흰색 정도 (0=조합색 유지, 1=순백). 낮출수록 흰색 덜함 */
const HL = 0.5;

/**
 * 구워 둔 결과 캐시. 키는 "텍스처|메인|조합".
 *
 * Hue 를 돌리면 색 조합이 계속 새로 생기므로 상한을 둔다. 넘치면 가장 오래된 것부터
 * 버린다(Map 은 넣은 순서를 지킨다).
 */
const CACHE_MAX = 12;
const cache = new Map<string, Promise<string>>();

/** 텍스처 한 장을 LUT 로 매핑해 data URL 로 굽는다. 실패하면 던진다. */
function bake(img: HTMLImageElement, main: string, secondary: string): string {
  const [mr, mg, mb] = hexToRgb(main);
  const [sr, sg, sb] = hexToRgb(secondary);
  const stops: { t: number; c: [number, number, number] }[] = [
    { t: 0.0, c: [mr * 0.32, mg * 0.32, mb * 0.32] },                       // 그림자
    { t: 0.5, c: [mr, mg, mb] },                                            // 메인 (중간을 더 넓게)
    { t: 0.85, c: [sr, sg, sb] },                                           // 조합 (위로 올려 흰 구간 축소)
    { t: 1.0, c: [sr + (255 - sr) * HL, sg + (255 - sg) * HL, sb + (255 - sb) * HL] }, // 하이라이트
  ];
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s].t && t <= stops[s + 1].t) { a = stops[s]; b = stops[s + 1]; break; }
    }
    const seg = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    lut[i * 3] = a.c[0] + (b.c[0] - a.c[0]) * seg;
    lut[i * 3 + 1] = a.c[1] + (b.c[1] - a.c[1]) * seg;
    lut[i * 3 + 2] = a.c[2] + (b.c[2] - a.c[2]) * seg;
  }

  const cv = document.createElement('canvas');
  cv.width = CW;
  cv.height = CH;
  // 한 번만 읽으므로 willReadFrequently 는 걸지 않는다 (걸면 소프트웨어 렌더로 내려간다)
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const destA = CW / CH;
  const srcA = iw / ih;
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (srcA > destA) { sw = ih * destA; sx = (iw - sw) / 2; } else { sh = iw / destA; sy = (ih - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CW, CH);

  const data = ctx.getImageData(0, 0, CW, CH);
  const d = data.data;
  const N = CW * CH;

  // 1차: 픽셀 luma + 평균 (텍스처별 밝기 자동 보정용)
  const luma = new Uint8Array(N);
  let sum = 0;
  for (let p = 0, i = 0; p < N; p++, i += 4) {
    const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    luma[p] = l;
    sum += l;
  }
  // 평균 밝기를 LUT 중앙(0.5=메인색)으로 보내는 감마. bg-05처럼 밝은 텍스처는 자동으로 눌림 → 흰색 날림 방지
  const mean = Math.min(0.92, Math.max(0.08, sum / N / 255));
  const gamma = Math.log(0.5) / Math.log(mean);

  // 2차: 감마 적용 후 LUT 매핑
  for (let p = 0, i = 0; p < N; p++, i += 4) {
    const t = Math.pow(luma[p] / 255, gamma);
    const li = (Math.min(255, Math.max(0, Math.round(t * 255)))) * 3;
    d[i] = lut[li];
    d[i + 1] = lut[li + 1];
    d[i + 2] = lut[li + 2];
  }
  ctx.putImageData(data, 0, 0);
  return cv.toDataURL('image/png');
}

/** 이 조합의 매핑 결과 URL. 같은 조합이면 한 번만 굽고 모두가 나눠 쓴다. */
function mappedUrl(texture: string, main: string, secondary: string): Promise<string> {
  const key = `${texture}|${main}|${secondary}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const job = new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error(`texture load failed: ${texture}`));
    img.onload = () => {
      // 굽다 실패하면 **던지게** 둔다 — 예전처럼 흑백이 남는 일이 없도록.
      try { resolve(bake(img, main, secondary)); } catch (e) { reject(e); }
    };
    img.src = texture;
  });

  // 실패한 약속을 캐시에 남기면 영영 다시 시도하지 못한다 — 지워서 다음에 다시 굽게 한다
  job.catch(() => cache.delete(key));

  cache.set(key, job);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  return job;
}

export function GradientMapBackground({
  texture,
  main,
  secondary,
  className,
}: {
  texture: string;
  main: string;
  secondary: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    /*
      새 URL 이 나올 때까지 **이전 그림을 그대로 둔다.**
      41장이 동시에 걸린 화면에서 null 로 비웠다가 채우면 다 같이 한 번 깜빡인다.
      같은 조합이면 캐시에서 마이크로태스크 만에 돌아오므로 사실상 바로 바뀐다.
    */
    mappedUrl(texture, main, secondary)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [texture, main, secondary]);

  if (!url) return null;
  // 캔버스일 때와 같은 배치 — 배경 상자에 꽉 채운다
  return (
    <img src={url} alt="" draggable={false} className={className}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  );
}
