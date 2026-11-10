/**
 * 첫 접속 국가(법인) 선택 팝업 — Builder Hub 첫 화면 팝업(12 All/public/country.js)을 옮긴 것.
 * 허브를 거치지 않고 빌더 주소로 바로 들어온 사람에게도 같은 질문을 한다.
 *
 * - 아직 나라가 없으면 고르기 전까지 닫을 수 없다 (×·바깥 클릭·Esc 없음).
 * - 헤더의 국가 버튼(CountryBadge)으로 다시 열면 그때는 닫을 수 있다.
 * - 통계 화면(#stats)에서는 묻지 않는다.
 * 모양·문구는 허브와 같다 (스타일: countryPicker.css). 세일즈·블프 빌더가 같은 파일을 쓴다.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { REGIONS } from '../utils/regions';
import { getHubCountry, OPEN_EVENT, openCountryPicker, setHubCountry, subscribeHubCountry } from '../utils/hubCountry';
import './countryPicker.css';

const useHubCountry = () => useSyncExternalStore(subscribeHubCountry, getHubCountry);

const Plus = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path className="v" d="M10 2v16" /><path d="M2 10h16" />
  </svg>
);
const Close = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M4 4l12 12M16 4L4 16" />
  </svg>
);
const Globe = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);

/** 앱 맨 바깥에 한 번만 둔다 (main.tsx) */
export function CountryPicker() {
  const cur = useHubCountry();
  const isStats = typeof window !== 'undefined' && window.location.hash === '#stats';
  const required = !cur && !isStats;
  const [manual, setManual] = useState(false);
  const shown = required || manual;
  // 펼친 지역 — 열 때 고른 나라가 있는 지역을 펼쳐 둔다
  const [openRegions, setOpenRegions] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onOpen = () => setManual(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!shown) return;
    const region = cur?.country.split('/')[0];
    setOpenRegions(new Set(region ? [region] : []));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
    // 열릴 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const hide = () => { if (!required) setManual(false); };

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!shown) return null;

  const toggle = (code: string) =>
    setOpenRegions((s) => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  return (
    <div className={`cs-overlay${required ? ' required' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) hide(); }}>
      <div className="cs-modal" role="dialog" aria-modal="true" aria-labelledby="csTitle">
        <div className="cs-head">
          <div>
            <h2 id="csTitle">Where is your subsidiary located?</h2>
            <p>Select your region, then your subsidiary.</p>
          </div>
          <button className="cs-close" type="button" aria-label="Close" onClick={hide}><Close /></button>
        </div>
        <div className="cs-list">
          {REGIONS.map((r, i) => {
            const open = openRegions.has(r.code);
            return (
              <section key={r.code} className={`cs-region${open ? ' open' : ''}`}>
                <button className="cs-region-head" type="button" aria-expanded={open} aria-controls={`csR${i}`} onClick={() => toggle(r.code)}>
                  <span>{r.name}</span><Plus />
                </button>
                <div className="cs-region-body" id={`csR${i}`}>
                  <div className="cs-region-inner">
                    <ul className="cs-countries">
                      {r.countries.map(([name, c]) => {
                        const code = `${r.code}/${c}`;
                        return (
                          <li key={code}>
                            <button
                              className={`cs-country${cur?.country === code ? ' on' : ''}`}
                              type="button"
                              onClick={() => { setHubCountry(code); setManual(false); }}
                            >{name}</button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 헤더 오른쪽 — 고른 나라 표시 + 다시 고르기. 아직 안 골랐으면 그리지 않는다 */
export function CountryBadge() {
  const cur = useHubCountry();
  if (!cur) return null;
  return (
    <button type="button" className="cs-badge" onClick={openCountryPicker} title="Change subsidiary">
      <Globe /><span>{cur.name}</span><span className="cs-badge-code">{cur.country}</span>
    </button>
  );
}
