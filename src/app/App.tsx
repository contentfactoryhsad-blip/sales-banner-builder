import { useState } from 'react';
import { ModeSelect, type WorkflowMode } from './components/ModeSelect';
import { Home } from './components/Home';
import { SalesBannerBuilder } from './components/SalesBannerBuilder';
import { StepBuilder } from './components/StepBuilder';
import type { DesignType } from './types';
import { ENABLE_MODE_B } from './featureFlags';

export default function App() {
  const [mode, setMode] = useState<WorkflowMode | null>(null);
  const [designType, setDesignType] = useState<DesignType | null>(null);

  // Mode B 숨김 상태 — 방식 선택 화면 없이 Mode A로 바로 진입
  if (!ENABLE_MODE_B) return <StepBuilder />;

  // 1) 첫 화면 — 작업 방식 선택
  if (!mode) return <ModeSelect onSelect={setMode} />;

  // 2A) 단계별(Step) 방식
  if (mode === 'step') return <StepBuilder onExit={() => setMode(null)} />;

  // 2B) 한판(Single-page) 방식 — 디자인 타입 선택 → 빌더
  if (!designType) return <Home onSelect={setDesignType} onBack={() => setMode(null)} />;
  return <SalesBannerBuilder designType={designType} onExit={() => setDesignType(null)} />;
}
