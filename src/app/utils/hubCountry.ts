/**
 * 국가(법인) — Builder Hub(builder-hub.lge-d2c.com)에서 골랐거나, 이 빌더 첫 화면에서 고른 값.
 *
 * 1) 허브의 카드 링크가 `?hub_country=ASIA/KR` (지역/국가 코드)을 붙여 보낸다.
 *    받으면 저장하고 주소창에서는 지운다. 허브를 거쳐 왔으면 늘 이 값이 이긴다.
 * 2) 허브를 거치지 않고 바로 들어오면 첫 화면에서 허브와 같은 팝업(CountryPicker)으로 묻는다.
 *
 * 고른 값은 이 브라우저에 기억해(localStorage) 다음부터는 묻지 않는다 — 허브와 같은 약속.
 * 잘못 골랐으면 헤더 오른쪽 국가 버튼으로 바꾼다.
 * 사용 기록(logUsage)이 이 값을 같이 보내고, 서버는 IP 로 추정한 나라 대신
 * 이 값을 stats 의 country 칸에 그대로 찍는다.
 */
import { countryName } from './regions';

/** 허브와 같은 이름의 열쇠 — 탭(session)에는 { country }, 브라우저(local)에는 { name, code } */
const KEY = 'builderHub.country';

export interface HubCountry { country: string; name: string }

let current: HubCountry | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function load(): HubCountry | null {
  // 이 탭에서 허브가 넘겨준 값이 먼저 — 허브를 거쳐 왔으면 그 값을 쓴다
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (v && typeof v.country === 'string' && v.country) {
      return { country: v.country, name: countryName(v.country) ?? v.country };
    }
  } catch { /* 저장소를 못 쓰면 묻는 화면으로 */ }
  // 이 빌더에서 전에 고른 값 — 목록에서 빠진 코드면 버리고 다시 묻는다
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    const name = v && typeof v.code === 'string' ? countryName(v.code) : null;
    if (name) return { country: v.code, name };
  } catch { /* 위와 같다 */ }
  return null;
}

/** 주소에 허브 값이 있으면 저장하고 주소에서 뺀다. 앱을 그리기 전에 한 번 부른다. */
export function captureHubCountry(): void {
  try {
    const url = new URL(window.location.href);
    const country = url.searchParams.get('hub_country')?.trim();
    if (country) {
      sessionStorage.setItem(KEY, JSON.stringify({ country }));
      // 목록에 있는 나라면 이 빌더에도 기억해 둔다 — 다음에 바로 들어와도 묻지 않게
      const name = countryName(country);
      if (name) localStorage.setItem(KEY, JSON.stringify({ name, code: country }));
      url.searchParams.delete('hub_country');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  } catch {
    /* 저장 못 해도 빌더는 그대로 쓴다 — 기록만 IP 추정으로 남는다 */
  }
  current = load();
}

/** 저장된 국가. 아직 안 골랐으면 null. */
export function getHubCountry(): HubCountry | null {
  return current;
}

/** 첫 화면 팝업·헤더 버튼에서 고른 나라를 저장한다 */
export function setHubCountry(code: string): void {
  const name = countryName(code);
  if (!name) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ country: code }));
    localStorage.setItem(KEY, JSON.stringify({ name, code }));
  } catch { /* 저장 못 해도 이 화면에서는 쓴다 */ }
  current = { country: code, name };
  emit();
}

/** React useSyncExternalStore 용 */
export function subscribeHubCountry(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** 헤더의 국가 버튼 → 팝업 열기 (CountryPicker 가 듣는다) */
export const OPEN_EVENT = 'hub-country:open';
export function openCountryPicker(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}
