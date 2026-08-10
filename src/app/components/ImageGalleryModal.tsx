import { X, Loader2, ImageOff } from 'lucide-react';
import { getProxiedImageUrl, type ScrapedImage } from '../services/imageScraperApi';

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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-gray-200 shrink-0">
          <p className="font-lgei font-bold text-[15px] text-gray-900">Select a product image</p>
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
              {images.map((img, i) => (
                <button
                  key={`${img.url}-${i}`}
                  type="button"
                  onClick={() => onSelect(img)}
                  className="group relative aspect-square rounded-lg border border-gray-200 bg-gray-50 overflow-hidden hover:border-[#FD312E] hover:shadow-md transition-all"
                  title={img.context || img.url}
                >
                  <img
                    src={getProxiedImageUrl(img.url)}
                    alt={img.context || ''}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-[#FD312E]/0 group-hover:bg-[#FD312E]/8 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
