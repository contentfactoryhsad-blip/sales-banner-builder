import { useMemo, useRef, useState } from 'react';
import type { BannerState } from '../types';
import { AD_CHANNELS } from '../../data/builderOptions';
import { MEDIA_SIZES } from '../../data/mediaSizes';
import { getSpec } from '../../data/figmaStyle';
import { SpecBannerPreview } from './SpecBannerPreview';
import { buildFontCss, capturePng, inlineImages, saveBlob, settle, stamp } from '../utils/bannerExport';

export interface ZipProgress {
  busy: boolean;
  done: number;
  total: number;
  /** 지금 굽고 있는 것 — "criteo 1200x628" */
  current: string | null;
  error: string | null;
  /** 굽다가 실패한 것들 (나머지는 그대로 담긴다) */
  failed: string[];
}

/**
 * 선택한 매체의 모든 사이즈를 구워 매체별 폴더로 묶은 ZIP 을 만든다.
 *
 *   LG-sales-banner-A-260811.zip
 *     criteo/criteo-1200x628.png …
 *     dv360/…  pmax/…  meta/…
 *
 * 한 장씩 화면 밖에 **원본 크기로** 그린 뒤 굽는다. 미리보기와 같은 렌더러라
 * 웹에서 본 것과 결과가 어긋나지 않는다. 반환된 `host` 를 화면 어딘가에 한 번
 * 렌더해 두어야 한다(화면 밖이라 보이지는 않는다).
 */
export function useBannerZip(state: BannerState) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [job, setJob] = useState<{ channel: string; size: string; w: number; h: number } | null>(null);
  const [p, setP] = useState<ZipProgress>({ busy: false, done: 0, total: 0, current: null, error: null, failed: [] });

  /** 고른 매체 × Figma 스펙이 있는 사이즈 (숨김 프레임은 스펙이 없어 자연히 빠진다) */
  const targets = useMemo(() => {
    const out: { channel: string; name: string; w: number; h: number }[] = [];
    for (const c of AD_CHANNELS) {
      if (!state.adChannelIds.includes(c.id)) continue;
      for (const s of MEDIA_SIZES[c.id] ?? []) {
        if (getSpec(state.designType, c.id, s.name)) out.push({ channel: c.id, name: s.name, w: s.w, h: s.h });
      }
    }
    return out;
  }, [state.adChannelIds, state.designType]);

  const run = async () => {
    if (p.busy || targets.length === 0) return;
    setP({ busy: true, done: 0, total: targets.length, current: null, error: null, failed: [] });
    // 마지막 단계에서만 쓰는 라이브러리라 여기서 불러온다 (초기 번들에서 제외)
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const failed: string[] = [];
    let ok = 0;
    let fontCss: string | null = null;
    try {
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const label = `${t.channel} ${t.name}`;
        setP((s) => ({ ...s, current: label }));
        setJob({ channel: t.channel, size: t.name, w: t.w, h: t.h });
        await settle();
        const host = hostRef.current;
        if (!host) throw new Error('렌더 자리를 찾지 못했습니다');
        const restore = await inlineImages(host);
        try {
          // 폰트 CSS 는 첫 장에서 한 번만 만들어 모든 장에 같은 것을 넘긴다
          if (fontCss === null) fontCss = await buildFontCss(host);
          zip.folder(t.channel)!.file(`${t.channel}-${t.name}.png`, await capturePng(host, t.w, t.h, fontCss));
          ok++;
        } catch {
          failed.push(label);
        } finally {
          restore();
        }
        setP((s) => ({ ...s, done: i + 1, failed: [...failed] }));
      }
      if (ok === 0) throw new Error('구워진 배너가 없습니다');
      const blob = await zip.generateAsync({ type: 'blob' });
      await saveBlob(blob, `LG-sales-banner-${state.designType}-${stamp()}.zip`);
      setP((s) => ({ ...s, busy: false, current: null }));
    } catch (e) {
      setP((s) => ({ ...s, busy: false, current: null, error: (e as Error).message }));
    } finally {
      setJob(null);
    }
  };

  /*
    굽는 대상.

    화면 밖으로 밀어내는 건 **바깥 껍데기**가 하고, 굽는 노드(hostRef)는 아무 위치
    스타일도 갖지 않는다. html-to-image 는 노드를 복제해 SVG(foreignObject) 안에
    넣는데, 복제본은 계산된 스타일을 그대로 물려받는다. 굽는 노드 자신에
    position:fixed; left:-10000px 이 붙어 있으면 SVG 안에서도 그만큼 밀려나
    **빈 그림**이 나온다.

    display:none 은 쓰지 않는다 — 레이아웃이 잡혀야 CTA 자리 계산(offsetHeight)과
    이미지 디코드가 정상이다.
  */
  const host = (
    <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}>
      {/* 굽는 크기를 못박아 둔다 — 껍데기가 shrink-to-fit 이라 폭이 흔들릴 수 있다 */}
      <div ref={hostRef} style={job ? { width: job.w, height: job.h } : undefined}>
        {job && (() => {
          const spec = getSpec(state.designType, job.channel, job.size);
          return spec ? (
            <SpecBannerPreview
              state={state} spec={spec} design={state.designType}
              channel={job.channel} size={job.size} displayWidth={job.w}
            />
          ) : null;
        })()}
      </div>
    </div>
  );

  return { run, progress: p, host, count: targets.length };
}
