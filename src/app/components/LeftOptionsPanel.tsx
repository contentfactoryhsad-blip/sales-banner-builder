import { useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ImageIcon, Loader2, X, Crop } from 'lucide-react';
import type { BannerState } from '../types';
import { PROMOTIONS, getPromotion } from '../../data/promotions';
import { AD_CHANNELS, BACKGROUND_TYPES, BOX_STYLES, BOX_COUNTS } from '../../data/builderOptions';
import { scrapeProductImages, getProxiedImageUrl, type ScrapedImage } from '../services/imageScraperApi';
import { removeBackgroundAI } from '../utils/aiBgRemoval';
import { ImageGalleryModal } from './ImageGalleryModal';
import { ImageCropModal, type CropState } from './ImageCropModal';
import { BrushMaskEditor } from './BrushMaskEditor';

/** 제품 이미지 크롭 비율 (정사각) */
const PRODUCT_ASPECT = 1;

/** 좌측 옵션 바 — 배너 요소를 고르는 메뉴 영역. */
export function LeftOptionsPanel({
  state,
  update,
}: {
  state: BannerState;
  update: (patch: Partial<BannerState>) => void;
}) {
  const [promoOpen, setPromoOpen] = useState(false);
  const selectedPromo = state.promotionId ? getPromotion(state.promotionId) : undefined;

  const setProduct = (i: number, v: string | null) =>
    update({ products: state.products.map((p, idx) => (idx === i ? v : p)) });

  return (
    <aside className="w-80 shrink-0 bg-white border-r border-gray-200 overflow-y-auto flex flex-col gap-5 p-3">
      {/* 1. Promotion — dropdown */}
      <Section label="1. Promotion" hint="sets banner colors">
        <button
          type="button"
          onClick={() => setPromoOpen((o) => !o)}
          className={`w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg border transition-colors ${
            promoOpen ? 'border-[#FD312E]' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          {selectedPromo ? (
            <>
              <span className="flex items-center -space-x-1 shrink-0">
                <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: selectedPromo.main.hex }} />
                <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: selectedPromo.secondary.hex }} />
              </span>
              <span className="text-[13px] text-gray-800 truncate flex-1">{selectedPromo.label}</span>
            </>
          ) : (
            <span className="text-[13px] text-gray-400 flex-1">Select a promotion</span>
          )}
          <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${promoOpen ? 'rotate-180' : ''}`} />
        </button>

        {promoOpen && (
          <div className="mt-1.5 max-h-72 overflow-y-auto flex flex-col gap-1 rounded-lg border border-gray-100 p-1.5">
            {PROMOTIONS.map((p) => {
              const selected = state.promotionId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { update({ promotionId: p.id, mainHue: null, secondaryHue: null, promoName: p.label }); setPromoOpen(false); }}
                  className={`flex items-center gap-2.5 text-left px-2.5 py-2 rounded-md border transition-colors ${
                    selected ? 'border-[#FD312E] bg-[#FD312E]/5' : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center -space-x-1 shrink-0">
                    <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: p.main.hex }} />
                    <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: p.secondary.hex }} />
                  </span>
                  <span className={`text-[13px] truncate ${selected ? 'text-[#FD312E] font-medium' : 'text-gray-700'}`}>
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {/* 2. Ad Channel */}
      <Section label="2. Ad Channel" hint="ad media">
        <div className="grid grid-cols-2 gap-1.5">
          {AD_CHANNELS.map((c) => (
            <Chip key={c.id} selected={state.adChannelId === c.id} onClick={() => update({ adChannelId: c.id })}>
              {c.label}
            </Chip>
          ))}
        </div>
      </Section>

      {/* 3. Background Type — A/B 디자인별 5종, 작은 원(흑백) 일렬 */}
      <Section label="3. Background Type" hint={`5 types · ${state.designType}`}>
        <div className="flex items-center gap-2">
          {BACKGROUND_TYPES[state.designType].map((b) => {
            const selected = state.backgroundTypeId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => update({ backgroundTypeId: b.id })}
                title={b.label}
                className={`w-10 h-10 rounded-full overflow-hidden border-2 shrink-0 transition-colors ${
                  selected ? 'border-[#FD312E]' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <img src={b.texture} alt={b.label} className="w-full h-full object-cover" draggable={false} />
              </button>
            );
          })}
        </div>
      </Section>


      {/* 5. Box Type */}
      <Section label="5. Box Type" hint="box style · count">
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {BOX_STYLES.map((b) => (
            <Chip key={b.id} selected={state.boxStyleId === b.id} onClick={() => update({ boxStyleId: b.id })}>
              {b.label}
            </Chip>
          ))}
        </div>
        <div className="flex gap-1.5">
          {BOX_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => update({ boxCount: n })}
              className={`w-8 h-8 rounded-md border text-xs font-medium transition-colors ${
                state.boxCount === n
                  ? 'border-[#FD312E] text-[#FD312E] bg-[#FD312E]/5'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </Section>

      {/* 6. Product */}
      <Section label="6. Product" hint="import from LG.com / upload">
        <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
          Layout and colors are fixed. Product images can be replaced below.
        </p>
        {state.boxCount ? (
          <div className="flex flex-col">
            {Array.from({ length: state.boxCount }).map((_, i) => (
              <ProductRow
                key={i}
                index={i + 1}
                value={state.products[i] ?? null}
                onChange={(v) => setProduct(i, v)}
                onMeta={(m) => update({ productMeta: state.productMeta.map((x, k) => (k === i ? m : x)) })}
              />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-gray-300 border border-dashed border-gray-200 rounded-lg px-3 py-4 text-center">
            Select the number of boxes in Box Type first.
          </p>
        )}
      </Section>
    </aside>
  );
}

/** 제품 이미지 입력 행 — LG.com URL Import(크롤링) → 갤러리 선택 → 누끼 → 브러시 → 크롭. 단계별/한판 빌더 공용. */
export function ProductRow({
  index,
  value,
  onChange,
  onMeta,
}: {
  index: number;
  value: string | null;
  onChange: (v: string | null) => void;
  /** Import 로 알아낸 제품 정보 — 사용 기록에 "어떤 제품을 썼나"를 남기는 데 쓴다 */
  onMeta?: (meta: { model: string; name: string } | null) => void;
}) {
  const [url, setUrl] = useState('');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ScrapedImage[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  // 크롭용: 원본 소스(재편집을 위해 보존) + 저장된 crop 상태 + 모달 open
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropState, setCropState] = useState<CropState | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [processing, setProcessing] = useState(false); // 누끼(배경 제거) 진행 중
  // 브러시 편집용: 원본(복원 소스) + 누끼 결과(작업 상태)
  const [brushOrig, setBrushOrig] = useState<string | null>(null);
  const [brushProcessed, setBrushProcessed] = useState<string | null>(null);

  const handleImport = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setGalleryOpen(true);
    setLoading(true);
    setError(null);
    setImages([]);
    const res = await scrapeProductImages(trimmed);
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setImages(res.images);
      onMeta?.({ model: res.modelName ?? '', name: res.productName ?? '' });
    }
  };

  // 소스 → 누끼(배경 제거) → 브러시 편집 창 열기
  const openWithBgRemoval = async (src: string) => {
    setProcessing(true);
    const cut = await removeBackgroundAI(src);
    setProcessing(false);
    setBrushOrig(src);
    setBrushProcessed(cut);
  };

  // 갤러리에서 이미지 선택 → 누끼 → 브러시
  const handleGallerySelect = (img: ScrapedImage) => {
    setGalleryOpen(false);
    void openWithBgRemoval(getProxiedImageUrl(img.url));
  };

  // 파일 업로드 → 누끼 → 브러시
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => void openWithBgRemoval(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = ''; // allow re-selecting same file
  };

  // 브러시 완료 → 크롭 창으로
  const handleBrushDone = (result: string) => {
    setBrushOrig(null);
    setBrushProcessed(null);
    setCropSrc(result);
    setCropState(null);
    setCropOpen(true);
  };
  const handleBrushCancel = () => {
    setBrushOrig(null);
    setBrushProcessed(null);
  };

  const handleCropConfirm = (dataUrl: string, cs: CropState) => {
    onChange(dataUrl);
    setCropState(cs);
    setCropOpen(false);
  };

  const handleRemove = () => {
    onChange(null);
    setCropSrc(null);
    setCropState(null);
  };

  return (
    <div className="py-3 border-b border-gray-100 last:border-b-0">
      <p className="text-[11px] font-medium text-gray-400 tracking-wide mb-2">PRODUCT {index}</p>
      <div className="flex items-start gap-2.5">
        {/* Thumbnail / preview */}
        <div className="w-14 h-14 shrink-0 rounded-lg border border-gray-200 bg-gray-50 relative overflow-hidden group flex items-center justify-center text-gray-300">
          {value ? (
            <>
              <img src={value} alt={`Product ${index}`} className="w-full h-full object-contain" draggable={false} />
              {/* Edit Crop — hover overlay */}
              {cropSrc && (
                <button
                  type="button"
                  onClick={() => setCropOpen(true)}
                  title="Edit Crop"
                  className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Crop size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={handleRemove}
                title="Remove"
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <X size={10} />
              </button>
            </>
          ) : (
            <ImageIcon size={18} />
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
              placeholder="LG.com product URL"
              className="flex-1 min-w-0 h-9 px-2.5 rounded-lg border border-gray-200 text-[12px] text-gray-800 outline-none focus:border-[#FD312E] focus:ring-1 focus:ring-[#FD312E]"
            />
            <button
              type="button"
              onClick={handleImport}
              disabled={!url.trim() || loading}
              className="shrink-0 px-3 h-9 rounded-lg bg-[#FD312E] text-white text-xs font-medium hover:bg-[#E22825] transition-colors disabled:opacity-40 flex items-center gap-1"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : null}
              Import
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="h-9 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-300 transition-colors"
          >
            Upload
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          {images.length > 0 && !galleryOpen && (
            <button
              type="button"
              onClick={() => setGalleryOpen(true)}
              className="text-[11px] text-[#FD312E] underline text-left"
            >
              Change from imported images
            </button>
          )}
        </div>
      </div>

      {galleryOpen && (
        <ImageGalleryModal
          images={images}
          loading={loading}
          error={error}
          onSelect={handleGallerySelect}
          onClose={() => setGalleryOpen(false)}
        />
      )}

      {brushOrig && brushProcessed && (
        <BrushMaskEditor
          originalUrl={brushOrig}
          processedUrl={brushProcessed}
          onDone={handleBrushDone}
          onCancel={handleBrushCancel}
        />
      )}

      {cropOpen && cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          aspectRatio={PRODUCT_ASPECT}
          minZoom={0.5}
          initialCrop={cropState?.crop}
          initialZoom={cropState?.zoom}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropOpen(false)}
        />
      )}

      {processing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl px-6 py-5 flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-[#FD312E] border-t-transparent animate-spin" />
            <p className="text-sm text-gray-800">Removing background…</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide px-1 mb-1.5">
        {label}
        {hint && <span className="ml-1.5 normal-case tracking-normal text-gray-300">· {hint}</span>}
      </p>
      {children}
    </div>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-md border text-xs font-medium transition-colors px-1 ${
        selected
          ? 'border-[#FD312E] text-[#FD312E] bg-[#FD312E]/5'
          : 'border-gray-200 text-gray-600 hover:border-gray-300'
      }`}
    >
      {children}
    </button>
  );
}
