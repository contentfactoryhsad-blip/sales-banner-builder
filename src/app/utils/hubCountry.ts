/**
 * Builder Hub(builder-hub.lge-d2c.com)에서 고른 국가(법인).
 *
 * 허브의 카드 링크가 `?hub_country=ASIA/KR` (지역/국가 코드)을 붙여 보낸다.
 * 첫 화면에서 받아 **이 탭에만**(sessionStorage) 두고 주소창에서는 지운다 — 같은 탭에서
 * 새로고침해도 남지만, 탭을 닫거나 허브를 거치지 않고 새로 들어오면 남지 않는다
 * (허브는 들어올 때마다 나라를 다시 묻는다). 사용 기록(logUsage)이 이 값을 같이 보내고,
 * 서버는 IP 로 추정한 나라 대신 이 값을 stats 의 country 칸에 그대로 찍는다.
 */
const KEY = 'builderHub.country';

export interface HubCountry { country: string }

/** 주소에 허브 값이 있으면 저장하고 주소에서 뺀다. 앱을 그리기 전에 한 번 부른다. */
export function captureHubCountry(): void {
  try {
    const url = new URL(window.location.href);
    const country = url.searchParams.get('hub_country')?.trim();
    if (!country) return;
    sessionStorage.setItem(KEY, JSON.stringify({ country }));
    url.searchParams.delete('hub_country');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch {
    /* 저장 못 해도 빌더는 그대로 쓴다 — 기록만 IP 추정으로 남는다 */
  }
}

/** 저장된 허브 국가. 허브를 거치지 않고 들어왔으면 null. */
export function getHubCountry(): HubCountry | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    return v && typeof v.country === 'string' && v.country ? { country: v.country } : null;
  } catch {
    return null;
  }
}
