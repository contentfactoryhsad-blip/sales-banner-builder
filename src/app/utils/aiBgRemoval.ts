// Conservative background removal for Store Page Modules product images.
//
// Deliberately NOT ML-based. The `@imgly/background-removal` model kept eating
// white product bodies (a white LG washer/dryer on a white studio background):
// it makes the whole white body transparent in one border-connected sweep, so
// even a connectivity guard can't tell it apart from the real background
// (see memory: feedback_bg_remove_attempts).
//
// This does the safe, predictable thing:
//   1. Treat ONLY near-pure-white pixels as erasable background.
//   2. Flood-fill inward from the image border through those white pixels —
//      erase from the OUTSIDE in. Any white region not reachable from the
//      border (a white product panel enclosed by its own darker edges/shadows)
//      is never touched.
//   3. Anti-alias the resulting edge (soft alpha) so the cutout isn't jagged.
//
// Falls back to the original image on any failure.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

/**
 * Flood-fill inward from every border pixel, expanding only through pixels the
 * `passable` predicate accepts. Returns a per-pixel reached/not-reached map.
 * Iterative (typed-array stack) to survive multi-million-pixel images.
 */
function floodFromBorder(w: number, h: number, passable: (i: number) => boolean): Uint8Array {
  const N = w * h;
  const reached = new Uint8Array(N);
  const stack = new Int32Array(N);
  let sp = 0;
  const push = (i: number) => {
    if (!reached[i] && passable(i)) { reached[i] = 1; stack[sp++] = i; }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp > 0) {
    const i = stack[--sp];
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  return reached;
}

/** Per-channel minimum for a pixel to count as "near-pure-white" background. */
const WHITE_MIN = 243;

async function floodWhiteBackground(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  // Keep native resolution (product photos are modest); cap only enormous ones
  // so the flood-fill stays fast.
  const MAX_SIDE = 3000;
  const nW = img.naturalWidth;
  const nH = img.naturalHeight;
  const scale = Math.min(1, MAX_SIDE / Math.max(nW, nH));
  const w = Math.max(1, Math.round(nW * scale));
  const h = Math.max(1, Math.round(nH * scale));

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w;
  srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) throw new Error('Canvas context unavailable');
  srcCtx.drawImage(img, 0, 0, w, h);
  const sd = srcCtx.getImageData(0, 0, w, h).data;
  const N = w * h;

  // Erasable background = near-pure-white AND connected to the frame edge.
  const isWhite = (i: number) => {
    const p = i * 4;
    return sd[p] >= WHITE_MIN && sd[p + 1] >= WHITE_MIN && sd[p + 2] >= WHITE_MIN;
  };
  const bg = floodFromBorder(w, h, isWhite);

  // Binary keep mask (1 = product), then a 3×3 keep-fraction anti-alias so the
  // boundary is soft rather than stair-stepped.
  const keep = new Uint8Array(N);
  for (let i = 0; i < N; i++) keep[i] = bg[i] ? 0 : 1;

  const out = srcCtx.createImageData(w, h);
  const od = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = i * 4;
      let sum = 0, cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += keep[yy * w + xx];
          cnt++;
        }
      }
      od[p] = sd[p];
      od[p + 1] = sd[p + 1];
      od[p + 2] = sd[p + 2];
      od[p + 3] = Math.round((sum / cnt) * 255);
    }
  }
  srcCtx.putImageData(out, 0, 0);
  return srcCanvas.toDataURL('image/png');
}

/**
 * Remove a near-white background from a product photo (outside-in flood +
 * anti-alias). Signature/name kept for existing callers.
 */
export async function removeBackgroundAI(
  dataUrl: string,
  onProgress?: (message: string) => void,
): Promise<string> {
  try {
    onProgress?.('Removing background…');
    return await floodWhiteBackground(dataUrl);
  } catch (err) {
    console.error('Background removal failed:', err);
    return dataUrl;
  }
}
