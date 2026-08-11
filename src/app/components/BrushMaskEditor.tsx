import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, Check, Eraser, Paintbrush, RotateCcw, ZoomIn, ZoomOut, Wand2, Loader2 } from "lucide-react";

/** i18n 미사용 — 원문(영문) 그대로 통과 */
const t = (s: string) => s;

type BrushMode = "erase" | "restore";

interface Props {
  /** Pre-removal image (original upload) — used as the restore source */
  originalUrl: string;
  /** AI-removed background result — the initial working state */
  processedUrl: string;
  onDone: (resultDataUrl: string) => void;
  onCancel: () => void;
}

const MAX_NATIVE  = 1400;
const MAX_UNDO    = 10;
/** Max pixels a single flood-fill can claim (prevents browser freeze on high tolerance) */
const MAX_FF_PX   = 600_000;
/** Min display-pixel distance before a drag triggers another smart fill */
const SMART_DRAG_STEP = 22;

export function BrushMaskEditor({ originalUrl, processedUrl, onDone, onCancel }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorElRef  = useRef<HTMLDivElement>(null);

  const [mode,         setMode]         = useState<BrushMode>("erase");
  const [isSmartMode,  setIsSmartMode]  = useState(false);
  const [tolerance]    = useState(5);   // fixed: precise mode
  const [brushSize,    setBrushSize]    = useState(30);
  const [zoom,         setZoom]         = useState(1);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [canUndo,      setCanUndo]      = useState(false);
  const [showOrig,     setShowOrig]     = useState(false);
  const [lastFillPx,   setLastFillPx]   = useState(0);   // pixels changed in last smart fill

  // Pixel-data buffers
  const workingDataRef  = useRef<ImageData | null>(null);
  const originalDataRef = useRef<ImageData | null>(null);
  const undoStackRef    = useRef<ImageData[]>([]);

  // Native canvas dimensions after downscale
  const nativeRef = useRef({ w: 0, h: 0 });

  // Painting / smart-drag state
  const isPaintingRef       = useRef(false);
  const lastNativePosRef    = useRef<{ x: number; y: number } | null>(null);
  const lastSmartDisplayRef = useRef<{ x: number; y: number } | null>(null);

  // Dirty-rect tracking for partial putImageData + RAF render scheduling
  const dirtyRef   = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const rafHandleRef = useRef<number | null>(null);

  const markDirty = (x0: number, y0: number, x1: number, y1: number) => {
    const cur = dirtyRef.current;
    if (!cur) dirtyRef.current = { x0, y0, x1, y1 };
    else {
      if (x0 < cur.x0) cur.x0 = x0;
      if (y0 < cur.y0) cur.y0 = y0;
      if (x1 > cur.x1) cur.x1 = x1;
      if (y1 > cur.y1) cur.y1 = y1;
    }
  };

  // ── Load both images ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const loadImg = (url: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new Image();
        img.onload  = () => res(img);
        img.onerror = rej;
        img.src = url;
      });

    Promise.all([loadImg(originalUrl), loadImg(processedUrl)])
      .then(([orig, proc]) => {
        if (cancelled) return;

        const srcW = proc.naturalWidth;
        const srcH = proc.naturalHeight;
        const ds   = Math.min(1, MAX_NATIVE / Math.max(srcW, srcH));
        const cw   = Math.round(srcW * ds);
        const ch   = Math.round(srcH * ds);

        nativeRef.current = { w: cw, h: ch };

        const tmp    = document.createElement("canvas");
        tmp.width    = cw;
        tmp.height   = ch;
        const ctx    = tmp.getContext("2d")!;

        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(proc, 0, 0, cw, ch);
        workingDataRef.current = ctx.getImageData(0, 0, cw, ch);

        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(orig, 0, 0, cw, ch);
        originalDataRef.current = ctx.getImageData(0, 0, cw, ch);

        setIsLoading(false);
      })
      .catch((err) => { if (!cancelled) console.error("BrushMaskEditor load:", err); });

    return () => { cancelled = true; };
  }, [originalUrl, processedUrl]);

  // ── Render ──────────────────────────────────────────────────────────────────
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const data   = showOrig ? originalDataRef.current : workingDataRef.current;
    if (!canvas || !data) return;
    canvas.getContext("2d")?.putImageData(data, 0, 0);
    dirtyRef.current = null;
  }, [showOrig]);

  /**
   * Schedule a partial repaint for the accumulated dirty rectangle on the
   * next animation frame. Brush strokes call this instead of `renderCanvas`
   * to coalesce many per-pixel writes into one GPU-friendly `putImageData`
   * per frame, bounded to just the changed region.
   */
  const scheduleRender = useCallback(() => {
    if (rafHandleRef.current !== null) return;
    rafHandleRef.current = requestAnimationFrame(() => {
      rafHandleRef.current = null;
      const canvas = canvasRef.current;
      const data   = showOrig ? originalDataRef.current : workingDataRef.current;
      const dirty  = dirtyRef.current;
      dirtyRef.current = null;
      if (!canvas || !data) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (dirty && !showOrig) {
        const dw = dirty.x1 - dirty.x0 + 1;
        const dh = dirty.y1 - dirty.y0 + 1;
        // 7-arg form: draw only dirty sub-rect of `data` into the canvas
        ctx.putImageData(data, 0, 0, dirty.x0, dirty.y0, dw, dh);
      } else {
        ctx.putImageData(data, 0, 0);
      }
    });
  }, [showOrig]);

  useEffect(() => { if (!isLoading) renderCanvas(); }, [isLoading, renderCanvas]);
  useEffect(() => () => {
    if (rafHandleRef.current !== null) cancelAnimationFrame(rafHandleRef.current);
  }, []);

  // ── Manual brush ────────────────────────────────────────────────────────────
  const applyBrushAt = useCallback((cx: number, cy: number) => {
    const data = workingDataRef.current;
    const orig = originalDataRef.current;
    if (!data || !orig) return;

    const { w, h } = nativeRef.current;
    const px = data.data;
    const ox = orig.data;
    const r  = brushSize;

    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h - 1, Math.ceil(cy + r));

    const r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const d = Math.sqrt(d2);
        const strength = (1 - (d / r) ** 1.5) * 0.88;
        const i = (y * w + x) * 4;
        if (mode === "erase") {
          px[i + 3] = Math.round(px[i + 3] * (1 - strength));
        } else {
          px[i]     = Math.round(px[i]     + (ox[i]     - px[i])     * strength);
          px[i + 1] = Math.round(px[i + 1] + (ox[i + 1] - px[i + 1]) * strength);
          px[i + 2] = Math.round(px[i + 2] + (ox[i + 2] - px[i + 2]) * strength);
          px[i + 3] = Math.round(px[i + 3] + (ox[i + 3] - px[i + 3]) * strength);
        }
      }
    }
    markDirty(x0, y0, x1, y1);
    scheduleRender();
  }, [brushSize, mode, scheduleRender]);

  const paintLine = useCallback((x0: number, y0: number, x1: number, y1: number) => {
    const dist  = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, brushSize * 0.2)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      applyBrushAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    }
  }, [brushSize, applyBrushAt]);

  // ── Smart Flood Fill ─────────────────────────────────────────────────────────
  /**
   * BFS flood fill from (seedX, seedY) using color similarity in the ORIGINAL image.
   * - Erase:   sets working-image alpha=0 for every matched pixel
   * - Restore: copies RGBA from original to working for every matched pixel
   *
   * The original image is always used as the color reference so the fill boundary
   * is based on the real, un-modified pixel colours (not what the user may have
   * already partially erased).
   */
  const floodFillAt = useCallback((seedX: number, seedY: number): number => {
    const data = workingDataRef.current;
    const orig = originalDataRef.current;
    if (!data || !orig) return 0;

    const { w, h } = nativeRef.current;
    const px = data.data;
    const ox = orig.data;

    const sx = Math.max(0, Math.min(w - 1, Math.round(seedX)));
    const sy = Math.max(0, Math.min(h - 1, Math.round(seedY)));
    const si = (sy * w + sx) * 4;

    // Seed colour from original image
    const sr = ox[si], sg = ox[si + 1], sb = ox[si + 2];

    // Tolerance → squared colour distance threshold
    // tolerance 0-100 maps to colour-space distance 0–340
    // (sqrt(3)*255 ≈ 441.7 is the absolute max; we cap at ~77% to stay practical)
    const tDist = (tolerance / 100) * 340;
    const tSq   = tDist * tDist;

    const visited = new Uint8Array(w * h);
    // Use a plain array as a stack (DFS is faster than BFS for flood fill)
    const stack: number[] = [sy * w + sx];
    visited[sy * w + sx]  = 1;

    let count = 0;

    while (stack.length > 0 && count < MAX_FF_PX) {
      const pos = stack.pop()!;
      const x   = pos % w;
      const y   = (pos - x) / w;
      const i   = pos * 4;

      if (mode === "erase") {
        px[i + 3] = 0;
      } else {
        px[i]     = ox[i];
        px[i + 1] = ox[i + 1];
        px[i + 2] = ox[i + 2];
        px[i + 3] = ox[i + 3];
      }
      count++;

      // Push 4-connected neighbours
      const right = x < w - 1 ? pos + 1 : -1;
      const left  = x > 0     ? pos - 1 : -1;
      const down  = y < h - 1 ? pos + w : -1;
      const up    = y > 0     ? pos - w : -1;

      for (const np of [right, left, down, up]) {
        if (np < 0 || visited[np]) continue;
        visited[np] = 1;
        const ni = np * 4;
        const dr = ox[ni] - sr, dg = ox[ni + 1] - sg, db = ox[ni + 2] - sb;
        if (dr * dr + dg * dg + db * db <= tSq) stack.push(np);
      }
    }

    renderCanvas();
    return count;
  }, [mode, tolerance, renderCanvas]);

  // ── Undo ────────────────────────────────────────────────────────────────────
  const saveUndo = useCallback(() => {
    const data = workingDataRef.current;
    if (!data) return;
    const copy = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), copy];
    setCanUndo(true);
  }, []);

  const handleUndo = () => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    workingDataRef.current = stack[stack.length - 1];
    undoStackRef.current   = stack.slice(0, -1);
    setCanUndo(undoStackRef.current.length > 0);
    renderCanvas();
  };

  // ── Coordinate helpers ───────────────────────────────────────────────────────
  const getNativeCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width)  * canvas.width,
      y: ((e.clientY - rect.top)  / rect.height) * canvas.height,
    };
  };

  const getDisplayCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // ── Mouse handlers ───────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (showOrig) return;
    saveUndo();
    isPaintingRef.current = true;

    if (isSmartMode) {
      const pos = getNativeCoords(e);
      const disp = getDisplayCoords(e);
      lastSmartDisplayRef.current = disp;
      setIsProcessing(true);
      // Run in next tick so the processing state renders first
      setTimeout(() => {
        const filled = floodFillAt(pos.x, pos.y);
        setLastFillPx(filled);
        setIsProcessing(false);
      }, 0);
    } else {
      const pos = getNativeCoords(e);
      lastNativePosRef.current = pos;
      applyBrushAt(pos.x, pos.y);
    }
  };

  const updateCursorEl = (x: number, y: number) => {
    const el = cursorElRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    el.style.opacity = "1";
  };
  const hideCursorEl = () => {
    const el = cursorElRef.current;
    if (el) el.style.opacity = "0";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const disp = getDisplayCoords(e);
    updateCursorEl(disp.x, disp.y);
    if (!isPaintingRef.current || showOrig || isProcessing) return;

    if (isSmartMode) {
      // Smart drag: trigger another fill when cursor moves far enough
      const last = lastSmartDisplayRef.current;
      if (last) {
        const dx = disp.x - last.x;
        const dy = disp.y - last.y;
        if (dx * dx + dy * dy >= SMART_DRAG_STEP * SMART_DRAG_STEP) {
          lastSmartDisplayRef.current = disp;
          const pos = getNativeCoords(e);
          setIsProcessing(true);
          setTimeout(() => {
            const filled = floodFillAt(pos.x, pos.y);
            setLastFillPx(filled);
            setIsProcessing(false);
          }, 0);
        }
      }
    } else {
      const pos  = getNativeCoords(e);
      const last = lastNativePosRef.current;
      if (last) paintLine(last.x, last.y, pos.x, pos.y);
      lastNativePosRef.current = pos;
    }
  };

  const stopPainting = () => {
    isPaintingRef.current       = false;
    lastNativePosRef.current    = null;
    lastSmartDisplayRef.current = null;
  };

  const handleMouseLeave = () => { stopPainting(); hideCursorEl(); };

  // ── Touch helpers ────────────────────────────────────────────────────────────
  const touchToCoords = (t: React.Touch, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    return {
      native:  { x: ((t.clientX - rect.left) / rect.width) * canvas.width,  y: ((t.clientY - rect.top) / rect.height) * canvas.height },
      display: { x: t.clientX - rect.left, y: t.clientY - rect.top },
    };
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (showOrig) return;
    saveUndo();
    isPaintingRef.current = true;
    const { native, display } = touchToCoords(e.touches[0], canvasRef.current!);

    if (isSmartMode) {
      lastSmartDisplayRef.current = display;
      setIsProcessing(true);
      setTimeout(() => {
        const filled = floodFillAt(native.x, native.y);
        setLastFillPx(filled);
        setIsProcessing(false);
      }, 0);
    } else {
      lastNativePosRef.current = native;
      applyBrushAt(native.x, native.y);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isPaintingRef.current || showOrig || isProcessing) return;
    const { native, display } = touchToCoords(e.touches[0], canvasRef.current!);
    updateCursorEl(display.x, display.y);

    if (isSmartMode) {
      const last = lastSmartDisplayRef.current;
      if (last) {
        const dx = display.x - last.x, dy = display.y - last.y;
        if (dx * dx + dy * dy >= SMART_DRAG_STEP * SMART_DRAG_STEP) {
          lastSmartDisplayRef.current = display;
          setIsProcessing(true);
          setTimeout(() => {
            const filled = floodFillAt(native.x, native.y);
            setLastFillPx(filled);
            setIsProcessing(false);
          }, 0);
        }
      }
    } else {
      const last = lastNativePosRef.current;
      if (last) paintLine(last.x, last.y, native.x, native.y);
      lastNativePosRef.current = native;
    }
  };

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleDone = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onDone(canvas.toDataURL("image/png"));
  };

  // ── Display sizing ───────────────────────────────────────────────────────────
  const { w: nw, h: nh } = nativeRef.current;
  const MAX_DISP_W = 500, MAX_DISP_H = 440;
  let dispW = MAX_DISP_W;
  let dispH = nw > 0 ? Math.round(MAX_DISP_W * nh / nw) : MAX_DISP_H;
  if (dispH > MAX_DISP_H) { dispH = MAX_DISP_H; dispW = nh > 0 ? Math.round(MAX_DISP_H * nw / nh) : MAX_DISP_W; }
  const zoomedW = Math.round(dispW * zoom);
  const zoomedH = Math.round(dispH * zoom);

  // Brush ring size in display pixels
  const displayBrushR = (!isSmartMode && nw > 0) ? brushSize * (dispW / nw) * zoom : 0;

  const eraseColor   = "#f87171";
  const restoreColor = "#34d399";
  const modeColor    = mode === "erase" ? eraseColor : restoreColor;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="bg-white shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 800, maxHeight: "95vh", borderRadius: 12 }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-sm text-gray-900">{t('Background Brush Editor')}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {isSmartMode
                ? t('Click or drag to let AI detect similar areas automatically')
                : t('Paint over the background to erase, or restore missing parts')}
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Canvas area */}
          <div className="flex-1 flex items-center justify-center bg-gray-800 overflow-auto p-5 relative">
            {isLoading ? (
              <div className="text-white text-sm animate-pulse">{t('Loading image…')}</div>
            ) : (
              <div
                ref={containerRef}
                className="relative select-none flex-shrink-0"
                style={{
                  background: "repeating-conic-gradient(#6b7280 0% 25%, #4b5563 0% 50%) 0 0 / 16px 16px",
                  cursor: "none",
                  width: zoomedW,
                  height: zoomedH,
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={nw}
                  height={nh}
                  style={{
                    display: "block",
                    width: zoomedW,
                    height: zoomedH,
                    opacity: isProcessing ? 0.75 : 1,
                    transition: "opacity 0.1s",
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={stopPainting}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={stopPainting}
                />

                {/* ── Cursor overlay (imperative — one node, style updated on pointermove) ── */}
                {!showOrig && (
                  <div
                    ref={cursorElRef}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: 0,
                      height: 0,
                      pointerEvents: "none",
                      opacity: 0,
                      willChange: "transform",
                    }}
                  >
                    {/* Brush-radius ring (hidden in smart mode where radius is not meaningful) */}
                    {!isSmartMode && (
                      <div
                        style={{
                          position: "absolute",
                          left: -displayBrushR,
                          top: -displayBrushR,
                          width: displayBrushR * 2,
                          height: displayBrushR * 2,
                          borderRadius: "50%",
                          border: `2px solid ${modeColor}`,
                          boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
                        }}
                      />
                    )}
                    {/* Brush / eraser glyph at pointer tip */}
                    <div
                      style={{
                        position: "absolute",
                        left: 2,
                        top: 2,
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "white",
                        border: `1.5px solid ${modeColor}`,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: modeColor,
                      }}
                    >
                      {mode === "erase"
                        ? <Eraser size={13} strokeWidth={2.2} />
                        : <Paintbrush size={13} strokeWidth={2.2} />}
                    </div>
                  </div>
                )}

                {/* Processing overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-xs"
                      style={{ background: "rgba(0,0,0,0.55)" }}>
                      <Loader2 size={12} className="animate-spin" />
                      {t('Analyzing area…')}
                    </div>
                  </div>
                )}

                {/* Original preview badge */}
                {showOrig && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="px-3 py-1 text-xs text-white rounded-full"
                      style={{ background: "rgba(0,0,0,0.55)" }}>
                      {t('Original Preview')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Last-fill pixel count badge */}
            {isSmartMode && lastFillPx > 0 && !isProcessing && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs text-white pointer-events-none"
                style={{ background: "rgba(0,0,0,0.45)" }}>
                {lastFillPx.toLocaleString()} px {mode === "erase" ? t("removed") : t("restored")}
              </div>
            )}
          </div>

          {/* ── Side panel ── */}
          <div className="w-[212px] shrink-0 border-l border-gray-100 bg-gray-50 flex flex-col gap-0 overflow-y-auto">

            {/* ── Smart Fill toggle ── */}
            <div className="px-4 pt-4 pb-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">{t('Brush Mode')}</p>
              <div className="flex flex-col gap-1.5">
                {/* Manual brush */}
                <button
                  onClick={() => setIsSmartMode(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs border rounded transition-colors ${
                    !isSmartMode
                      ? "border-gray-400 bg-gray-100 text-gray-800"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <Paintbrush size={12} />
                  {t('Manual Brush')}
                </button>
                {/* Smart fill */}
                <button
                  onClick={() => setIsSmartMode(true)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs border rounded transition-colors ${
                    isSmartMode
                      ? "border-[#FD312E] bg-[#FD312E]/10 text-[#FD312E]"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <Wand2 size={12} />
                  {t('AI Brush')}
                  <span className="ml-auto text-[9px] px-1 py-0.5 rounded bg-[#FD312E]/15 text-[#FD312E]">AI</span>
                </button>
              </div>
              {isSmartMode && (
                <p className="text-[10px] text-gray-400 leading-relaxed mt-1.5">
                  {t('Automatically selects connected areas with similar colors')}
                </p>
              )}
            </div>

            <div className="h-px bg-gray-100 mx-4" />

            {/* ── Mode (Erase / Restore) ── */}
            <div className="px-4 py-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">{t('Action')}</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setMode("erase")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs border rounded transition-colors ${
                    mode === "erase"
                      ? "border-red-400 bg-red-50 text-red-600"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Eraser size={12} /> {t('Erase')}
                </button>
                <button
                  onClick={() => setMode("restore")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs border rounded transition-colors ${
                    mode === "restore"
                      ? "border-emerald-400 bg-emerald-50 text-emerald-600"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Paintbrush size={12} /> {t('Restore')}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                {mode === "erase"
                  ? t('Remove remaining background')
                  : t('Restore missing subject from original')}
              </p>
            </div>

            <div className="h-px bg-gray-100 mx-4" />

            {/* ── Brush size (manual only — smart uses fixed precision) ── */}
            {!isSmartMode && (
              <div className="px-4 py-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                  {t('Brush Size')} &nbsp;·&nbsp; {brushSize}px
                </p>
                <div className="flex items-center justify-center h-9 bg-white border border-gray-200 rounded mb-2">
                  <div
                    className="rounded-full opacity-75"
                    style={{
                      width:  Math.min(32, Math.max(4, brushSize * 0.3)),
                      height: Math.min(32, Math.max(4, brushSize * 0.3)),
                      background: modeColor,
                    }}
                  />
                </div>
                <input
                  type="range" min={4} max={160} value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full accent-[#FD312E]"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>4</span><span>160</span>
                </div>
              </div>
            )}

            <div className="h-px bg-gray-100 mx-4" />

            {/* ── Zoom ── */}
            <div className="px-4 py-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                {t('Zoom')} &nbsp;·&nbsp; {zoom.toFixed(1)}×
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.5).toFixed(1)))}
                  disabled={zoom <= 0.5}
                  className="p-1.5 border border-gray-200 bg-white rounded hover:bg-gray-100 transition-colors text-gray-600 disabled:opacity-30"
                >
                  <ZoomOut size={12} />
                </button>
                <input
                  type="range" min={0.5} max={5} step={0.5} value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-[#FD312E]"
                />
                <button
                  onClick={() => setZoom((z) => Math.min(5, +(z + 0.5).toFixed(1)))}
                  disabled={zoom >= 5}
                  className="p-1.5 border border-gray-200 bg-white rounded hover:bg-gray-100 transition-colors text-gray-600 disabled:opacity-30"
                >
                  <ZoomIn size={12} />
                </button>
              </div>
            </div>

            <div className="h-px bg-gray-100 mx-4" />

            {/* ── Undo + Compare ── */}
            <div className="px-4 py-3 flex flex-col gap-2">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
              >
                <RotateCcw size={12} />
                {t('Undo')}
              </button>
              <button
                onPointerDown={() => setShowOrig(true)}
                onPointerUp={() => setShowOrig(false)}
                onPointerLeave={() => setShowOrig(false)}
                className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 rounded transition-colors select-none"
              >
                {t('Compare Original (Hold)')}
              </button>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 flex items-center justify-between border-t border-gray-100 bg-white shrink-0">
          <p className="text-xs text-gray-400">{t('Proceeds to crop after completion')}</p>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 transition-colors rounded"
            >
              {t('Cancel')}
            </button>
            <button
              onClick={handleDone}
              disabled={isLoading || isProcessing}
              className="px-4 py-2 text-sm bg-[#FD312E] text-white hover:bg-[#8b0029] disabled:bg-gray-400 transition-colors flex items-center gap-1.5 rounded"
            >
              <Check size={14} />
              {t('Done → Crop')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
