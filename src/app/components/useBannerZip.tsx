import { useMemo, useRef, useState } from 'react';
import type { BannerState } from '../types';
import { AD_CHANNELS } from '../../data/builderOptions';
import { MEDIA_SIZES } from '../../data/mediaSizes';
import { getSpec } from '../../data/figmaStyle';
import { SpecBannerPreview } from './SpecBannerPreview';
import { capturePng, inlineImages, saveBlob, settle, stamp } from '../utils/bannerExport';

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
          // 첫 장은 폰트·이미지를 인라인하며 한 번 헛돌린다. 그래야 1번 파일만
          // 폰트가 빠진 채로 구워지는 일이 없다.
          if (i === 0) await capturePng(host, t.w, t.h).catch(() => null);
          zip.folder(t.channel)!.file(`${t.channel}-${t.name}.png`, await capturePng(host, t.w, t.h));
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
    굽는 대상. 화면 밖(-10000px)에 두되 display:none 은 쓰지 않는다 —
    레이아웃이 잡혀야 CTA 자리 계산(offsetHeight)과 이미지 디코드가 정상이다.
  */
  const host = (
    <div ref={hostRef} aria-hidden style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}>
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
  );

  return { run, progress: p, host, count: targets.length };
}
