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

/**
 * Edit 의 Coloring(색 입히는 방식) 선택 노출 여부.
 *
 * false = 시안별로 **확정된 방식만** 쓴다 — A 는 Overlay, B 는 Gradient map
 * (DEFAULT_COLOR_MODE). 고를 일이 없어졌으므로 화면에서 내린다.
 *
 * 숨기는 것으로 끝내지 않고 렌더도 state.colorMode 대신 시안 기본값을 보게 해뒀다
 * (SpecBannerPreview 의 colorMode). 안 그러면 예전에 골라 둔 값이 남은 화면에서
 * 숨긴 뒤에도 그 방식으로 계속 그려진다.
 *
 * 되살릴 때: 이 값을 true 로 되돌리고 SpecBannerPreview 의 colorMode 를
 * state.colorMode 로 되돌리면 된다. COLOR_MODES_BY_DESIGN·상태·렌더 갈래는 그대로다.
 */
export const ENABLE_COLORING_OPTION: boolean = false;
