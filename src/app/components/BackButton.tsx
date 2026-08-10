import { ChevronLeft } from 'lucide-react';

/** 헤더 좌측 "뒤로" 알약 버튼. (참고본 BackButton 이식) */
export function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 h-8 pl-2 pr-3 rounded-full border border-gray-200 text-gray-600 text-sm hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
    >
      <ChevronLeft size={16} />
      {label}
    </button>
  );
}
