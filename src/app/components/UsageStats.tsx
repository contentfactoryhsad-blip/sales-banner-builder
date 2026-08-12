import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from './AppHeader';

/**
 * 사용 통계 화면 — 나라별 법인이 얼마나 쓰는지 본다.
 *
 * 주소에 `#stats` 를 붙이면 열린다 (예: https://도메인/#stats).
 * 빌더 화면 어디에도 링크를 두지 않아 일반 사용자는 마주칠 일이 없다.
 *
 * 열쇠는 서버가 검사한다 — 여기서는 넘겨주기만 하고, 맞는지는 서버 응답으로 안다.
 * 한 번 맞으면 브라우저에 저장해 다음부터 안 묻는다.
 *
 * 기록은 자동으로 지워지지 않고 계속 쌓인다. 그래서 화면에서 기간을 고를 수 있게
 * 해두었다 — 월별 막대는 **항상 전체**를 보여주고, 나머지 집계만 고른 기간을 따른다.
 */
const KEY_STORE = 'usage-key';

interface Row { [k: string]: string }

/** 전체 / 최근 N일 / 특정 연도 / 특정 달 */
type Period =
  | { kind: 'all' }
  | { kind: 'days'; n: number }
  | { kind: 'year'; y: string }
  | { kind: 'month'; ym: string };

/*
  서버는 시각을 UTC(ISO)로 남긴다 — 나라별 법인이 쓰는 도구라 저장은 UTC 가 맞다.
  다만 화면에서는 **보는 사람의 현지 시각**으로 바꿔 보여준다. 한국에서 열면 KST 다.
  그대로 두면 9시간 어긋난 시각이 보이고, 월·일 집계도 경계가 밀린다.
*/
const p2 = (n: number) => String(n).padStart(2, '0');
const local = (r: Row) => {
  const d = new Date(r.time ?? '');
  return Number.isNaN(d.getTime()) ? null : d;
};
const ym = (r: Row) => { const d = local(r); return d ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}` : ''; };
const day = (r: Row) => { const d = local(r); return d ? `${ym(r)}-${p2(d.getDate())}` : ''; };
const stampText = (r: Row) => {
  const d = local(r);
  return d ? `${ym(r)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}` : '';
};
/** 화면에 적어 둘 시간대 이름 (예: Asia/Seoul) */
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function inPeriod(r: Row, p: Period): boolean {
  if (p.kind === 'all') return true;
  if (p.kind === 'month') return ym(r) === p.ym;
  if (p.kind === 'year') return ym(r).slice(0, 4) === p.y;
  // 최근 N일은 절대 시각으로 — 시간대와 무관하다
  const d = local(r);
  return !!d && d.getTime() >= Date.now() - p.n * 86400_000;
}

function periodLabel(p: Period): string {
  if (p.kind === 'all') return '전체';
  if (p.kind === 'days') return `최근 ${p.n}일`;
  if (p.kind === 'year') return `${p.y}년`;
  const [y, m] = p.ym.split('-');
  return `${y}년 ${Number(m)}월`;
}

/** 값별 건수를 세어 많은 순으로 */
function tally(rows: Row[], field: string, split?: string): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const raw = (r[field] ?? '').trim();
    const vals = split ? raw.split(split).filter(Boolean) : [raw];
    for (const v of vals) {
      const k = v || '(없음)';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function Bars({ title, data, total }: { title: string; data: [string, number][]; total: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="font-lgei font-bold text-[15px] text-gray-900 mb-3">{title}</p>
      {data.length === 0 && <p className="text-sm text-gray-400">기록 없음</p>}
      <div className="flex flex-col gap-2">
        {data.slice(0, 12).map(([k, n]) => (
          <div key={k} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-[13px] text-gray-700 truncate" title={k}>{k}</span>
            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-[#FD312E]" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
            </div>
            <span className="w-10 text-right text-[12px] tabular-nums text-gray-500">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 월별 세로 막대 — 누르면 그 달만 본다 */
function MonthChart({
  months, selected, onPick,
}: {
  months: { ym: string; count: number; banners: number }[];
  selected: string | null;
  onPick: (ym: string) => void;
}) {
  const max = Math.max(1, ...months.map((m) => m.count));
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="font-lgei font-bold text-[15px] text-gray-900">월별 다운로드</p>
        <p className="text-[11px] text-gray-400">막대를 누르면 그 달만 봅니다 · 이 표는 항상 전체 기간</p>
      </div>
      {months.length === 0 ? (
        <p className="text-sm text-gray-400">기록 없음</p>
      ) : (
        <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ height: 160 }}>
          {months.map((m) => {
            const on = selected === m.ym;
            return (
              <button
                key={m.ym} type="button" onClick={() => onPick(m.ym)}
                title={`${m.ym} · 다운로드 ${m.count}회 · 배너 ${m.banners}장`}
                className="flex flex-col items-center justify-end gap-1 shrink-0 group"
                style={{ width: 44, height: '100%' }}
              >
                <span className={`text-[11px] tabular-nums ${on ? 'text-[#FD312E] font-medium' : 'text-gray-400'}`}>
                  {m.count}
                </span>
                <div
                  className={`w-full rounded-t transition-colors ${on ? 'bg-[#FD312E]' : 'bg-gray-200 group-hover:bg-gray-300'}`}
                  style={{ height: `${(m.count / max) * 100}%`, minHeight: 3 }}
                />
                <span className={`text-[10px] whitespace-nowrap ${on ? 'text-[#FD312E] font-medium' : 'text-gray-400'}`}>
                  {Number(m.ym.slice(5))}월
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function UsageStats() {
  const [key, setKey] = useState(() => localStorage.getItem(KEY_STORE) ?? '');
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period>({ kind: 'all' });

  const load = async (k: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/usage.json?key=${encodeURIComponent(k)}`);
      if (res.status === 503) { setError('서버에 USAGE_KEY 가 설정되지 않았습니다. Railway Variables 를 확인하세요.'); setRows(null); return; }
      if (res.status === 403) { setError('열쇠가 맞지 않습니다.'); setRows(null); localStorage.removeItem(KEY_STORE); setKey(''); return; }
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const j = (await res.json()) as { rows: Row[] };
      setRows(j.rows);
      localStorage.setItem(KEY_STORE, k);
      setKey(k);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 저장된 열쇠가 있으면 바로 불러온다
  useEffect(() => { if (key) void load(key); /* eslint-disable-next-line */ }, []);

  /** 월별 집계는 **전체 기간** 기준 — 기간을 좁혀도 흐름은 계속 보여야 한다 */
  const months = useMemo(() => {
    const m = new Map<string, { count: number; banners: number }>();
    for (const r of rows ?? []) {
      const k = ym(r);
      if (!k) continue;
      const v = m.get(k) ?? { count: 0, banners: 0 };
      v.count += 1;
      v.banners += Number(r.banners) || 0;
      m.set(k, v);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ ym: k, ...v }));
  }, [rows]);

  const years = useMemo(
    () => [...new Set(months.map((m) => m.ym.slice(0, 4)))].sort().reverse(),
    [months],
  );

  const shown = useMemo(() => (rows ?? []).filter((r) => inPeriod(r, period)), [rows, period]);

  const stat = useMemo(() => ({
    total: shown.length,
    days: new Set(shown.map(day)).size,
    banners: shown.reduce((a, x) => a + (Number(x.banners) || 0), 0),
    country: tally(shown, 'country'),
    design: tally(shown, 'design'),
    promotion: tally(shown, 'promotion'),
    product: tally(shown, 'product_models', '|'),
    channel: tally(shown, 'channels', '|'),
  }), [shown]);

  if (!rows) {
    return (
      <div className="h-screen flex flex-col bg-[#f8f7f5]">
        <AppHeader title="Usage Stats" />
        <div className="flex-1 flex items-center justify-center">
          <form
            onSubmit={(e) => { e.preventDefault(); if (input.trim()) void load(input.trim()); }}
            className="w-80 rounded-2xl border border-gray-200 bg-white p-6 flex flex-col gap-3"
          >
            <p className="font-lgei font-bold text-[16px] text-gray-900">관리자 열쇠</p>
            <input
              type="password" value={input} onChange={(e) => setInput(e.target.value)} autoFocus
              placeholder="USAGE_KEY"
              className="h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#FD312E]"
            />
            {error && <p className="text-[12px] text-[#FD312E]">{error}</p>}
            <button type="submit" disabled={loading}
              className="h-10 rounded-lg bg-[#FD312E] text-white text-sm font-medium hover:bg-[#E22825] disabled:opacity-40">
              {loading ? '확인 중…' : '열기'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const chips: Period[] = [
    { kind: 'all' },
    { kind: 'days', n: 30 },
    { kind: 'days', n: 90 },
    ...years.map((y) => ({ kind: 'year', y } as Period)),
  ];
  const same = (a: Period, b: Period) => JSON.stringify(a) === JSON.stringify(b);

  return (
    <div className="h-screen flex flex-col bg-[#f8f7f5]">
      <AppHeader
        title="Usage Stats"
        right={
          <a href={`/api/usage.csv?key=${encodeURIComponent(key)}&tz=${encodeURIComponent(TZ)}`}
            className="text-xs text-gray-500 hover:text-[#FD312E]">CSV 내려받기</a>
        }
      />
      <div className="flex-1 overflow-y-auto px-10 py-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-5">

          {/* 기간 고르기 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {chips.map((p) => (
              <button
                key={JSON.stringify(p)} type="button" onClick={() => setPeriod(p)}
                className={`px-3 h-8 rounded-full text-[12px] font-medium border transition-colors ${
                  same(p, period) ? 'border-[#FD312E] text-[#FD312E] bg-[#FD312E]/5'
                                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {periodLabel(p)}
              </button>
            ))}
            {period.kind === 'month' && (
              <span className="px-3 h-8 inline-flex items-center rounded-full text-[12px] font-medium border border-[#FD312E] text-[#FD312E] bg-[#FD312E]/5">
                {periodLabel(period)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[['다운로드 횟수', stat.total], ['만들어진 배너', stat.banners], ['사용한 날', stat.days]].map(([k, v]) => (
              <div key={k as string} className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-[12px] text-gray-400">{k} <span className="text-gray-300">· {periodLabel(period)}</span></p>
                <p className="font-lgei font-bold text-[28px] text-gray-900 tabular-nums">{v as number}</p>
              </div>
            ))}
          </div>

          <MonthChart
            months={months}
            selected={period.kind === 'month' ? period.ym : null}
            onPick={(k) => setPeriod((p) => (p.kind === 'month' && p.ym === k ? { kind: 'all' } : { kind: 'month', ym: k }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <Bars title="국가별" data={stat.country} total={stat.total} />
            <Bars title="시안 (A/B)" data={stat.design} total={stat.total} />
            <Bars title="프로모션" data={stat.promotion} total={stat.total} />
            <Bars title="매체" data={stat.channel} total={stat.total} />
          </div>
          <Bars title="제품 (모델)" data={stat.product} total={stat.total} />

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="font-lgei font-bold text-[15px] text-gray-900 mb-3">
              최근 기록 <span className="text-[12px] font-normal text-gray-400">· {periodLabel(period)} {shown.length}건 · 시각은 {TZ} 기준</span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-gray-400">
                  <tr>{['시각', '국가', '시안', '프로모션', '제품', '박스', '매체', '장수'].map((h) => (
                    <th key={h} className="text-left font-normal pb-2 pr-4 whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="text-gray-700">
                  {[...shown].reverse().slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-1.5 pr-4 whitespace-nowrap tabular-nums">{stampText(r)}</td>
                      <td className="py-1.5 pr-4">{r.country}</td>
                      <td className="py-1.5 pr-4">{r.design}</td>
                      <td className="py-1.5 pr-4">{r.promotion}</td>
                      <td className="py-1.5 pr-4 max-w-[220px] truncate" title={r.product_models}>{r.products} {r.product_models && `· ${r.product_models}`}</td>
                      <td className="py-1.5 pr-4">{r.boxes}</td>
                      <td className="py-1.5 pr-4">{r.channels}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{r.banners}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
