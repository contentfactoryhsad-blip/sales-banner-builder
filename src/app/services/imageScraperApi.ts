export interface ScrapedImage {
  url: string;
  /** Surrounding text context extracted from the page (heading/alt/figcaption) */
  context: string;
  /** Supporting body copy near the image (paragraph / descriptive alt text) */
  body?: string;
  /** True when the image came from the page's own gallery carousel (c-gallery) —
   *  the Gallery Feature flow restricts its strip to exactly these. */
  fromGallery?: boolean;
}

export interface ScrapeResult {
  images: ScrapedImage[];
  modelName?: string;
  productName?: string;
  error?: string;
}

export async function scrapeProductImages(url: string): Promise<ScrapeResult> {
  try {
    const res = await fetch('/api/crawl-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { images: [], error: data.error || `Failed (${res.status})` };
    }

    const data = await res.json();
    const raw = data.images || [];
    // Backward-compatible normalization: handle array of strings or of objects.
    const images: ScrapedImage[] = raw.map((entry: any) =>
      typeof entry === 'string'
        ? { url: entry, context: '' }
        : {
            url: entry.url,
            context: entry.context || '',
            body: entry.body || undefined,
            fromGallery: entry.fromGallery === true || undefined,
          },
    );
    return { images, modelName: data.modelName || undefined, productName: data.productName || undefined };
  } catch (err: any) {
    return { images: [], error: err.message || 'Network error' };
  }
}

export function getProxiedImageUrl(originalUrl: string): string {
  // Local sources (user uploads) need no CORS proxy — and the proxy would
  // reject them anyway.
  if (originalUrl.startsWith('data:') || originalUrl.startsWith('blob:')) return originalUrl;
  return `/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
}
