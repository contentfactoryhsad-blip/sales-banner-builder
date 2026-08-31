import type { BannerState } from '../types';
import { getPromotion, promoPair } from '../../data/promotions';
import { resolveBackground } from '../../data/builderOptions';
import { NEUTRAL_BANNER_COLORS } from '../utils/color';
import { GradientMapBackground } from './GradientMapBackground';
import { HEADLINE_FONT } from '../../data/sizeLayouts';

const TEMPLATE_W = 1200;
const TEMPLATE_H = 628;
const LEFT_W = 588; // 좌패널 폭 (Figma A/B 공통 ≈ 49%)

/**
 * 1200×628 배너 미리보기 — Figma "Claude" 페이지 A/B 프레임 반영.
 * A안 = 검정 좌패널 · 흰 글씨 · 흰 LG로고,  B안 = 흰 좌패널 · 검정 글씨 · 컬러 LG로고.
 * 우측 KV = 프로모션 색 그라데이션 + Background Type 그레이 텍스처(overlay tint), 공통 스트레이트 분할.
 */
export function PreviewPanel({ state, displayWidth = 520 }: { state: BannerState; displayWidth?: number }) {
  const promo = state.promotionId ? getPromotion(state.promotionId) : undefined;
  const { main, secondary } = promo
    ? (() => { const q = promoPair(promo, state.colorSet); return { main: q.main.hex, secondary: q.secondary.hex }; })()
    : NEUTRAL_BANNER_COLORS;
  const scale = displayWidth / TEMPLATE_W;

  const isA = state.designType === 'A';
  const leftBg = isA ? '#000000' : '#ffffff';
  const primaryCol = isA ? '#ffffff' : '#1a1a1a';
  const subCol = isA ? 'rgba(255,255,255,0.92)' : '#4a4946';
  const discCol = isA ? '#ffffff' : '#4a4946';
  const discShadow = isA ? '0 0 30px rgba(255,255,255,0.6)' : 'none';
  const logoSrc = isA ? '/lg-logo-white.svg' : '/lg-logo.svg';

  const texture = resolveBackground(state.designType, state.backgroundTypeId).texture;

  const boxBg =
    state.boxStyleId === 'white' ? '#ffffff' : 'rgba(255,255,255,0.28)'; // glass

  return (
    <div
      style={{ width: displayWidth, height: TEMPLATE_H * scale }}
      className="relative overflow-hidden shadow-lg ring-1 ring-black/5 shrink-0"
    >
      <div
        style={{
          width: TEMPLATE_W,
          height: TEMPLATE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
          background: leftBg,
        }}
      >
        {/* ── 우측 KV 배경 ──
            색 없음: 흑백 원본 / overlay: 그라데이션+텍스처 overlay / gradient: 그라데이션 맵 LUT */}
        <div style={{ position: 'absolute', left: LEFT_W, top: 0, width: TEMPLATE_W - LEFT_W, height: TEMPLATE_H, overflow: 'hidden', background: promo && state.colorMode === 'overlay' ? `linear-gradient(115deg, ${main} 0%, ${secondary} 100%)` : '#000' }}>
          {!promo ? (
            <img src={texture} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
          ) : state.colorMode === 'gradient' ? (
            <GradientMapBackground texture={texture} main={main} secondary={secondary} />
          ) : (
            <img src={texture} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'overlay', opacity: 0.9 }} draggable={false} />
          )}
        </div>

        {/* 프로모션 명칭 (KV 큰 텍스트) — 폰트는 Edit > Promotion Name에서 선택 */}
        {state.promoName && (
          <div style={{ position: 'absolute', right: 56, top: 56, fontSize: 92, lineHeight: '0.96', fontFamily: HEADLINE_FONT, fontWeight: 700, color: 'rgba(255,255,255,0.94)', textAlign: 'right', maxWidth: 560, textShadow: '0 2px 30px rgba(0,0,0,0.15)' }}>
            {state.promoName}
          </div>
        )}

        {/* 제품 박스 그리드 */}
        {!!state.boxCount && (
          <div style={{ position: 'absolute', right: 64, bottom: 72, width: 470, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {Array.from({ length: state.boxCount }).map((_, i) => (
              <div key={i} style={{ aspectRatio: '1', borderRadius: 16, background: boxBg, border: '1px solid rgba(255,255,255,0.5)', backdropFilter: state.boxStyleId === 'glass' ? 'blur(6px)' : undefined, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {state.products[i] && (
                  <img src={state.products[i]!} alt={`Product ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 16 }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── 좌측 패널 (A: 검정 / B: 흰색) ── */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: LEFT_W, height: TEMPLATE_H, background: leftBg }}>
          <img src={logoSrc} alt="LG" style={{ position: 'absolute', left: 40, top: 30, height: 50 }} draggable={false} />

          {/* Copy + CTA — auto-layout(flex) */}
          <div style={{ position: 'absolute', left: 40, top: 108, width: 486, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {state.showHeadline && state.headline && (
                <p className="font-lgei" style={{ fontSize: 52, lineHeight: 1.06, fontWeight: 600, color: primaryCol }}>{state.headline}</p>
              )}
              {state.showSubcopy && state.subcopy && (
                <p style={{ fontFamily: '"LGEI Text", sans-serif', fontSize: 29, lineHeight: 1.1, letterSpacing: '-0.58px', color: subCol }}>{state.subcopy}</p>
              )}
            </div>
            <div style={{ background: '#fd312e', borderRadius: 16, padding: '14px 25px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}>
              <span style={{ fontFamily: '"LGEI Text", sans-serif', fontSize: 20.79, color: '#fff', whiteSpace: 'nowrap' }}>{state.ctaText.trim() || 'Shop now'}</span>
            </div>
          </div>

          {/* Disclaimer */}
          <p style={{ position: 'absolute', left: 40, bottom: 20, fontFamily: '"LGEI Text", sans-serif', fontSize: 20, color: discCol, textShadow: discShadow }}>
            *T&C's apply
          </p>
        </div>
      </div>
    </div>
  );
}
