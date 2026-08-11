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
 */
const KEY_STORE = 'usage-key';

interface Row { [k: string]: string }

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

export function UsageStats() {
  const [key, setKey] = useState(() => localStorage.getItem(KEY_STORE) ?? '');
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (k: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/usage.json?key=${encodeURIComponent(k)}`);
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

  const stat = useMemo(() => {
    const r = rows ?? [];
    const days = new Set(r.map((x) => (x.time ?? '').slice(0, 10))).size;
    return {
      total: r.length,
      days,
      banners: r.reduce((a, x) => a + (Number(x.banners) || 0), 0),
      country: tally(r, 'country'),
      design: tally(r, 'design'),
      promotion: tally(r, 'promotion'),
      product: tally(r, 'product_models', '|'),
      channel: tally(r, 'channels', '|'),
    };
  }, [rows]);

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

  return (
    <div className="h-screen flex flex-col bg-[#f8f7f5]">
      <AppHeader
        title="Usage Stats"
        right={
          <a href={`/api/usage.csv?key=${encodeURIComponent(key)}`}
            className="text-xs text-gray-500 hover:text-[#FD312E]">CSV 내려받기</a>
        }
      />
      <div className="flex-1 overflow-y-auto px-10 py-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-4">
            {[['다운로드 횟수', stat.total], ['만들어진 배너', stat.banners], ['사용한 날', stat.days]].map(([k, v]) => (
              <div key={k as string} className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-[12px] text-gray-400">{k}</p>
                <p className="font-lgei font-bold text-[28px] text-gray-900 tabular-nums">{v as number}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Bars title="국가별" data={stat.country} total={stat.total} />
            <Bars title="시안 (A/B)" data={stat.design} total={stat.total} />
            <Bars title="프로모션" data={stat.promotion} total={stat.total} />
            <Bars title="매체" data={stat.channel} total={stat.total} />
          </div>
          <Bars title="제품 (모델)" data={stat.product} total={stat.total} />

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="font-lgei font-bold text-[15px] text-gray-900 mb-3">최근 기록</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-gray-400">
                  <tr>{['시각', '국가', '시안', '프로모션', '제품', '박스', '매체', '장수'].map((h) => (
                    <th key={h} className="text-left font-normal pb-2 pr-4 whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="text-gray-700">
                  {[...rows].reverse().slice(0, 30).map((r, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-1.5 pr-4 whitespace-nowrap tabular-nums">{(r.time ?? '').replace('T', ' ').slice(0, 16)}</td>
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
