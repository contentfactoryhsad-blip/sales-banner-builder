/**
 * 매체별 배너 사이즈 — Figma "Banner Template" 페이지의 채널 섹션
 * (External Banner / Dark mode: Criteo / DV360 / Pmax / META) 프레임에서 추출.
 * 이름 "criteo-1200x628" 등에서 W×H 파싱.
 */
export interface MediaSize {
  name: string; // "1200x628"
  w: number;
  h: number;
}

function sizes(list: string): MediaSize[] {
  return list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [w, h] = s.split('x').map(Number);
      return { name: s, w, h };
    });
}

export const MEDIA_SIZES: Record<string, MediaSize[]> = {
  criteo: sizes(
    '1200x628,1200x1200,800x1200,768x1024,1024x768,480x320,970x250,970x90,728x90,336x280,300x600,300x300,300x250,300x100,320x568,320x480,320x100,320x50,280x230,250x250,200x200,468x60,160x600,120x600,360x640',
  ),
  dv360: sizes(
    '1200x270,970x250,970x90,800x250,728x90,375x667,360x640,360x592,336x280,320x320,320x480,320x100,320x50,300x1050,300x600,300x250,300x100,300x50,250x250,160x600,125x125,120x600,120x240,120x60,468x60',
  ),
  pmax: sizes('1200x1200,1200x628,960x1200'),
  meta: sizes('1080x1080,1080x1920,398x208'),
};
