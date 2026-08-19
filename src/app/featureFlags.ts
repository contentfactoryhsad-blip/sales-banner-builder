/** 기능 on/off 스위치 — 코드를 지우지 않고 화면에서만 숨길 때 사용. */

/**
 * Mode B(Single page = `Home` + `SalesBannerBuilder`) 노출 여부.
 *
 * false = Mode A(StepBuilder)로 바로 진입하고 첫 화면(ModeSelect)은 건너뜀.
 * 코드/파일은 그대로 남아 있으므로 true로 되돌리면 즉시 복구된다.
 * (되살릴 때 함께 볼 파일: ModeSelect.tsx · Home.tsx · SalesBannerBuilder.tsx
 *  · LeftOptionsPanel.tsx · RightPanel.tsx · NavRail.tsx)
 */
export const ENABLE_MODE_B: boolean = false;

/**
 * AD Media 의 Logo Change 줄(사이즈별 로고 교체) 노출 여부.
 *
 * false = 화면에서만 감춘다. 상태(logoBySize)·렌더 갈래·LOGO_VARIANTS 는 그대로라
 * true 로 되돌리면 즉시 복구된다.
 * B 의 세로형은 흰 로고로 못박았고(SpecBannerPreview 의 baseLogo), 그래서 사람이
 * 고를 일이 당장은 없어 잠시 내려둔다.
 */
export const ENABLE_LOGO_CHANGE: boolean = false;
