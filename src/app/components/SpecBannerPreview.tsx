import { useMemo } from 'react';
import type { BannerState } from '../types';
import { getPromotion } from '../../data/promotions';
import { graphicSrc as graphicSrcOf, hasGraphic, MAX_DISCOUNT, MIN_DISCOUNT } from '../../data/builderOptions';
import { DEFAULT_BOX_STYLE, MIN_BOX_COUNT, resolveBackground, resolveStickerStyle } from '../../data/builderOptions';
import { deriveBannerColors, hexToHsl, hslToHex, NEUTRAL_BANNER_COLORS } from '../utils/color';
import { fitScale, useFontsReady } from '../utils/textFit';
import { GradientMapBackground } from './GradientMapBackground';
import type { FigmaFrameSpec } from '../../data/figmaSpec';
import { BOX_MATERIALS, DESIGN_STYLES, discPad, graphicRects, headAlign, headLines, headNoWrap, productRects, promoBreak, resolveBoxCount, shadeCss, specKey, type DesignKind } from '../../data/figmaStyle';
import {
  BODY_FONT, GRAPHIC_OPACITY_BY_KIND, HEADLINE_FONT, HEADLINE_WEIGHT,
  GLASS_DEFAULT, STICKER_FILL, STICKER_FONT, STICKER_RED, STICKER_TXT_CENTER, STICKER_LAYOUT, glassToCss,
} from '../../data/sizeLayouts';

/**
 * Figma 실측 스펙(figmaSpec.*) 기반 배너 렌더러.
 *
 * 좌표는 전부 프레임 네이티브 px이고, 바깥 wrapper 가 transform: scale() 로 축소한다.
 * 박스는 그리드가 아니라 **사각형 목록**을 그대로 그린다 — Figma 배치가 균일 그리드가
 * 아니기 때문(5개 버전의 아래줄 가운데정렬, 마지막 칸 가로 병합 등).
 *
 * 레이어 순서(Figma 동일): 배경 → 셰이드 → 장식도형 → 로고 → 박스 → 카피/CTA → 스티커 → 디스클레이머
 */
/**
 * 배경 블러 (CSS px, 프레임 네이티브 기준).
 *
 * Figma 의 blur 반지름과 CSS blur() 는 단위가 다르다 — CSS 는 표준편차이고
 * Figma 반지름은 그 2배라, Figma 값 35 를 그대로 넣으면 두 배로 뭉갠다.
 * (측정: B 배경을 PNG 로 내려받아 파워스펙트럼 회귀 → 실제 σ ≈ 17.5 = 35/2)
 *
 * Figma 와 같아지는 계산값 17.5 를 넣어둔다. 이 숫자 하나만 바꾸면 된다.
 * A 시안은 Figma 에서 블러가 0 이라 이 값과 무관하게 그대로 선명하다.
 */
const BG_BLUR_PX = 17.5;

/**
 * 헤드라인 줄바꿈 폭 여유.
 *
 * Figma 에 저장된 헤드라인 폭은 Figma 자체 텍스트 엔진이 잰 결과다. 브라우저는
 * 같은 폰트·크기에서도 약 1% 넓게 잡아, 폭이 딱 맞는 사이즈에서 줄이 하나 더 접힌다
 * (예: dv360-336x280 은 상자 212 에 214.5 가 필요해 "…Save on LG / favorites" 로 깨졌다).
 *
 * 폰트 메트릭(LGEIHeadlineTTF-Semibold)으로 전 사이즈를 재서 안전 구간을 구했다:
 *   · Figma 가 한 줄에 넣은 것 중 가장 빡빡한 줄 = 101.2%  → 여유는 1.2% 보다 커야 하고
 *   · Figma 가 접은 줄 중 가장 여유 있는 줄 = 106.4%       → 6.4% 보다 작아야 한다
 * 그 가운데인 3% 를 쓴다. 접혀야 할 줄은 그대로 접힌다.
 */
const HEAD_WRAP_TOLERANCE = 1.03;

/**
 * 프로모션 명칭의 꼬리말 축소 배율.
 *
 * "Back To School – Spring / – Autumn" 두 개만 이름이 길어 배너에서 줄바꿈된다.
 * 뒤쪽 계절만 작게 한다. 마침표는 원래 크기로 앞말에 붙이고 뒤에 한 칸 — "Back To School. Autumn".
 *
 * 폰트 메트릭으로 전 사이즈를 재서 정한 값이다. 0.6 이면 접히던 13개 중
 * 1200x628 · 1200x1200 · 300x600 · 320x100 · 120x240 등 7개가 한 줄로 들어온다.
 * 나머지 6개(160x600 · 120x600 · 120x60 · 300x1050 등)는 "Back To School" 만으로도
 * 상자를 넘어서 어떤 배율로도 불가능하다 — 거긴 그대로 접힌다.
 * 그중 300x1050 만은 접지 않는다: 끊는 위치를 명시하고(promoBreak) 앞말은
 * 폭에 맞춰 줄인다(fitScale). 이 배율은 뒷말에만 쓴다.
 */
const PROMO_TAIL_SCALE = 0.6;

/** 별 스티커 회전(rad). Figma 기준 15°. */
const STAR_ROT = (15 * Math.PI) / 180;

/**
 * 글래스 스티커가 밝은 배경에서 묻히는 걸 막는 값.
 *
 * B 는 셰이드가 흰색이라 흰 반투명 스티커가 배경에 묻힌다. 그라데이션은 손대지 않고
 * 스티커 **자기 뒤쪽만** brightness 로 눌러준다 (1 = 그대로).
 * 테두리 두께·색은 A 와 동일하게 두고 여기서만 조절한다 — 선을 덧대면 A 와 달라 보인다.
 */
const STICKER_GLASS_DARKEN = 0.9;

/** 프로모션 명칭에서 앞말(마침표 포함)만 뽑는다 — 폭을 잴 때 쓴다. */
function promoHead(name: string) {
  const i = name.indexOf(' – ');
  return i < 0 ? name : `${name.slice(0, i)}.`;
}

/**
 * 프로모션 명칭을 그린다. " – " 는 원래 크기 마침표로, 뒤쪽 단어만 작게.
 * `br` 이면 뒷단어를 **자기 줄**로 내린다 (promoBreak 사이즈).
 * `k` 는 앞말을 한 줄에 넣기 위한 축소 배율 — 1 이면 손대지 않는다.
 */
function promoNameNodes(name: string, br: boolean, k: number) {
  const i = name.indexOf(' – ');
  const lead = i < 0 ? name : name.slice(0, i) + (br ? '.' : '. ');
  // 재서 맞춘 폭이므로 여기서 접히면 안 된다 — 접는 대신 줄이는 게 이 배율의 목적이다.
  const head = k < 1
    ? <span style={{ fontSize: `${k}em`, whiteSpace: 'nowrap' }}>{lead}</span>
    : lead;
  if (i < 0) return <p style={{ margin: 0 }}>{head}</p>;
  const tail = name.slice(i + 3);
  if (!br) {
    return <p style={{ margin: 0 }}>{head}<span style={{ fontSize: `${PROMO_TAIL_SCALE}em` }}>{tail}</span></p>;
  }
  /*
    뒷말을 <br> 이 아니라 **별도 문단**으로 내린다.
    같은 줄에 두면 줄 높이가 본문(36px)의 것을 그대로 써서 한 줄이 38px 늘어나고,
    Figma 가 3줄(114px)로 잡아둔 카피가 CTA(138px) 를 밀고 들어간다.
    제 문단이면 22.9px 만 차지해 4줄이어도 CTA 위에서 끝난다.
  */
  return (
    <>
      <p style={{ margin: 0 }}>{head}</p>
      <p style={{ margin: 0, fontSize: `${PROMO_TAIL_SCALE}em` }}>{tail}</p>
    </>
  );
}

export function SpecBannerPreview({
  state, spec, design, channel, size, displayWidth,
}: {
  state: BannerState;
  spec: FigmaFrameSpec;
  design: DesignKind;
  channel: string;
  size: string;
  displayWidth: number;
}) {
  const key = specKey(channel, size);
  const [FW, FH] = spec.f;
  const scale = displayWidth / FW;
  const style = DESIGN_STYLES[design];

  const promo = state.promotionId ? getPromotion(state.promotionId) : undefined;
  const { main, secondary } = promo
    ? deriveBannerColors(promo.main.hex, promo.secondary.hex, state.mainHue, state.secondaryHue)
    : NEUTRAL_BANNER_COLORS;

  const texture = resolveBackground(state.designType, state.backgroundTypeId).texture;
  const showGraphics = hasGraphic(state.graphicId);
  const graphicSrc = graphicSrcOf(state.graphicId, state.graphicKind);

  const glassCss = glassToCss(GLASS_DEFAULT);
  const discount = Math.min(MAX_DISCOUNT, Math.max(MIN_DISCOUNT, state.discount));

  // 박스 — 요청 개수에 해당하는 버전(없으면 가장 가까운 것)
  // 개수를 고르기 전엔 박스를 아예 그리지 않는다. 자리 계산만 기본값으로 해둔다.
  const showBoxes = state.boxCount != null;
  const boxKey = resolveBoxCount(spec, state.boxCount ?? MIN_BOX_COUNT);
  const [bx, by, rects] = spec.box[boxKey];
  const prods = productRects(key, boxKey);

  const inn = spec.in;
  const hAlign = headAlign(key);
  const noWrap = headNoWrap(design, key);
  /*
    끊기로 한 사이즈는 프로모션 앞말이 반드시 한 줄이어야 한다.
    지금 카피 폭 288px 이면 가장 긴 "Back To School."(245px @36px)도 들어가 배율은 1 이지만,
    더 긴 명칭이 생기면 접는 대신 넘친 만큼만 줄이도록 재둔다.
  */
  const promoBrk = promoBreak(key);
  const fontsReady = useFontsReady();
  const promoK = useMemo(
    () => (promoBrk && inn.head && state.promoName
      ? fitScale(promoHead(state.promoName), inn.head[4], HEADLINE_WEIGHT, HEADLINE_FONT, inn.head[2])
      : 1),
    // fontsReady 는 웹폰트가 붙은 뒤 다시 재게 하는 신호다
    [promoBrk, inn.head, state.promoName, fontsReady],
  );
  // Figma letterSpacing 은 PERCENT 단위다. 숫자를 그대로 넘기면 CSS 가 px 로 읽어 크게 벌어진다.
  const headLs = inn.head && inn.head[5] ? (inn.head[4] * inn.head[5]) / 100 : undefined;
  const dpad = discPad(key);
  // Edit 에서 고른 값이 우선. 미선택이면 시안 기본값.
  const boxMat = BOX_MATERIALS[state.boxStyleId ?? DEFAULT_BOX_STYLE[design]] ?? BOX_MATERIALS.glass;
  const stickerKind = resolveStickerStyle(design, state.stickerStyle);
  /*
    레드 스티커 색. Edit 의 Hue 슬라이더가 기준 빨강을 회전시킨다.
    채도·명도는 그대로 두고 색상만 돌려, 어떤 각도에서도 원래 톤을 유지한다.
    (원형은 반투명 STICKER_FILL 이라 알파를 살려 다시 조립한다)
  */
  const redHex = (() => {
    if (state.stickerHue === null) return STICKER_RED;
    const { s: sat, l } = hexToHsl(STICKER_RED);
    return hslToHex(state.stickerHue, sat, l);
  })();
  const circleFill = (() => {
    if (state.stickerHue === null) return STICKER_FILL;
    const m = STICKER_FILL.match(/rgba?\(([^)]+)\)/);
    const alpha = m ? Number(m[1].split(',')[3] ?? 1) : 1;
    const base = hexToHsl(STICKER_FILL.startsWith('rgba') ? '#ef6464' : STICKER_FILL);
    const hex = hslToHex(state.stickerHue, base.s, base.l);
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  })();

  return (
    <div style={{ width: displayWidth, height: FH * scale }} className="relative overflow-hidden shrink-0">
      <div
        style={{
          width: FW, height: FH, transform: `scale(${scale})`, transformOrigin: 'top left',
          position: 'absolute', top: 0, left: 0, overflow: 'hidden',
          background: promo && state.colorMode === 'overlay'
            ? `linear-gradient(160deg, ${main} 0%, ${secondary} 100%)` : '#000',
        }}
      >
        {/* 배경 — Figma 배치 그대로, 프로모션 색으로 tint. B 는 레이어 블러. */}
        {spec.bg && (
          <div style={{
            position: 'absolute', left: spec.bg[0], top: spec.bg[1], width: spec.bg[2], height: spec.bg[3],
            filter: spec.bg[4] && BG_BLUR_PX ? `blur(${BG_BLUR_PX}px)` : undefined,
          }}>
            {/* 프로모션 미선택 = 입힐 색이 없다. Figma 처럼 흑백 텍스처를 그대로 두고
                그 위에 셰이드 그라데이션만 얹는다. 무채색을 합성하면 오히려 달라진다. */}
            {!promo ? (
              <img src={texture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
            ) : state.colorMode === 'gradient' ? (
              <GradientMapBackground texture={texture} main={main} secondary={secondary} />
            ) : (
              <img src={texture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: style.textureBlend, opacity: style.textureOpacity, filter: style.textureFilter }} draggable={false} />
            )}
          </div>
        )}

        {/* 셰이드 (A=검정 / B=흰색, 스톱은 사이즈별 실측) */}
        {spec.gr && <div style={{ position: 'absolute', inset: 0, mixBlendMode: style.shadeBlend, background: shadeCss(spec.gr, design, key, style.shadeOpacity) }} />}

        {/* 장식 도형 */}
        {showGraphics && graphicRects(key).map(([x, y, w, h], i) => (
          <img key={i} src={graphicSrc} alt="" draggable={false}
            style={{ position: 'absolute', left: x, top: y, width: w, height: h, objectFit: 'cover',
                     mixBlendMode: 'overlay', opacity: GRAPHIC_OPACITY_BY_KIND[state.graphicKind], pointerEvents: 'none' }} />
        ))}

        {/* LG 로고 */}
        {inn.logo && (
          <img src={style.logo} alt="LG" draggable={false}
            style={{ position: 'absolute', left: inn.logo[0], top: inn.logo[1], width: inn.logo[2], height: inn.logo[3] }} />
        )}

        {/* ── 제품 박스 ── */}
        {showBoxes && rects.map(([x, y, w, h, r], i) => {
          const sw = boxMat.strokeRatio * w;
          const sh = boxMat.shadowRatio * w;
          return (
            <div key={i}
              style={{
                position: 'absolute', left: bx + x, top: by + y, width: w, height: h,
                background: boxMat.fill,
                border: boxMat.stroke ? `${sw}px solid ${boxMat.stroke}` : undefined,
                borderRadius: r,
                boxShadow: `0px ${sh}px ${sh}px 0px rgba(0,0,0,0.07)${boxMat.glass ? `, ${glassCss.innerLight}` : ''}`,
                backdropFilter: boxMat.glass ? glassCss.backdropFilter : undefined,
                WebkitBackdropFilter: boxMat.glass ? glassCss.WebkitBackdropFilter : undefined,
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              {state.products[i] && (() => {
                /*
                  Figma 가 박스마다 잡아둔 제품 자리.

                  단, 일부 칸은 제품 자리가 박스보다 크게 잡혀 있다
                  (criteo/pmax-1200x628 의 3개짜리 1번칸이 1.34배로 가장 심하고,
                   meta-398x208·criteo-320x480 등 12칸이 해당).
                  그 칸만 제품이 박스 밖으로 흘러 치우쳐 보이므로, 다른 칸들과 같게
                  **박스 안에 들어오도록** 비율을 유지한 채 줄이고 박스 중앙에 놓는다.
                */
                const pr = prods[i];
                let box: { left: number; top: number; width: number; height: number } | null = null;
                if (pr) {
                  // 크기만 Figma 에서 가져오고 **위치는 항상 박스 중앙**으로 둔다.
                  // Figma 자리값은 58칸이 박스 중심에서 최대 12.5px 어긋나 있어서,
                  // 그대로 쓰면 칸마다 제품이 미묘하게 삐뚤어 보인다.
                  const k = Math.min(1, w / pr[2], h / pr[3]);
                  const pw = pr[2] * k, ph = pr[3] * k;
                  box = { left: (w - pw) / 2, top: (h - ph) / 2, width: pw, height: ph };
                }
                return (
                  <img src={state.products[i]!} alt={`Product ${i + 1}`} draggable={false}
                    style={box
                      ? { position: 'absolute', ...box, objectFit: 'contain' }
                      : { width: '100%', height: '100%', objectFit: 'contain', padding: '10%' }} />
                );
              })()}
            </div>
          );
        })}

        {/* ── 카피 + CTA ── (copy 블록은 프레임 기준, 내부는 블록 기준) */}
        {inn.copy && (
          <div style={{ position: 'absolute', left: inn.copy[0], top: inn.copy[1], width: inn.copy[2], color: style.text }}>
            {inn.head && (
              <div style={{
                position: 'absolute', left: inn.head[0], top: inn.head[1],
                /*
                  Figma 의 WIDTH_AND_HEIGHT 는 글자에 맞춰 상자가 늘어나는 모드다.
                  저장된 폭은 제약이 아니라 **결과값**이라, 그 폭에 가두고 잘라내면
                  웹폰트가 조금만 넓어도 뒷글자가 잘린다(dv360-336x280 "…Save on LG" 처럼).
                  줄바꿈 없는 사이즈는 폭을 글자에 맡기고, 어느 쪽이든 잘라내지 않는다.
                */
                width: noWrap ? 'max-content' : inn.head[2] * HEAD_WRAP_TOLERANCE,
                // 폭을 넓힌 만큼 가운데정렬이 틀어지지 않게 절반만 왼쪽으로 당긴다
                marginLeft: noWrap || hAlign !== 'center'
                  ? undefined : -(inn.head[2] * (HEAD_WRAP_TOLERANCE - 1)) / 2,
                fontFamily: HEADLINE_FONT, fontWeight: HEADLINE_WEIGHT,
                fontSize: inn.head[4], letterSpacing: headLs,
                lineHeight: 1.06, textAlign: hAlign,
                whiteSpace: noWrap ? 'nowrap' : undefined,
              }}>
                {state.promoName && promoNameNodes(state.promoName, promoBrk, promoK)}
                {state.showHeadline && state.headline && headLines(design, key, state.headline).map((ln, i) => (
                  <p key={i} style={{ margin: 0 }}>{ln}</p>
                ))}
              </div>
            )}
            {inn.sub && state.showSubcopy && state.subcopy && (
              <p style={{
                position: 'absolute', left: inn.sub[0], top: inn.sub[1],
                /*
                  서브카피는 접지 않는다. Figma 의 서브카피 상자 높이를 전 사이즈에서
                  글자크기로 나눠 보면 10개 모두 정확히 1줄이다(0.99~1.01).
                  저장된 폭은 그 한 줄을 잰 결과값이라, 폭으로 가두면 브라우저가
                  Figma 보다 조금 넓게 잡는 순간 두 줄로 깨진다.
                */
                width: 'max-content', whiteSpace: 'nowrap',
                margin: 0,
                fontFamily: BODY_FONT, fontSize: inn.sub[4], lineHeight: 1.06, textAlign: hAlign,
              }}>{state.subcopy}</p>
            )}
            {inn.cta && (
              <div style={{
                position: 'absolute', left: inn.cta[0], top: inn.cta[1],
                // CTA 버튼도 Figma 에선 HUG(글자 폭 + 좌우 패딩)다. 실측 폭을 최소값으로
                // 두되 글자가 넓어지면 늘어나게 해서 빨간 알약 밖으로 새지 않게 한다.
                // 좌우 패딩은 실측상 글자 크기의 약 1.2배로 일정하다.
                minWidth: inn.cta[2], width: 'max-content',
                paddingLeft: inn.cta[5] * 1.2, paddingRight: inn.cta[5] * 1.2,
                boxSizing: 'border-box', height: inn.cta[3],
                borderRadius: inn.cta[4], background: '#fd312e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: BODY_FONT, fontSize: inn.cta[5], color: '#fff', whiteSpace: 'nowrap' }}>Shop now</span>
              </div>
            )}
          </div>
        )}

        {/* ── 할인율 스티커 ── */}
        {spec.st && state.showSticker && (() => {
          const [sx, sy, size] = spec.st;
          const L = STICKER_LAYOUT;
          // 디자인별 추가 축소 — Figma 와 같은 중심 기준으로 좌표까지 함께 줄인다
          const k = style.stickerTextScale;
          const C = STICKER_TXT_CENTER;
          const tx = (v: number) => C.cx + (v - C.cx) * k;
          const ty = (v: number) => C.cy + (v - C.cy) * k;
          const S = {
            circle: L.circle,
            label:   { cx: tx(L.label.cx),   baseline: ty(L.label.baseline),   size: L.label.size * k },
            number:  { cx: tx(L.number.cx),  baseline: ty(L.number.baseline),  size: L.number.size * k, tracking: L.number.tracking * k },
            percent: { cx: tx(L.percent.cx), baseline: ty(L.percent.baseline), size: L.percent.size * k },
            off:     { cx: tx(L.off.cx),     baseline: ty(L.off.baseline),     size: L.off.size * k },
          };
          // 모양은 **시안**이 정하고(A=원 / B=별), 재질은 **선택**이 정한다(레드 / 글래스).
          // 그래서 B 의 글래스는 원이 아니라 별 모양으로 나온다.
          const isStar = style.sticker === 'star';
          const isGlass = stickerKind === 'glass';
          // 흰 셰이드를 쓰는 B 에서만 유리 안쪽을 눌러준다. A 는 종전 그대로.
          const gDark = design === 'B' ? STICKER_GLASS_DARKEN : 1;
          const gBackdrop = gDark === 1 ? glassCss.backdropFilter : `${glassCss.backdropFilter} brightness(${gDark})`;
          return (
            <div style={{ position: 'absolute', left: sx, top: sy, width: size, height: size }}>
              {(() => {
                // 도형만 키운다 — 안의 글자는 아래 SVG 라 영향받지 않는다.
                // 중심을 유지하려고 커진 만큼의 절반을 좌·상으로 당긴다.
                const ss = size * style.stickerShapeScale;
                const off = (size - ss) / 2;
                if (isStar && isGlass) {
                  /*
                    별 모양 글래스.

                    SVG path 에는 backdrop-filter 를 걸 수 없어서, 전에는 평면 회색으로만
                    칠했고 그래서 유리로 안 보였다. 대신 div 를 별 모양으로 clip 해서
                    **제품 박스와 똑같은 유리**(같은 fill·backdrop blur)를 넣는다.
                    clip-path 는 px 좌표계라 별 경로를 실제 크기로 만들고 회전도 미리 반영한다.
                    테두리는 clip 에 안 맞으므로 SVG stroke 로 위에 얹는다.
                  */
                  const half = ss / 2;
                  const px = starPath(12, half, half, half, half * 0.782, half * 0.545, STAR_ROT);
                  return (
                    <>
                      <div style={{
                        position: 'absolute', left: off, top: off, width: ss, height: ss,
                        clipPath: `path('${px}')`, WebkitClipPath: `path('${px}')`,
                        background: BOX_MATERIALS.glass.fill,
                        backdropFilter: gBackdrop,
                        WebkitBackdropFilter: gBackdrop,
                      }} />
                      <svg viewBox="0 0 100 100" width={ss} height={ss}
                        style={{ position: 'absolute', left: off, top: off, pointerEvents: 'none' }}>
                        <path d={starPath(12, 50, 50, 50, 50 * 0.782, 50 * 0.545, STAR_ROT)}
                          fill="none" stroke={BOX_MATERIALS.glass.stroke ?? 'rgba(255,255,255,0.15)'}
                          strokeWidth={100 * BOX_MATERIALS.glass.strokeRatio} />
                      </svg>
                    </>
                  );
                }
                return isStar ? (
                  <svg viewBox="0 0 100 100" width={ss} height={ss}
                    style={{ position: 'absolute', left: off, top: off }}>
                    <path d={starPath(12, 50, 50, 50, 50 * 0.782, 50 * 0.545, STAR_ROT)} fill={redHex} />
                  </svg>
                ) : (
                  <div style={{
                    position: 'absolute', left: off, top: off, width: ss, height: ss, borderRadius: '50%',
                    background: isGlass ? BOX_MATERIALS.glass.fill : circleFill,
                    border: isGlass ? `${ss * BOX_MATERIALS.glass.strokeRatio}px solid ${BOX_MATERIALS.glass.stroke}` : undefined,
                    backdropFilter: isGlass ? gBackdrop : undefined,
                    WebkitBackdropFilter: isGlass ? gBackdrop : undefined,
                    boxShadow: isGlass ? glassCss.innerLight : undefined,
                    boxSizing: 'border-box',
                  }} />
                );
              })()}
              <svg viewBox={`0 0 ${S.circle} ${S.circle}`} width={size} height={size}
                style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
                <text x={S.label.cx} y={S.label.baseline} textAnchor="middle" fill="#fff"
                  style={{ fontFamily: HEADLINE_FONT, fontWeight: HEADLINE_WEIGHT, fontSize: S.label.size }}>UP TO</text>
                <text x={S.number.cx} y={S.number.baseline} textAnchor="middle" fill="#fff"
                  style={{ fontFamily: STICKER_FONT, fontSize: S.number.size, letterSpacing: S.number.tracking }}>{discount}</text>
                <text x={S.percent.cx} y={S.percent.baseline} textAnchor="middle" fill="#fff"
                  style={{ fontFamily: STICKER_FONT, fontSize: S.percent.size }}>%</text>
                <text x={S.off.cx} y={S.off.baseline} textAnchor="middle" fill="#fff"
                  style={{ fontFamily: STICKER_FONT, fontSize: S.off.size }}>off</text>
              </svg>
            </div>
          );
        })()}

        {/* 디스클레이머 */}
        {inn.disc && (
          <p style={{
            position: 'absolute', left: inn.disc[0] + dpad[0],
            width: inn.disc[2] - dpad[0] - dpad[1],
            bottom: spec.f[1] - (inn.disc[1] + inn.disc[3]) + dpad[2],
            margin: 0, fontFamily: BODY_FONT, fontSize: inn.disc[4], color: style.discColor,
            textShadow: style.discShadow,
          }}>*T&amp;C&rsquo;s apply</p>
        )}
      </div>
    </div>
  );
}

/**
 * Figma STAR 재현 — 12꼭짓점 + 둥근 모서리.
 *
 * Figma 실측: 별 지름 276.8, innerRadius 0.782, cornerRadius 75.42 (지름 대비 0.272).
 * cornerRadius 가 매우 커서 뾰족한 별이 아니라 꽃/블롭에 가까운 형태다.
 * 각 꼭짓점을 이웃 변 쪽으로 물려 2차 베지에로 둥글린다.
 */
function starPath(points: number, cx: number, cy: number, outer: number, inner: number, corner: number, rot = 0) {
  const pts: Array<[number, number]> = [];
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = i * step - Math.PI / 2 + rot;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const P = pts[(i - 1 + n) % n], V = pts[i], N = pts[(i + 1) % n];
    // 꼭짓점에서 양쪽 변으로 물러날 거리 — 변 길이의 절반을 넘지 않게 제한
    const len = (A: [number, number], B: [number, number]) => Math.hypot(B[0] - A[0], B[1] - A[1]);
    const dPrev = Math.min(corner, len(V, P) / 2);
    const dNext = Math.min(corner, len(V, N) / 2);
    const lerp = (A: [number, number], B: [number, number], t: number): [number, number] =>
      [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
    const a = lerp(V, P, dPrev / len(V, P));
    const b = lerp(V, N, dNext / len(V, N));
    d += `${i === 0 ? 'M' : 'L'}${a[0].toFixed(2)},${a[1].toFixed(2)}`;
    d += `Q${V[0].toFixed(2)},${V[1].toFixed(2)} ${b[0].toFixed(2)},${b[1].toFixed(2)}`;
  }
  return d + 'Z';
}
