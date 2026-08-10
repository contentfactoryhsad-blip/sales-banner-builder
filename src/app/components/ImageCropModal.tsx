import React, { useState, useCallback } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

/** crop 상태 — Edit Crop 재편집 시 복원용. (참고본 CropState) */
export interface CropState {
  crop: { x: number; y: number };
  zoom: number;
}

// ─── Canvas crop helper (참고본 getCroppedImg) ───────────────────────────────
async function getCroppedImg(imageSrc: string, pixelCrop: Area, bgFill?: string): Promise<string> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
  });

  const rawW = Math.abs(pixelCrop.width);
  const rawH = Math.abs(pixelCrop.height);
  const MAX_DIM = 2600;
  const scale = Math.min(1, MAX_DIM / Math.max(rawW, rawH));
  const outW = Math.round(rawW * scale);
  const outH = Math.round(rawH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;

  if (bgFill) {
    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, outW, outH);
  } else {
    ctx.clearRect(0, 0, outW, outH);
  }

  const dstX = -pixelCrop.x * scale;
  const dstY = -pixelCrop.y * scale;
  const dstW = image.naturalWidth * scale;
  const dstH = image.naturalHeight * scale;
  ctx.drawImage(image, dstX, dstY, dstW, dstH);

  return canvas.toDataURL('image/png');
}

const CHECKERBOARD_BG = 'repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 0 0 / 24px 24px';

interface Props {
  imageSrc: string;
  aspectRatio?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  bgFill?: string;
  initialCrop?: { x: number; y: number };
  initialZoom?: number;
  onConfirm: (croppedDataUrl: string, cropState: CropState) => void;
  onCancel: () => void;
}

/** 이미지 크롭 모달. (참고본 ImageCropModal 이식 — i18n/누끼 자동감지 제거) */
export function ImageCropModal({
  imageSrc,
  aspectRatio,
  minZoom = 1,
  maxZoom = 3,
  zoomStep = 0.05,
  bgFill,
  initialCrop,
  initialZoom,
  onConfirm,
  onCancel,
}: Props) {
  const allowScaleDown = minZoom < 1;
  const [crop, setCrop] = useState(initialCrop ?? { x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialZoom ?? 1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  // Auto-cover: zoom image to fill the crop frame when no restore state.
  const onMediaLoaded = useCallback(
    (mediaSize: { naturalWidth: number; naturalHeight: number }) => {
      if (initialZoom !== undefined) return;
      if (!aspectRatio) return;
      const imgAspect = mediaSize.naturalWidth / mediaSize.naturalHeight;
      const coverZ = Math.max(aspectRatio / imgAspect, imgAspect / aspectRatio);
      if (coverZ > 1.05) setZoom(Math.min(maxZoom, coverZ));
    },
    [aspectRatio, initialZoom, maxZoom],
  );

  const handleFit = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setApplying(true);
    try {
      const result = await getCroppedImg(imageSrc, croppedAreaPixels, bgFill);
      onConfirm(result, { crop, zoom });
    } catch (e) {
      console.error('Crop failed:', e);
    } finally {
      setApplying(false);
    }
  };

  const canvasBg = bgFill ? bgFill : allowScaleDown ? CHECKERBOARD_BG : '#1a1a1a';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.78)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: 660, maxHeight: '92vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <p className="text-sm font-semibold text-gray-800">Crop Image</p>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Crop canvas */}
        <div className="relative shrink-0" style={{ height: 420, background: canvasBg }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={minZoom}
            maxZoom={maxZoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            onMediaLoaded={onMediaLoaded}
            showGrid
            zoomWithScroll={false}
            restrictPosition={!allowScaleDown}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: { border: '2px solid #FD312E', boxShadow: '0 0 0 9999px rgba(0,0,0,0.50)' },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-3 border-b border-gray-100 shrink-0 bg-gray-50">
          <div className="flex items-center gap-3">
            <button onClick={() => setZoom((z) => Math.max(minZoom, +(z - zoomStep).toFixed(2)))} className="p-1 rounded text-gray-400 hover:text-gray-700 transition-colors" title="Zoom out">
              <ZoomOut size={15} />
            </button>
            <input type="range" min={minZoom} max={maxZoom} step={zoomStep} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[#FD312E]" />
            <button onClick={() => setZoom((z) => Math.min(maxZoom, +(z + zoomStep).toFixed(2)))} className="p-1 rounded text-gray-400 hover:text-gray-700 transition-colors" title="Zoom in">
              <ZoomIn size={15} />
            </button>
            <span className="text-xs text-gray-500 w-11 text-right shrink-0 tabular-nums">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            {allowScaleDown && (
              <button onClick={handleFit} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm text-gray-600 border border-gray-200 hover:border-[#FD312E] hover:text-[#FD312E] transition-colors">
                <Maximize2 size={13} />
                Fit
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="px-4 py-2 rounded-full text-sm text-gray-600 border border-gray-200 hover:border-gray-300 transition-colors">
              Cancel
            </button>
            <button onClick={handleApply} disabled={applying} className="flex items-center gap-1.5 px-5 py-2 rounded-full text-sm bg-[#FD312E] text-white hover:bg-[#E22825] disabled:opacity-60 transition-colors">
              <Check size={14} />
              {applying ? 'Applying…' : 'Apply Crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
