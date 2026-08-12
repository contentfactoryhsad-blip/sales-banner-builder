/**
 * 제품 페이지 크롤링 / 이미지 프록시 — **개발 서버와 운영 서버가 함께 쓰는 코드**.
 *
 * 예전에는 이 로직이 vite-api-plugin.ts 안에만 있어서 `vite dev` 로만 동작했다.
 * 빌드 결과(dist)를 정적으로 올리면 제품 Import 가 통째로 죽는다.
 * 두 곳에 복사해 두면 반드시 갈라지므로 여기 한 벌만 두고 양쪽이 import 한다.
 *   · 개발  vite-api-plugin.ts  (Vite 미들웨어)
 *   · 운영  server.ts           (Express)
 */
import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';

// 사내 프록시/VPN 의 자체 서명 인증서 우회
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * 이미지 프록시 허용 도메인.
 * 공개 서버에서 제한이 없으면 누구나 우리 서버를 경유해 아무 이미지나 받아갈 수 있다.
 * 새 소스가 필요하면 여기에 추가한다.
 */
const ALLOWED_IMAGE_DOMAINS = [
  'lg.com', 'lge.co.kr', 'lgthailand.com', 'lg.co.th',
  'gscs-cdn-images.lge.com',
  'lazada.co.th', 'lazada.sg', 'lazada.com.my', 'lazada.com.ph', 'lazada.vn', 'lazada.co.id',
  'shopee.co.th', 'shopee.sg', 'shopee.com.my', 'shopee.com.ph', 'shopee.vn', 'shopee.co.id',
  'lzd-img-global.slatic.net', 'img.lazcdn.com',
  'cf.shopee.co.th', 'cf.shopee.sg', 'down-th.img.susercontent.com',
  'media-cdn.bnn.in.th',
];

export function isImageDomainAllowed(hostname: string): boolean {
  return ALLOWED_IMAGE_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Bypass self-signed certificate issues (company proxy/VPN)

const BLOCKED_PATTERNS = [
  'sprite', 'pixel', '1x1', 'tracking', 'analytic', 'spacer',
  // NOTE: deliberately NOT blocking 'promotion' — LG CDN stores legit product
  // gallery images under year-scoped paths like `/2025-promotions/...` and a
  // raw substring block wipes out the real product hero. Banner filtering is
  // handled by the size patterns + 'banner' / 'home-page' / 'gnb' entries
  // below, which is enough for homepage/category promo carousels.
  'gnb', 'banner', 'buying-guide',
  '290x90', '620x316', '580x180', '644x328', '373x190',
  'home-page', 'microsite',
  // LG spec drawings (not lifestyle / product visuals)
  '/images/spec/', '-dimension',
];

function isUsableImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (BLOCKED_PATTERNS.some((p) => lower.includes(p))) return false;
  // Must look like an image URL
  if (/\.(svg|gif)(\?|$)/.test(lower)) return false;
  return true;
}

// Some LG products embed the spec/dimension drawing as a numbered slide INSIDE
// the same product gallery carousel as the real cutout photos (URL pattern is
// indistinguishable from a legit shot — e.g. ".../gallery-08-2010.jpg"), so the
// '/images/spec/' + '-dimension' URL patterns above miss it entirely. LG does
// label these slides distinctly via alt/data-alt text (seen: "Dimension image"),
// even though the shared per-carousel context/heading extraction doesn't catch
// it — check the alt text directly wherever it's available (gallery items).
const SPEC_DRAWING_ALT = /\b(dimension|installation)\b.*\bimage\b|\bspec(ification)?\s*(drawing|diagram)\b/i;
function isSpecDrawingAlt(alt: string | undefined): boolean {
  return !!alt && SPEC_DRAWING_ALT.test(alt);
}

function parseUrlDimensions(url: string): { w: number; h: number } | null {
  const m = url.match(/[_\-](\d{2,5})x(\d{2,5})/);
  if (m) return { w: +m[1], h: +m[2] };
  const w = url.match(/[?&]w=(\d{2,5})/);
  if (w) return { w: +w[1], h: 0 };
  return null;
}

function imageQualityScore(url: string): number {
  const d = parseUrlDimensions(url);
  const desktopBonus = /-d(\.|_|-)/i.test(url) ? 100_000 : 0;
  if (!d) return desktopBonus; // e.g. LG feature images with no size in URL
  const area = d.w * (d.h || d.w);
  const ratioPenalty = d.h ? Math.abs(d.w / d.h - 1) * 500_000 : 0;
  return area - ratioPenalty + desktopBonus;
}

function resolveUrl(href: string, base: string): string | null {
  if (!href || href.startsWith('data:')) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

interface ScrapedImage { url: string; context: string; body?: string; fromGallery?: boolean; }

function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function looksLikeFilename(s: string): boolean {
  // e.g. "front-loading-washing-machine-gvx-2025-f2x5fyny5-feature-core-tech-m"
  return !s.includes(' ') && (s.length > 30 || /[-_]{2,}|\.(jpg|png|webp)|_[dm]$/i.test(s));
}

/**
 * Walk up the DOM from `node` and find the closest heading that precedes
 * this element in document order. Handles CMS layouts (e.g. LG's c-wrapper)
 * where headings and images live in separate sibling containers.
 */
function isGoodHeading(s: string): boolean {
  return !!s && s.length > 0 && s.length <= 80 && !looksLikeFilename(s);
}

/** Find the first valid heading inside (or equal to) a sibling node. */
function headingInside($: any, sib: any, reverse = false): string {
  const tn = (sib.prop('tagName') as string || '').toUpperCase();
  if (/^H[1-6]$/.test(tn)) {
    const txt = cleanText(sib.text());
    if (isGoodHeading(txt)) return txt;
  }
  const headings = sib.find('h1, h2, h3, h4, h5, h6');
  const range = reverse
    ? Array.from({ length: headings.length }, (_, i) => headings.length - 1 - i)
    : Array.from({ length: headings.length }, (_, i) => i);
  for (const i of range) {
    const txt = cleanText($(headings[i]).text());
    if (isGoodHeading(txt)) return txt;
  }
  return '';
}

/**
 * Walk up the DOM and at each level, search both prev and next siblings
 * (up to `maxHops` each direction). Return the closest heading. On ties,
 * prefer the preceding one (natural reading order).
 *
 * Handles two CMS layouts: heading-then-image (e.g. "Perfect Colour" above parrot)
 * AND image-then-heading (e.g. AI Search img followed by "AI Search" heading).
 */
function findNearbyHeading($: any, node: any): string {
  const MAX_HOPS = 3;
  let current = node;
  for (let d = 0; d < 10 && current.length; d++) {
    let prevHeading = '';
    let prevHops = Infinity;
    let sib = current.prev();
    for (let h = 1; sib.length && h <= MAX_HOPS; h++, sib = sib.prev()) {
      const t = headingInside($, sib, true);
      if (t) { prevHeading = t; prevHops = h; break; }
    }
    let nextHeading = '';
    let nextHops = Infinity;
    sib = current.next();
    for (let h = 1; sib.length && h <= MAX_HOPS; h++, sib = sib.next()) {
      const t = headingInside($, sib, false);
      if (t) { nextHeading = t; nextHops = h; break; }
    }
    if (prevHeading || nextHeading) {
      // On tie prefer prev (natural layout heading-then-content)
      return prevHops <= nextHops ? (prevHeading || nextHeading) : (nextHeading || prevHeading);
    }
    const parent = current.parent();
    const ptn = (parent.prop('tagName') as string || '').toUpperCase();
    if (!parent.length || ptn === 'BODY' || ptn === 'HTML') break;
    current = parent;
  }
  return '';
}

function extractContext($: any, el: any): string {
  const tag = $(el);

  // 1. <figcaption> in same <figure>
  const figParent = tag.closest('figure');
  if (figParent.length) {
    const cap = cleanText(figParent.find('figcaption').first().text());
    if (cap) return cap.slice(0, 80);
  }

  // 2. Closest heading in document (checks both prev and next siblings).
  const nearby = findNearbyHeading($, tag);
  if (nearby) return nearby;

  // 3. Nearest heading inside a likely feature/section container
  const container = tag.closest('[class*="feature"], [class*="benefit"], [class*="highlight"], [class*="section"], section, article, figure');
  if (container.length) {
    const heading = cleanText(container.find('h1, h2, h3, h4, h5, h6').first().text());
    if (heading && !looksLikeFilename(heading)) return heading.slice(0, 80);
  }

  // 4. alt attribute — prefer first sentence, fallback to 80-char slice
  const alt = cleanText(tag.attr('alt') || '');
  if (alt && !looksLikeFilename(alt)) {
    const firstSentence = alt.match(/^[^.!?]+/)?.[0].trim();
    if (firstSentence && firstSentence.length > 0 && firstSentence.length <= 80) {
      return firstSentence;
    }
    return alt.slice(0, 80);
  }

  // 5. aria-label / title as last resort
  const aria = cleanText(tag.attr('aria-label') || tag.attr('title') || '');
  if (aria && !looksLikeFilename(aria)) return aria.slice(0, 80);

  return '';
}

function extractBodyContext($: any, el: any): string {
  const tag = $(el);

  // 1. LG.com: bodycopy div within same c-hero-banner
  const lgBanner = tag.closest('[class*="c-hero-banner"]');
  if (lgBanner.length) {
    const bc = cleanText(lgBanner.find('[class*="bodycopy"], [class*="body-copy"]').first().text());
    if (bc && bc.length > 20) return bc.slice(0, 300);
    // Adjacent sibling section sometimes holds the body text
    const nextSection = lgBanner.parent().next('[class*="c-wrapper"], [class*="c-section"], section');
    if (nextSection.length) {
      const body = cleanText(nextSection.find('[class*="bodycopy"], [class*="cmp-text"] p').first().text());
      if (body && body.length > 20 && body.length <= 500) return body.slice(0, 300);
    }
  }

  // 2. Generic: paragraph in same feature/section container
  const container = tag.closest('[class*="feature"], [class*="benefit"], [class*="highlight"], [class*="kv"], section, article, figure, li');
  if (container.length) {
    const p = container.find('p').not('.sr-only').first();
    const text = cleanText(p.text());
    if (text && text.length > 20 && text.length <= 500) return text.slice(0, 300);
  }

  // 3. Descriptive alt text (≥80 chars) as fallback body copy
  const alt = cleanText(tag.attr('alt') || '');
  if (alt && alt.length >= 80 && !looksLikeFilename(alt)) {
    return alt.slice(0, 300);
  }

  return '';
}

function extractImages(html: string, pageUrl: string): ScrapedImage[] {
  const $ = cheerio.load(html);
  const images: ScrapedImage[] = [];
  const seen = new Map<string, number>();
  // LG gallery slider images — extracted early with high-res URLs, bypass context dedup
  const priorityImages: ScrapedImage[] = [];

  const add = (url: string | null, context: string = '') => {
    if (!url) return;
    if (!isUsableImage(url)) return;
    if (seen.has(url)) {
      // Fill in context if we now have one and didn't before
      const idx = seen.get(url)!;
      if (!images[idx].context && context) images[idx].context = context;
      return;
    }
    seen.set(url, images.length);
    images.push({ url, context });
  };

  // LG gallery slider (a.c-gallery__item) — high-res versions via data-large-d/m.
  // JCR rendition suffix is stripped to get the clean .jpg URL.
  // These bypass context dedup because all carousel slides share the same product heading.
  $('a[class*="c-gallery"][data-large-d], a[class*="c-gallery"][data-large-m]').each((_, el) => {
    const tag = $(el);
    if (isSpecDrawingAlt(tag.attr('data-alt'))) return;
    const context = extractContext($, el);
    for (const attr of ['data-large-d', 'data-large-m'] as const) {
      const val = tag.attr(attr);
      if (!val) continue;
      const cleanVal = val.replace(/\/jcr:content\/renditions\/[^\/?]+/i, '');
      const url = resolveUrl(cleanVal, pageUrl);
      if (url && isUsableImage(url)) {
        priorityImages.push({ url, context });
        add(url, context);
      }
      break;
    }
  });

  // Gallery selectors run FIRST so the on-page product carousel hero (typically
  // the opened/active product shot) wins the images[0] pin. Falling back to
  // og:image after this catches pages without a structured gallery, but on
  // LG PDPs og:image is often a square social-share crop (e.g. closed-laptop
  // promo card) that doesn't match the user-visible product thumbnail.
  const gallerySelectors = [
    'div.gallery-preview-panel img', 'div.item-gallery img', 'div[class*="gallery"] img',
    'div.product-briefing img', 'div[class*="product-image"] img',
    'div.product-image img', 'div.visual-area img',
    'div[class*="slider"] img', 'div[class*="carousel"] img', 'div[class*="swiper"] img',
  ];

  for (const sel of gallerySelectors) {
    $(sel).each((_, el) => {
      const tag = $(el);
      if (isSpecDrawingAlt(tag.attr('alt')) || isSpecDrawingAlt(tag.attr('data-alt'))) return;
      const context = extractContext($, el);
      for (const attr of ['src', 'data-src', 'data-original', 'data-lazy-src', 'srcset']) {
        const val = tag.attr(attr);
        if (!val) continue;
        if (attr === 'srcset') {
          val.split(',').map((s) => s.trim().split(/\s+/)[0]).forEach((p) => add(resolveUrl(p, pageUrl), context));
        } else {
          add(resolveUrl(val, pageUrl), context);
        }
      }
    });
  }

  $('meta[property="og:image"]').each((_, el) => {
    add(resolveUrl($(el).attr('content') || '', pageUrl));
  });

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '');
      const extractFromObj = (obj: any) => {
        if (!obj) return;
        if (typeof obj.image === 'string') add(resolveUrl(obj.image, pageUrl));
        if (Array.isArray(obj.image)) obj.image.forEach((img: any) => {
          if (typeof img === 'string') add(resolveUrl(img, pageUrl));
          if (typeof img?.url === 'string') add(resolveUrl(img.url, pageUrl));
        });
        if (typeof obj.image?.url === 'string') add(resolveUrl(obj.image.url, pageUrl));
      };
      if (Array.isArray(data)) data.forEach(extractFromObj);
      else extractFromObj(data);
    } catch { /* ignore */ }
  });

  // All <img> tags
  $('img').each((_, el) => {
    const tag = $(el);
    const context = extractContext($, el);
    for (const attr of ['src', 'data-src', 'data-original', 'data-lazy-src', 'data-zoom-image', 'data-big']) {
      const val = tag.attr(attr);
      if (val) add(resolveUrl(val, pageUrl), context);
    }
  });

  // Any element with image-bearing data-* attributes (LG uses data-large-d, data-srcset, etc.)
  const imageDataAttrs = [
    'data-large-d', 'data-large-m', 'data-desktop-src', 'data-mobile-src',
    'data-srcset', 'data-bg', 'data-background-image', 'data-image',
    'data-lazy', 'data-delayed-url',
  ];
  $('*').each((_, el) => {
    const tag = $(el);
    let context: string | null = null;
    for (const attr of imageDataAttrs) {
      const val = tag.attr(attr);
      if (!val) continue;
      if (context === null) context = extractContext($, el);
      if (attr.includes('srcset')) {
        val.split(',').map((s) => s.trim().split(/\s+/)[0]).forEach((p) => add(resolveUrl(p, pageUrl), context!));
      } else {
        add(resolveUrl(val, pageUrl), context);
      }
    }
  });

  // <picture> / <source> tags
  $('picture source, source[type^="image"]').each((_, el) => {
    const srcset = $(el).attr('srcset');
    if (srcset) {
      const context = extractContext($, el);
      srcset.split(',').map((s) => s.trim().split(/\s+/)[0]).forEach((p) => add(resolveUrl(p, pageUrl), context));
    }
  });

  // <a> linking directly to images
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(href)) {
      add(resolveUrl(href, pageUrl), extractContext($, el));
    }
  });

  // Inline background-image styles
  $('[style*="background-image"]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const match = style.match(/url\(["']?(.*?)["']?\)/);
    if (match?.[1]) add(resolveUrl(match[1], pageUrl), extractContext($, el));
  });

  // Body text extraction pass — adds body copy to images that already exist in `seen`
  const bodyOf = new Map<string, string>();
  const addBodyFor = (url: string | null, el: any) => {
    if (!url || !isUsableImage(url)) return;
    if (bodyOf.has(url)) return;
    const body = extractBodyContext($, el);
    if (body) bodyOf.set(url, body);
  };
  // LG feature banners first (richest context)
  $('[class*="c-hero-banner"] img').each((_: any, el: any) => {
    const tag = $(el);
    for (const attr of ['src', 'data-src', 'data-original']) {
      const val = tag.attr(attr);
      if (val) { addBodyFor(resolveUrl(val, pageUrl), el); break; }
    }
  });
  // Generic: all img tags (alt-text fallback covers most sites)
  $('img').each((_: any, el: any) => {
    const tag = $(el);
    for (const attr of ['src', 'data-src']) {
      const val = tag.attr(attr);
      if (val) { addBodyFor(resolveUrl(val, pageUrl), el); break; }
    }
  });
  for (const img of images) {
    if (!img.body) img.body = bodyOf.get(img.url) || undefined;
  }

  // Inherit context between URL siblings that differ only by variant suffix
  // (e.g. `-m.jpg` mobile vs `-d.jpg` desktop, or `_350x350` vs `_2010x1334`).
  // If one variant has context and the other doesn't, copy it.
  const baseKey = (u: string): string => {
    try {
      const parsed = new URL(u);
      // Drop query and fragment
      let key = parsed.origin + parsed.pathname;
      // Normalise size/variant suffixes
      key = key
        .replace(/-[mdt](-\d+)?(\.(jpg|jpeg|png|webp))/i, '$2')
        .replace(/_\d+x\d+/g, '')
        .replace(/\/jcr:content\/renditions\/[^\/?]+/i, '')
        .toLowerCase();
      return key;
    } catch { return u.toLowerCase(); }
  };

  const contextByBase = new Map<string, string>();
  const bodyByBase = new Map<string, string>();
  for (const img of images) {
    const k = baseKey(img.url);
    if (img.context && !contextByBase.has(k)) contextByBase.set(k, img.context);
    if (img.body && !bodyByBase.has(k)) bodyByBase.set(k, img.body);
  }
  for (const img of images) {
    if (!img.context) {
      const inherited = contextByBase.get(baseKey(img.url));
      if (inherited) img.context = inherited;
    }
    if (!img.body) {
      const inherited = bodyByBase.get(baseKey(img.url));
      if (inherited) img.body = inherited;
    }
  }

  // Pin the first-crawled image at index 0 (best default for product image).
  if (images.length === 0) return [];
  const pinned = images[0];
  const pinnedKey = baseKey(pinned.url);
  const pinnedCtx = pinned.context.trim().toLowerCase();
  const rest = images.slice(1);

  // 1st pass — dedup by URL baseKey.
  const keyWinner = new Map<string, ScrapedImage>();
  const keyOrder: string[] = [];
  for (const img of rest) {
    const k = baseKey(img.url);
    if (k === pinnedKey) continue;
    const existing = keyWinner.get(k);
    if (!existing) {
      keyWinner.set(k, img);
      keyOrder.push(k);
    } else if (imageQualityScore(img.url) > imageQualityScore(existing.url)) {
      keyWinner.set(k, { ...existing, url: img.url });
    }
  }
  const afterUrlDedup = keyOrder.map((k) => keyWinner.get(k)!);

  // 2nd pass — dedup by non-empty context; keep closest-to-1:1 per group.
  const ctxWinner = new Map<string, ScrapedImage>();
  for (const img of afterUrlDedup) {
    const ctx = img.context.trim().toLowerCase();
    if (!ctx || ctx === pinnedCtx) continue;
    const existing = ctxWinner.get(ctx);
    if (!existing || imageQualityScore(img.url) > imageQualityScore(existing.url)) {
      ctxWinner.set(ctx, img);
    }
  }
  const ctxSeen = new Set<string>();
  const restDedup: ScrapedImage[] = [];
  for (const img of afterUrlDedup) {
    const ctx = img.context.trim().toLowerCase();
    if (!ctx) { restDedup.push(img); continue; }
    if (ctx === pinnedCtx) continue;
    if (ctxSeen.has(ctx)) continue;
    ctxSeen.add(ctx);
    restDedup.push(ctxWinner.get(ctx)!);
  }

  // Merge priority gallery images (bypass context dedup) before regular results.
  // Filter out any priority image that duplicates the pinned image by baseKey.
  const finalSeen = new Set<string>([pinnedKey]);
  const priorityMerged: ScrapedImage[] = [];
  for (const img of priorityImages) {
    const k = baseKey(img.url);
    if (!finalSeen.has(k)) { finalSeen.add(k); priorityMerged.push(img); }
  }
  const restFiltered = restDedup.filter((img) => !finalSeen.has(baseKey(img.url)));

  // Tag every image that came from the on-page gallery carousel (c-gallery) —
  // the Gallery Feature flow restricts its strip to exactly these. Matched by
  // baseKey so the pinned copy of a carousel slide keeps the tag too.
  const galleryKeys = new Set(priorityImages.map((img) => baseKey(img.url)));
  return [pinned, ...priorityMerged, ...restFiltered]
    .slice(0, 200)
    .map((img) => (galleryKeys.has(baseKey(img.url)) ? { ...img, fromGallery: true } : img));
}

function extractModelName(html: string, pageUrl: string): string {
  const $ = cheerio.load(html);

  // 1. JSON-LD Product sku / mpn / model
  let fromJsonLd = '';
  $('script[type="application/ld+json"]').each((_: any, el: any) => {
    if (fromJsonLd) return;
    try {
      const raw = JSON.parse($(el).html() || '{}');
      const nodes: any[] = Array.isArray(raw)
        ? raw
        : [raw, ...(raw['@graph'] || [])];
      for (const node of nodes) {
        if (node['@type'] === 'Product') {
          const v = node.sku || node.mpn || node.model;
          if (v && typeof v === 'string') {
            const c = v.trim().toUpperCase();
            if (/^[A-Z0-9\-]{4,25}$/.test(c)) { fromJsonLd = c; break; }
          }
        }
      }
    } catch { /* ignore */ }
  });
  if (fromJsonLd) return fromJsonLd;

  // 2. LG.com-specific DOM selectors
  for (const sel of [
    '.pdp-sub-title', '.model-name', '[class*="model-no"]',
    '[class*="model-num"]', '[data-model-name]', '[data-model-id]',
    '.sku', '[itemprop="sku"]', '[itemprop="mpn"]',
  ]) {
    const text = ($(sel).first().attr('content') || $(sel).first().text()).trim().toUpperCase();
    if (/^[A-Z0-9\-]{4,25}$/.test(text)) return text;
  }

  // 3. URL slug fallback — last path segment used as-is (covers model codes
  //    like EAY65068604 where stripping trailing digits would destroy the ID)
  try {
    const u = new URL(pageUrl);
    const slug = u.pathname.replace(/\/$/, '').split('/').filter(Boolean).pop() || '';
    const raw = slug.toUpperCase();
    if (/^[A-Z0-9\-]{4,25}$/.test(raw)) return raw;
  } catch { /* ignore */ }

  return '';
}

function extractProductName(html: string): string {
  const $ = cheerio.load(html);

  // 1. JSON-LD Product.name
  let fromJsonLd = '';
  $('script[type="application/ld+json"]').each((_: any, el: any) => {
    if (fromJsonLd) return;
    try {
      const raw = JSON.parse($(el).html() || '{}');
      const nodes: any[] = Array.isArray(raw) ? raw : [raw, ...(raw['@graph'] || [])];
      for (const node of nodes) {
        if (node['@type'] === 'Product' && typeof node.name === 'string' && node.name.trim()) {
          fromJsonLd = node.name.trim(); break;
        }
      }
    } catch { /* ignore */ }
  });
  if (fromJsonLd) return fromJsonLd;

  // 2. og:title — strip common suffixes like " | LG", " - LG Electronics" etc.
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || '';
  if (ogTitle) {
    return ogTitle.replace(/\s*[\|\-–—]\s*(LG.*|Official.*|Online.*|Shop.*)$/i, '').trim();
  }

  // 3. First h1 on the page
  const h1 = $('h1').first().text().trim();
  if (h1) return h1.replace(/\s*[\|\-–—]\s*(LG.*|Official.*|Online.*|Shop.*)$/i, '').trim();

  return '';
}

export interface CrawlResult {
  images: ScrapedImage[];
  modelName: string;
  productName: string;
}

/** 제품 페이지를 가져와 이미지 목록 + 모델명 + 제품명을 뽑는다. */
export async function crawlPage(pageUrl: string): Promise<CrawlResult> {
  const response = await fetch(pageUrl, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,th;q=0.8,ko;q=0.7',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Object.assign(new Error(`Failed to fetch page: ${response.statusText}`), { status: response.status });

  const html = await response.text();
  const images = extractImages(html, pageUrl);
  const modelName = extractModelName(html, pageUrl);
  let productName = extractProductName(html);
  // 모델명이 제품명 **뒤쪽**에 붙어 있을 때만 떼어낸다. 맨 앞이면 떼는 순간 전부 사라진다.
  if (modelName && productName) {
    const idx = productName.toUpperCase().indexOf(modelName.toUpperCase());
    if (idx > 0) {
      const stripped = productName.slice(0, idx).replace(/[\s\-\|\/,]+$/, '').trim();
      if (stripped) productName = stripped;
    }
  }
  return { images, modelName, productName };
}

/** 이미지를 서버 경유로 받아온다 (브라우저에서 직접 부르면 CORS 에 막힌다). */
export async function fetchProxyImage(url: string): Promise<{ contentType: string; buffer: Buffer }> {
  const upstream = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
    signal: AbortSignal.timeout(15000),
  });
  if (!upstream.ok) throw Object.assign(new Error('Upstream fetch failed'), { status: upstream.status });
  return {
    contentType: upstream.headers.get('content-type') || 'image/jpeg',
    buffer: Buffer.from(await upstream.arrayBuffer()),
  };
}

// ─── 사용 기록 (법인별 사용량 집계) ──────────────────────────────────────────

/**
 * 다운로드 한 번 = 한 줄. 나라별 법인이 얼마나 쓰는지 보려는 것이라
 * **접속 IP 의 국가**를 같이 남긴다.
 *
 * IP 원본은 저장하지 않고 마지막 자리를 지워 둔다 (203.0.113.45 → 203.0.113.0).
 * 어느 사무실인지 가르는 데는 충분하고, 개인을 특정하지는 않는다.
 */
export interface UsageRecord {
  design: string;        // A / B
  promotion: string;
  products: number;      // 넣은 제품 수
  boxes: number | null;  // 박스 개수
  channels: string;      // "criteo|dv360"
  banners: number;       // 받은 PNG 장수
  /** 어떤 제품을 썼는지 — 크롤링에서 받은 모델명을 이어붙인다 ("WT1210WWF|WL21WDU") */
  productModels: string;
  /** 모델명이 없을 때를 위한 제품명 ("LG WashTower™ …") */
  productNames: string;
}

/*
  기록 파일 위치. 기본은 프로젝트 안의 logs/ 인데, **배포처에 따라 반드시 바꿔야 한다.**

  Railway·Render 같은 곳은 컨테이너 디스크가 임시라, 코드를 새로 올리면 그 안의
  파일이 통째로 사라진다. 영구 볼륨을 붙이고 USAGE_DIR 을 그 경로로 지정하면
  재배포와 무관하게 남는다. 예) USAGE_DIR=/data
*/
const USAGE_CSV = path.join(process.env.USAGE_DIR || path.join(process.cwd(), 'logs'), 'usage.csv');
const USAGE_HEADER = 'time,country,region,ip,design,promotion,products,product_models,product_names,boxes,channels,banners\n';

/** 프록시 뒤에 있어도 원래 클라이언트 IP 를 찾는다 */
export function clientIp(headers: Record<string, string | string[] | undefined>, fallback?: string): string {
  const fwd = headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd;
  const ip = (first?.split(',')[0] || (headers['x-real-ip'] as string) || fallback || '').trim();
  return ip.replace(/^::ffff:/, '');
}

/** 마지막 자리를 지운다 — IPv4 는 마지막 옥텟, IPv6 는 뒤쪽 블록 */
function maskIp(ip: string): string {
  if (ip.includes(':')) {
    const b = ip.split(':');
    return b.length > 4 ? b.slice(0, 4).join(':') + '::' : ip;   // ::1 같은 짧은 주소는 그대로
  }
  const p = ip.split('.');
  return p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}.0` : ip;
}

/**
 * IP → 국가. 사설망(회사 내부·로컬)이면 조회할 것도 없이 'local'.
 * 외부 조회는 2초만 기다리고, 실패하면 'unknown' 으로 두고 기록은 남긴다 —
 * 조회 실패 때문에 사용 기록 자체를 잃으면 안 된다.
 */
async function lookupCountry(ip: string): Promise<{ country: string; region: string }> {
  if (!ip || /^(10\.|192\.168\.|127\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd)/.test(ip)) {
    return { country: 'local', region: '' };
  }
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 2000);
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=countryCode,country,regionName`, { signal: ac.signal });
    clearTimeout(t);
    if (!res.ok) return { country: 'unknown', region: '' };
    const j = (await res.json()) as { countryCode?: string; regionName?: string };
    return { country: j.countryCode || 'unknown', region: j.regionName || '' };
  } catch {
    return { country: 'unknown', region: '' };
  }
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** 한 줄 덧붙인다. 파일이 없으면 헤더부터 만든다. */
export async function appendUsage(rec: UsageRecord, ip: string): Promise<void> {
  const { country, region } = await lookupCountry(ip);
  const row = [
    new Date().toISOString(), country, region, maskIp(ip),
    rec.design, rec.promotion, rec.products, rec.productModels, rec.productNames,
    rec.boxes ?? '', rec.channels, rec.banners,
  ].map(csvCell).join(',') + '\n';

  await fs.mkdir(path.dirname(USAGE_CSV), { recursive: true });
  try { await fs.access(USAGE_CSV); } catch { await fs.writeFile(USAGE_CSV, USAGE_HEADER, 'utf8'); }
  await fs.appendFile(USAGE_CSV, row, 'utf8');
}

/** 모인 CSV 를 통째로 준다 (없으면 헤더만) */
export async function readUsage(): Promise<string> {
  try { return await fs.readFile(USAGE_CSV, 'utf8'); } catch { return USAGE_HEADER; }
}

/** CSV 를 행 객체 배열로. 통계 화면이 쓴다. */
export async function readUsageRows(): Promise<Record<string, string>[]> {
  const text = await readUsage();
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const head = lines[0].split(',');
  return lines.slice(1).map((line) => {
    // 따옴표로 감싼 칸 안의 쉼표는 구분자가 아니다
    const cells: string[] = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
  });
}

/**
 * 열쇠 검사 결과.
 *   'ok'        맞음
 *   'no-key'    서버에 USAGE_KEY 가 없다 (설정 누락 — 아무도 못 본다)
 *   'mismatch'  값이 다르다
 *
 * 둘을 나눠야 "열쇠를 잘못 쳤나 / 서버 설정을 빠뜨렸나"를 화면에서 바로 안다.
 * 어느 쪽이든 내용은 안 보여주므로 알려줘도 위험하지 않다.
 */
export function checkUsageKey(given: unknown): 'ok' | 'no-key' | 'mismatch' {
  // Railway 등에서 값 앞뒤로 따옴표·공백이 붙는 일이 있어 다듬어 비교한다
  const clean = (v: unknown) => String(v ?? '').trim().replace(/^["']|["']$/g, '');
  const key = clean(process.env.USAGE_KEY);
  if (!key) return 'no-key';
  return clean(given) === key ? 'ok' : 'mismatch';
}

/**
 * 내려받을 CSV — 시각을 원하는 시간대로 바꿔서 준다.
 *
 * 파일에는 UTC(ISO)로 남긴다. 나라별 법인이 쓰는 도구라 저장은 UTC 가 맞고,
 * 그래야 나중에 어느 시간대로든 다시 계산할 수 있다. 다만 그대로 받으면
 * 한국에서 볼 때 9시간 어긋나 보이므로, 내려줄 때 한 번 변환한다.
 * 헤더에 어느 시간대인지 적어 둬서 나중에 봐도 헷갈리지 않는다.
 */
export async function readUsageIn(tz = 'Asia/Seoul'): Promise<string> {
  const text = await readUsage();
  const lines = text.split('\n');
  if (lines.length < 2) return text;

  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('sv-SE', {           // sv-SE 는 YYYY-MM-DD HH:mm:ss 로 낸다
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  } catch {
    return text;   // 알 수 없는 시간대면 원본 그대로
  }

  const head = lines[0].split(',');
  const i = head.indexOf('time');
  if (i < 0) return text;
  head[i] = `time (${tz})`;

  const body = lines.slice(1).map((line) => {
    if (!line.trim()) return line;
    const cells = line.split(',');
    const d = new Date(cells[i]);
    if (!Number.isNaN(d.getTime())) cells[i] = fmt.format(d);
    return cells.join(',');
  });
  return [head.join(','), ...body].join('\n');
}
