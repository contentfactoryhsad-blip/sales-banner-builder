import { useEffect, useRef } from 'react';
import { hexToRgb } from '../utils/color';

/**
 * 그라데이션 맵(Gradient Map) — 포토샵 "그레이디언트 맵" 조정 레이어와 동일 원리.
 * 흑백 텍스처의 밝기값(0~255)을 256칸 LUT로 색에 대응:
 *   어두움 → 그림자(메인 어둡게), 중간 → 메인 색, 밝음 → 조합 색 → 하이라이트.
 * 무늬(모양·명암)는 원본 텍스처 그대로 유지하고 색만 매핑한다.
 */
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
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let cancelled = false;

    // 밝기 0~255 → 색 LUT (256×3)
    const [mr, mg, mb] = hexToRgb(main);
    const [sr, sg, sb] = hexToRgb(secondary);
    const HL = 0.5; // 하이라이트 흰색 정도 (0=조합색 유지, 1=순백). 낮출수록 흰색 덜함
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

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      // KV 비율(≈612×628)에 cover로 맞춰 그림
      const cw = 480;
      const ch = 492;
      cv.width = cw;
      cv.height = ch;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const destA = cw / ch;
      const srcA = iw / ih;
      let sx = 0, sy = 0, sw = iw, sh = ih;
      if (srcA > destA) { sw = ih * destA; sx = (iw - sw) / 2; } else { sh = iw / destA; sy = (ih - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
      const data = ctx.getImageData(0, 0, cw, ch);
      const d = data.data;
      const N = cw * ch;

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
    };
    img.src = texture;
    return () => { cancelled = true; };
  }, [texture, main, secondary]);

  return <canvas ref={ref} className={className} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
