import { useCallback, useMemo, useState } from 'react';
import { X, Loader2, ImageOff } from 'lucide-react';
import { getProxiedImageUrl, type ScrapedImage } from '../services/imageScraperApi';

/**
 * 제품컷 판정 기준.
 *
 * 누끼는 흰 배경을 테두리에서 흘려 지우는 방식이라, 배경이 흰 사진만 제대로 따진다.
 * 파일명·해상도로는 못 가른다 — 실측해 보면 같은 갤러리 시리즈(2010x1334) 안에도
 * 흰 배경 컷과 연출 컷이 섞여 있고, 가장 큰 이미지(2000x2402)가 연출인 경우도 있다.
 * 테두리 픽셀이 흰색인 비율만이 둘을 확실히 갈랐다 (제품컷 100% / 연출 0~28%).
 */
const WHITE_MIN = 243;
const CUT_WHITE_RATIO = 0.95;
/** 이보다 작으면 아이콘·로고로 보고 제품컷으로 치지 않는다 */
const CUT_MIN_SIDE = 200;
/** 테두리를 재는 축소 캔버스 크기 — 원본을 다 읽을 필요는 없다 */
const PROBE_SIZE = 96;

interface Measured { w: number; h: number; white: number }

/** 축소 캔버스에 그려 테두리 한 줄의 흰색 비율을 잰다. 프록시 경유라 same-origin. */
function measure(img: HTMLImageElement): Measured | null {
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) return null;
  const s = Math.min(1, PROBE_SIZE / Math.max(w, h));
  const cw = Math.max(2, Math.round(w * s)), ch = Math.max(2, Math.round(h * s));
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(img, 0, 0, cw, ch);
    const d = ctx.getImageData(0, 0, cw, ch).data;
    let white = 0, total = 0;
    const chk = (x: number, y: number) => {
      const p = (y * cw + x) * 4;
      total++;
      // 이미 투명한 배경도 "지울 수 있는 배경"으로 친다 (PNG 누끼본)
      if (d[p + 3] < 8) { white++; return; }
      if (d[p] >= WHITE_MIN && d[p + 1] >= WHITE_MIN && d[p + 2] >= WHITE_MIN) white++;
    };
    for (let x = 0; x < cw; x++) { chk(x, 0); chk(x, ch - 1); }
    for (let y = 0; y < ch; y++) { chk(0, y); chk(cw - 1, y); }
    return { w, h, white: total ? white / total : 0 };
  } catch {
    return null;   // 혹시라도 캔버스가 오염되면 정렬만 포기한다
  }
}

const isCut = (m: Measured) =>
  m.white >= CUT_WHITE_RATIO && Math.max(m.w, m.h) >= CUT_MIN_SIDE;

/** 크롤링된 제품 이미지 중 하나를 고르는 그리드 모달. (경량 자체 구현) */
export function ImageGalleryModal({
  images,
  loading,
  error,
  onSelect,
  onClose,
}: {
  images: ScrapedImage[];
  loading: boolean;
  error: string | null;
  onSelect: (img: ScrapedImage) => void;
  onClose: () => void;
}) {
  const [meas, setMeas] = useState<Record<string, Measured>>({});

  const onImgLoad = useCallback((url: string, el: HTMLImageElement) => {
    const m = measure(el);
    if (m) setMeas((prev) => (prev[url] ? prev : { ...prev, [url]: m }));
  }, []);

  /*
    제품컷 먼저, 그 안에서 해상도 높은 순.
    아직 안 잰 것은 원래 순서를 지키며 뒤에 둔다 — 로드되는 대로 제자리를 찾는다.
  */
  const ordered = useMemo(() => {
    const rank = (img: ScrapedImage) => {
      const m = meas[img.url];
      if (!m) return 1;            // 미측정
      return isCut(m) ? 0 : 2;     // 제품컷 → 미측정 → 연출
    };
    return images
      .map((img, i) => ({ img, i }))
      .sort((a, b) => {
        const ra = rank(a.img), rb = rank(b.img);
        if (ra !== rb) return ra - rb;
        const ma = meas[a.img.url], mb = meas[b.img.url];
        if (ma && mb) {
          const areaDiff = mb.w * mb.h - ma.w * ma.h;
          if (areaDiff) return areaDiff;
        }
        return a.i - b.i;          // 동률이면 원래 순서
      })
      .map((x) => x.img);
  }, [images, meas]);

  const cutCount = useMemo(
    () => images.filter((im) => meas[im.url] && isCut(meas[im.url])).length,
    [images, meas],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-gray-200 shrink-0">
          <div className="flex items-baseline gap-2">
            <p className="font-lgei font-bold text-[15px] text-gray-900">Select a product image</p>
            {cutCount > 0 && (
              <span className="text-[11px] text-gray-400">
                {cutCount} cutout-ready first
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-400">
              <Loader2 size={28} className="animate-spin" />
              <p className="text-sm">Fetching images…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-400">
              <ImageOff size={28} />
              <p className="text-sm">{error}</p>
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-400">
              <ImageOff size={28} />
              <p className="text-sm">No images found on this page.</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {ordered.map((img, i) => {
                const m = meas[img.url];
                const cut = m ? isCut(m) : false;
                return (
                  <button
                    key={`${img.url}-${i}`}
                    type="button"
                    onClick={() => onSelect(img)}
                    className={`group relative aspect-square rounded-lg border bg-gray-50 overflow-hidden hover:shadow-md transition-all ${
                      cut ? 'border-gray-300' : 'border-gray-200'
                    } hover:border-[#FD312E]`}
                    title={img.context || img.url}
                  >
                    <img
                      src={getProxiedImageUrl(img.url)}
                      alt={img.context || ''}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      draggable={false}
                      onLoad={(e) => onImgLoad(img.url, e.currentTarget)}
                    />
                    {m && (
                      <span className="absolute bottom-0 inset-x-0 px-1 py-0.5 text-[9px] leading-tight tabular-nums text-white bg-black/45 text-center">
                        {m.w}×{m.h}
                      </span>
                    )}
                    {cut && (
                      <span className="absolute top-1 left-1 px-1 py-px rounded text-[8px] font-medium text-white bg-[#FD312E]/85">
                        CUTOUT
                      </span>
                    )}
                    <div className="absolute inset-0 bg-[#FD312E]/0 group-hover:bg-[#FD312E]/8 transition-colors" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
