/**
 * 배너 일괄 내보내기 — 매체별 폴더로 묶은 ZIP.
 *
 * 미리보기와 **같은 렌더러**(SpecBannerPreview)를 화면 밖에서 원본 크기로 한 장씩
 * 그린 뒤 PNG 로 굽는다. 캔버스로 다시 그리지 않으므로 웹에서 보이는 것과 결과가
 * 어긋날 일이 없다.
 */
/**
 * 파일 저장. 지원하는 브라우저면 저장 위치를 물어보고(showSaveFilePicker),
 * 아니면 평범한 링크 클릭으로 내려받는다.
 */
export async function saveBlob(blob: Blob, fileName: string): Promise<void> {
  const picker = (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  if (typeof picker === 'function') {
    try {
      const fh = await (picker as (o: unknown) => Promise<FileSystemFileHandle>)({
        suggestedName: fileName,
        types: [{ description: 'ZIP Archive', accept: { 'application/zip': ['.zip'] } }],
      });
      const w = await fh.createWritable();
      await w.write(blob);
      await w.close();
      return;
    } catch (e) {
      // 사용자가 취소한 것이면 조용히 끝낸다. 그 외에는 링크 방식으로 넘어간다.
      if ((e as { name?: string })?.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * 화면에 붙은 이미지를 전부 data URL 로 바꿔 둔다. 되돌리는 함수를 반환한다.
 *
 * html-to-image 는 DOM 을 SVG(foreignObject)로 직렬화해서 굽는데, 그 안에서는
 * 외부 URL 을 다시 못 가져온다. 미리 심어두지 않으면 배경·도형·제품컷이 통째로 빠진다.
 */
export async function inlineImages(root: HTMLElement): Promise<() => void> {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img[src]'));
  const restore = new Map<HTMLImageElement, string>();
  await Promise.allSettled(imgs.map(async (img) => {
    const src = img.src;
    if (!src || src.startsWith('data:')) return;
    const res = await fetch(src, { cache: 'force-cache' });
    if (!res.ok) return;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(r.result as string);
      r.onerror = no;
      r.readAsDataURL(blob);
    });
    restore.set(img, src);
    img.src = dataUrl;
  }));
  return () => restore.forEach((orig, img) => { img.src = orig; });
}

/** 바뀐 state 가 실제로 화면에 그려질 때까지 기다린다 (레이아웃 2프레임 + 이미지 디코드 여유) */
export function settle(ms = 120): Promise<void> {
  return new Promise((r) => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, ms)));
  });
}

/**
 * 화면 밖 노드를 PNG 로 굽는다.
 * html-to-image 는 마지막 단계에서만 쓰이므로 그때 가서 불러온다 (초기 번들에서 제외).
 */
export async function capturePng(node: HTMLElement, width: number, height: number): Promise<Blob> {
  const { toBlob } = await import('html-to-image');
  const blob = await toBlob(node, { width, height, pixelRatio: 1, skipFonts: false, cacheBust: true });
  if (!blob) throw new Error('렌더 결과가 비었습니다');
  return blob;
}

/** 파일명에 붙일 YYMMDD */
export function stamp(d = new Date()) {
  return String(d.getFullYear()).slice(-2)
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0');
}
