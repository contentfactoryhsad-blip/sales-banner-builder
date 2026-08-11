/**
 * 배너 일괄 내보내기 — 매체별 폴더로 묶은 ZIP.
 *
 * 미리보기와 **같은 렌더러**(SpecBannerPreview)를 화면 밖에서 원본 크기로 한 장씩
 * 그린 뒤 PNG 로 굽는다. 캔버스로 다시 그리지 않으므로 웹에서 보이는 것과 결과가
 * 어긋날 일이 없다.
 */
/**
 * 파일 저장 — 링크를 눌러 브라우저가 받게 한다.
 *
 * showSaveFilePicker(저장 위치를 고르는 창)는 쓰지 않는다. 그 자리에 쓰려면
 * "사용자가 방금 눌렀다"는 권한이 살아 있어야 하는데, 배너 41장을 굽는 동안
 * 만료돼 거절당한다. 클릭 직후에 자리를 미리 잡아둬도 쓰기 시점에 다시 막혔다.
 * 실패하면 잃어버리지 않으려고 링크로 한 번 더 받게 되어, 창이 두 번 뜨고
 * 정작 고른 자리는 비어 있는 상태가 됐다.
 *
 * 그래서 경로를 하나로 통일한다. 저장 위치를 매번 고르고 싶으면 브라우저 설정의
 * "다운로드 전에 각 파일의 저장 위치 확인"을 켜면 된다 — 그쪽이 훨씬 안정적이다.
 */
export async function saveBlob(blob: Blob, fileName: string): Promise<void> {
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
 * 배너가 실제로 쓰는 폰트 얼굴 (계열 → 굵기).
 *
 * 다 넣으면 7MB 라 굽는 데마다 얹기엔 무겁다. 렌더러가 쓰는 것만 추린다.
 *   LGEI Headline 600  헤드라인·프로모션명·스티커 "UP TO"
 *   LGEI Text     400  서브카피·CTA·고지문
 *   Cal Sans      400  스티커 숫자·%·off
 */
const BANNER_FACES: Record<string, string[]> = {
  'lgei headline': ['600'],
  'lgei text': ['400', 'normal'],
  'cal sans': ['400', 'normal'],
};

const fontName = (v: string) => v.trim().replace(/["']/g, '').toLowerCase();

/**
 * @font-face 를 data URL 로 바꾼 CSS 를 **한 번** 만들어 둔다.
 *
 * html-to-image 의 getFontEmbedCSS 를 쓰면 안 된다. 그 안의 getUsedFonts 가
 * 자식을 훑을 때 `child instanceof HTMLElement` 로 거르는데, **SVG 요소는
 * HTMLElement 가 아니라서** 거기서 순회가 끊긴다. 스티커 글자는 SVG <text> 라
 * 그 폰트(Cal Sans)가 "안 쓰는 폰트"로 분류되어 통째로 빠졌다.
 * (같은 SVG 안이라도 LGEI Headline 은 HTML 헤드라인에도 쓰여 살아남았다.
 *  그래서 스티커 숫자만 폰트가 빠져 보였다.)
 *
 * 그래서 직접 만든다. 스타일시트에서 @font-face 를 찾아 위 표에 있는 것만
 * 폰트 파일을 받아 심는다. 한 번 만들어 모든 장에 같은 CSS 를 넘긴다.
 */
export async function buildFontCss(): Promise<string> {
  const faces: CSSFontFaceRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }   // 외부 도메인 시트는 못 읽는다
    for (const rule of Array.from(rules)) {
      if (rule.constructor.name !== 'CSSFontFaceRule' && (rule as CSSRule).type !== 5) continue;
      const r = rule as CSSFontFaceRule;
      const weights = BANNER_FACES[fontName(r.style.fontFamily)];
      if (weights && weights.includes((r.style.fontWeight || 'normal').trim())) faces.push(r);
    }
  }

  const out = await Promise.all(faces.map(async (r) => {
    let css = r.cssText;
    const urls = css.match(/url\(["']?([^"')]+)["']?\)/g) ?? [];
    for (const u of urls) {
      const href = u.replace(/url\(["']?([^"')]+)["']?\)/, '$1');
      try {
        const res = await fetch(new URL(href, location.href).href, { cache: 'force-cache' });
        if (!res.ok) continue;
        const blob = await res.blob();
        const data = await new Promise<string>((ok, no) => {
          const fr = new FileReader();
          fr.onload = () => ok(fr.result as string);
          fr.onerror = no;
          fr.readAsDataURL(blob);
        });
        css = css.replace(u, `url(${data})`);
      } catch { /* 못 받으면 그 얼굴만 원래 주소로 남는다 */ }
    }
    return css;
  }));
  return out.join('\n');
}

/**
 * 화면 밖 노드를 PNG 로 굽는다.
 * html-to-image 는 마지막 단계에서만 쓰이므로 그때 가서 불러온다 (초기 번들에서 제외).
 */
export async function capturePng(
  node: HTMLElement, width: number, height: number, fontEmbedCSS?: string,
): Promise<Blob> {
  const { toBlob } = await import('html-to-image');
  const blob = await toBlob(node, {
    width, height, pixelRatio: 1, cacheBust: true,
    // fontEmbedCSS 를 주면 html-to-image 는 폰트를 다시 받지 않고 이걸 그대로 쓴다
    ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: false }),
  });
  if (!blob) throw new Error('렌더 결과가 비었습니다');
  return blob;
}

/** 파일명에 붙일 YYMMDD */
export function stamp(d = new Date()) {
  return String(d.getFullYear()).slice(-2)
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0');
}

/**
 * 사용 기록을 서버에 남긴다 (나라별 법인 사용량 집계).
 *
 * 다운로드가 끝난 **뒤에** 부르고, 실패해도 조용히 넘어간다 —
 * 기록이 안 남는 건 아쉬운 일이지만 사용자의 결과물에는 아무 영향이 없다.
 */
export async function logUsage(rec: Record<string, unknown>): Promise<void> {
  try {
    await fetch('/api/log-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rec),
      keepalive: true,   // 다운로드 직후 창을 닫아도 전송이 살아남는다
    });
  } catch {
    /* 조용히 무시 */
  }
}
