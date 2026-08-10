import { Home as HomeIcon, LayoutTemplate, BookOpen, ExternalLink } from 'lucide-react';

export type NavRailKey = 'home' | 'sales-banner';

const GUIDE_URL = 'https://retail-obs-guide.lge-d2c.com/';

const ITEMS: { key: NavRailKey; label: string; Icon: typeof HomeIcon }[] = [
  { key: 'home', label: 'Home', Icon: HomeIcon },
  { key: 'sales-banner', label: 'Sales Banner Builder', Icon: LayoutTemplate },
];

/**
 * 접힌 아이콘 레일(64px) — hover 시 라벨이 펼쳐진다.
 * (참고본 NavRail 이식, i18n·draft 제거)
 */
export function NavRail({ active, onNavigate }: { active: NavRailKey; onNavigate: (target: NavRailKey) => void }) {
  const rowClass = (isActive: boolean) =>
    `flex items-center gap-3 w-full h-11 px-[22px] shrink-0 whitespace-nowrap transition-colors ${
      isActive ? 'text-[#FD312E] bg-[#FD312E]/8' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
    }`;

  return (
    <div className="relative shrink-0 w-16 group/rail">
      <div className="absolute inset-y-0 left-0 w-16 group-hover/rail:w-max group-hover/rail:min-w-60 bg-white border-r border-gray-200 group-hover/rail:shadow-xl transition-all duration-200 ease-out overflow-hidden z-40 flex flex-col py-3">
        {ITEMS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => onNavigate(key)} className={rowClass(key === active)}>
            <Icon size={18} className="shrink-0" strokeWidth={1.75} />
            <span className="text-sm font-medium opacity-0 group-hover/rail:opacity-100 transition-opacity duration-150">
              {label}
            </span>
          </button>
        ))}

        <div className="mt-auto pt-2 border-t border-gray-100">
          <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer" className={rowClass(false)}>
            <BookOpen size={18} className="shrink-0" strokeWidth={1.75} />
            <span className="flex-1 text-sm font-medium opacity-0 group-hover/rail:opacity-100 transition-opacity duration-150">
              View Guide
            </span>
            <ExternalLink size={14} className="shrink-0 opacity-0 group-hover/rail:opacity-100 transition-opacity duration-150" strokeWidth={1.75} />
          </a>
        </div>
      </div>
    </div>
  );
}
