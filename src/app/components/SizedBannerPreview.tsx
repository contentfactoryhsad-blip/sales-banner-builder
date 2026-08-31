import type { BannerState } from '../types';
import { getPromotion, promoPair } from '../../data/promotions';
import { resolveBackground } from '../../data/builderOptions';
import { NEUTRAL_BANNER_COLORS } from '../utils/color';
import { GradientMapBackground } from './GradientMapBackground';
import {
  BODY_FONT, GLASS_FILL, GLASS_STROKE, HEADLINE_FONT, HEADLINE_WEIGHT,
  GRAPHIC_OPACITY_BY_KIND, STICKER_FILL, STICKER_FONT, STICKER_LAYOUT, ctaRadius, getGlass, glassToCss, shadeGradient, type SizeLayout,
} from '../../data/sizeLayouts';
import { MAX_DISCOUNT, MIN_BOX_COUNT, MIN_DISCOUNT, graphicSrc as graphicSrcOf, hasGraphic } from '../../data/builderOptions';

/**
 * 매체 사이즈별 배너 렌더러 — Figma Banner Template(Criteo) 실측 스펙 기반.
 *
 * 레이어 순서(Figma와 동일): 배경 → 하단 셰이드 → 장식 그래픽 → 로고 →
 * 제품 그리드 → 카피/CTA → 스티커 → 디스클레이머.
 * (160x600·120x600은 graphicsOnTop이라 장식 그래픽이 맨 위로 간다)
 *
 * 모든 좌표는 프레임 네이티브 px이고, 바깥 wrapper가 transform: scale()로 축소한다.
 */
export function SizedBannerPreview({
  state,
  layout,
  displayWidth,
}: {
  state: BannerState;
  layout: SizeLayout;
  displayWidth: number;
}) {
  const promo = state.promotionId ? getPromotion(state.promotionId) : undefined;
  const { main, secondary } = promo
    ? (() => { const q = promoPair(promo, state.colorSet); return { main: q.main.hex, secondary: q.secondary.hex }; })()
    : NEUTRAL_BANNER_COLORS;

  const scale = displayWidth / layout.w;
  const texture = resolveBackground(state.designType, state.backgroundTypeId).texture;

  const glassCss = glassToCss(getGlass(layout));
  const { copy, grid } = layout;

  // 선택한 박스 개수를 실시간 반영. 셀 크기는 Figma 값 그대로 두고
  // 필요 없는 줄만 접어서 그리드 높이를 줄인다(빈 줄이 남지 않게).
  const maxCells = grid.cols * grid.rows;
  const cells = Math.min(Math.max(state.boxCount ?? MIN_BOX_COUNT, MIN_BOX_COUNT), maxCells);
  const cellH = (grid.h - (grid.rows - 1) * grid.gapY) / grid.rows;
  const usedRows = Math.max(1, Math.ceil(cells / grid.cols));
  const gridH = usedRows * cellH + (usedRows - 1) * grid.gapY;

  const showGraphics = hasGraphic(state.graphicId);
  const graphicSrc = graphicSrcOf(state.graphicId, state.graphicKind);
  const stickerGlass = state.stickerStyle === 'glass';
  const discount = Math.min(MAX_DISCOUNT, Math.max(MIN_DISCOUNT, state.discount));

  // 장식 그래픽 (mix-blend-overlay)
  const graphics = layout.graphics.length > 0 && (
    <>
      {layout.graphics.map((g, i) => (
        <img
          key={i}
          src={graphicSrc}
          alt=""
          draggable={false}
          style={{
            position: 'absolute', left: g.x, top: g.y, width: g.w, height: g.h,
            objectFit: 'cover', mixBlendMode: 'overlay', opacity: GRAPHIC_OPACITY_BY_KIND[state.graphicKind], pointerEvents: 'none',
          }}
        />
      ))}
    </>
  );

  return (
    <div
      style={{ width: displayWidth, height: layout.h * scale }}
      className="relative overflow-hidden shrink-0"
    >
      <div
        style={{
          width: layout.w,
          height: layout.h,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'hidden',
          background: state.colorMode === 'overlay'
            ? `linear-gradient(160deg, ${main} 0%, ${secondary} 100%)`
            : '#000',
        }}
      >
        {/* ── 배경 텍스처 (Figma "Sales Template BG" 배치 그대로, 프로모션 색으로 tint) ── */}
        <div style={{ position: 'absolute', left: layout.bg.x, top: layout.bg.y, width: layout.bg.w, height: layout.bg.h }}>
          {state.colorMode === 'gradient' ? (
            <GradientMapBackground texture={texture} main={main} secondary={secondary} />
          ) : (
            <img src={texture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'overlay', opacity: 0.9 }} draggable={false} />
          )}
        </div>

        {/* 셰이드 — 방향은 사이즈별(카피가 놓인 쪽을 어둡게) */}
        <div style={{ position: 'absolute', inset: 0, background: shadeGradient(layout.shade) }} />

        {!layout.graphicsOnTop && graphics}

        {/* LG 로고 */}
        <img
          src="/lg-logo-white.svg"
          alt="LG"
          draggable={false}
          style={{ position: 'absolute', left: layout.logo.x, top: layout.logo.y, width: layout.logo.w, height: layout.logo.h }}
        />

        {/* ── 제품 글래스 박스 그리드 ── */}
        <div
          style={{
            position: 'absolute',
            left: grid.x,
            top: grid.y,
            width: grid.w,
            height: gridH,
            display: 'grid',
            gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${usedRows}, minmax(0, 1fr))`,
            columnGap: grid.gapX,
            rowGap: grid.gapY,
          }}
        >
          {Array.from({ length: cells }).map((_, i) => (
            <div
              key={i}
              style={{
                background: GLASS_FILL,
                border: `${layout.box.borderWidth}px solid ${GLASS_STROKE}`,
                borderRadius: layout.box.radius,
                boxShadow: `0px ${layout.box.shadow}px ${layout.box.shadow}px 0px rgba(0,0,0,0.07), ${glassCss.innerLight}`,
                backdropFilter: glassCss.backdropFilter,
                WebkitBackdropFilter: glassCss.WebkitBackdropFilter,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {state.products[i] && (
                <img src={state.products[i]!} alt={`Product ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10%' }} draggable={false} />
              )}
            </div>
          ))}
        </div>

        {/* ── 카피 + CTA ── */}
        <div
          style={{
            position: 'absolute',
            left: copy.x,
            top: copy.top,
            ...(copy.anchor === 'center' ? { transform: 'translateX(-50%)' } : null),
            // width가 null이면 Figma처럼 내용에 맞춰 늘어난다(hug). 다만 사용자가 긴 문구를
            // 넣으면 프레임 밖으로 넘치므로, 캔버스 안에 머무는 선까지만 허용하고 그 뒤로는 줄바꿈.
            ...(copy.width !== null
              ? { width: copy.width }
              : { maxWidth: 2 * Math.min(copy.x, layout.w - copy.x) }),
            paddingLeft: copy.padX,
            paddingRight: copy.padX,
            opacity: copy.opacity,
            display: 'flex',
            flexDirection: 'column',
            alignItems: copy.align === 'center' ? 'center' : 'flex-start',
            gap: copy.gap,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: copy.align === 'center' ? 'center' : 'flex-start',
              gap: copy.innerGap,
              width: '100%',
              color: '#ffffff',
              textAlign: copy.align,
            }}
          >
            {/* 헤드라인 블록 = 프로모션 명칭 + 헤드라인 2줄 (Figma가 한 덩어리로 균일 조판) */}
            <div
              style={{
                fontFamily: HEADLINE_FONT,
                fontWeight: HEADLINE_WEIGHT,
                fontSize: copy.headlineSize,
                letterSpacing: copy.headlineTracking || undefined,
                lineHeight: 1.06,
                maxHeight: copy.headlineMaxH,
                overflow: 'hidden',
                width: '100%',
              }}
            >
              {state.promoName && <p style={{ margin: 0 }}>{state.promoName}</p>}
              {state.showHeadline && state.headline && <p style={{ margin: 0 }}>{state.headline}</p>}
            </div>

            {/* 서브카피 — 이 사이즈에 있을 때만 (소형 사이즈엔 Figma에도 없음) */}
            {copy.sub && state.showSubcopy && state.subcopy && (
              <p
                style={{
                  margin: 0,
                  fontFamily: BODY_FONT,
                  fontSize: copy.sub.size,
                  letterSpacing: copy.sub.tracking || undefined,
                  lineHeight: 1.06,
                  maxHeight: copy.sub.maxH,
                  overflow: 'hidden',
                  width: '100%',
                }}
              >
                {state.subcopy}
              </p>
            )}
          </div>

          <div
            style={{
              background: '#fd312e',
              height: layout.cta.h,
              paddingLeft: layout.cta.padX,
              paddingRight: layout.cta.padX,
              borderRadius: ctaRadius(layout.cta),
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontFamily: BODY_FONT, fontSize: layout.cta.fontSize, color: '#fff', whiteSpace: 'nowrap' }}>
              {state.ctaText.trim() || 'Shop now'}
            </span>
          </div>
        </div>

        {/* ── 할인율 스티커 — SVG <text>의 y가 곧 베이스라인이라 측정 좌표에 정확히 앉는다 ── */}
        <div
          style={{
            position: 'absolute',
            left: layout.sticker.x,
            top: layout.sticker.y,
            width: layout.sticker.size,
            height: layout.sticker.size,
            borderRadius: '50%',
            ...(stickerGlass
              ? {
                  background: GLASS_FILL,
                  border: `${layout.box.borderWidth}px solid ${GLASS_STROKE}`,
                  boxShadow: `0px ${layout.box.shadow}px ${layout.box.shadow}px 0px rgba(0,0,0,0.07), ${glassCss.innerLight}`,
                  backdropFilter: glassCss.backdropFilter,
                  WebkitBackdropFilter: glassCss.WebkitBackdropFilter,
                }
              : { background: STICKER_FILL }),
            boxSizing: 'border-box',
          }}
        >
          <svg
            viewBox={`0 0 ${STICKER_LAYOUT.circle} ${STICKER_LAYOUT.circle}`}
            width={layout.sticker.size}
            height={layout.sticker.size}
            style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
          >
            <text x={STICKER_LAYOUT.label.cx} y={STICKER_LAYOUT.label.baseline} textAnchor="middle" fill="#fff"
              style={{ fontFamily: HEADLINE_FONT, fontWeight: HEADLINE_WEIGHT, fontSize: STICKER_LAYOUT.label.size }}>
              UP TO
            </text>
            <text x={STICKER_LAYOUT.number.cx} y={STICKER_LAYOUT.number.baseline} textAnchor="middle" fill="#fff"
              style={{ fontFamily: STICKER_FONT, fontSize: STICKER_LAYOUT.number.size, letterSpacing: STICKER_LAYOUT.number.tracking }}>
              {discount}
            </text>
            <text x={STICKER_LAYOUT.percent.cx} y={STICKER_LAYOUT.percent.baseline} textAnchor="middle" fill="#fff"
              style={{ fontFamily: STICKER_FONT, fontSize: STICKER_LAYOUT.percent.size }}>
              %
            </text>
            <text x={STICKER_LAYOUT.off.cx} y={STICKER_LAYOUT.off.baseline} textAnchor="middle" fill="#fff"
              style={{ fontFamily: STICKER_FONT, fontSize: STICKER_LAYOUT.off.size }}>
              off
            </text>
          </svg>
        </div>

        {/* 디스클레이머 */}
        <p
          style={{
            position: 'absolute',
            left: layout.disclaimer.padX,
            bottom: layout.disclaimer.padBottom,
            margin: 0,
            fontFamily: BODY_FONT,
            fontSize: layout.disclaimer.fontSize,
            color: '#ffffff',
            textShadow: '0px 0px 30px rgba(255,255,255,0.6), 0px 0px 10px rgba(255,255,255,0.4)',
          }}
        >
          *T&amp;C&rsquo;s apply
        </p>

        {layout.graphicsOnTop && graphics}
      </div>
    </div>
  );
}
