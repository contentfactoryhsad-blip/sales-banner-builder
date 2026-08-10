import React from 'react';

/**
 * 단계 바 — 단계별(Step) 빌더 상단. 현재 단계 이전은 클릭해 되돌아갈 수 있다.
 * (참고본 WizardBreadcrumb 이식, i18n 제거)
 */
export function WizardBreadcrumb({
  steps,
  activeStep,
  onStepClick,
}: {
  steps: string[];
  activeStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="bg-[#F0ECE4] px-6 h-11 flex items-center justify-center gap-2 shrink-0 overflow-x-auto">
      {steps.map((step, i) => {
        const stepN = i + 1;
        const isActive = stepN === activeStep;
        const isDone = stepN < activeStep;
        return (
          <React.Fragment key={step}>
            {i > 0 && (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <path d="M6 3l5 5-5 5" stroke="#CBC8C2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <button
              type="button"
              onClick={() => isDone && onStepClick(stepN)}
              disabled={!isDone}
              className={`text-sm whitespace-nowrap transition-colors ${isActive ? 'font-medium cursor-default' : 'font-light'} ${isDone ? 'cursor-pointer hover:opacity-70' : 'cursor-default'}`}
              style={{ color: isActive ? '#4A4946' : '#716F6A' }}
            >
              {step}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
