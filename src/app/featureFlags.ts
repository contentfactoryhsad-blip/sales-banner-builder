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
