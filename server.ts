/**
 * 운영 서버 — 빌드 결과(dist)와 API 를 함께 서빙한다.
 *
 * 정적 파일만 올리면 제품 Import 가 죽는다. 브라우저에서 LG.com 을 직접 부르면
 * CORS 에 막히므로 크롤링·이미지 프록시는 반드시 서버를 거쳐야 한다.
 * 핸들러는 개발 서버(vite-api-plugin.ts)와 같은 api-handlers.ts 를 쓴다.
 *
 *   npm run build && npm start
 */
import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendUsage, clientIp, crawlPage, fetchProxyImage, isImageDomainAllowed, readUsage, readUsageRows, checkUsageKey } from './api-handlers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

// 앞단에 CDN 이 없으면 번들이 그대로 나간다. gzip 으로 1/3 수준까지 줄인다.
// 이미지·폰트 바이너리는 compression 이 content-type 으로 알아서 건너뛴다.
app.use(compression());
app.use(express.json({ limit: '2mb' }));

// ─── /api/proxy-image ────────────────────────────────────────────────────────

app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url as string | undefined;
  if (!imageUrl) return res.status(400).json({ error: 'Missing url parameter' });

  let parsed: URL;
  try { parsed = new URL(imageUrl); }
  catch { return res.status(400).json({ error: 'Invalid URL' }); }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Only HTTP(S) URLs allowed' });
  }
  if (!isImageDomainAllowed(parsed.hostname)) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  try {
    const { contentType, buffer } = await fetchProxyImage(imageUrl);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    // 누끼 처리가 캔버스로 픽셀을 읽으므로 ACAO 가 없으면 tainted 되어 실패한다.
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(buffer);
  } catch (err: any) {
    return res.status(err?.status ?? 500).json({ error: err?.message ?? 'Failed to fetch image' });
  }
});

// ─── /api/crawl-page ─────────────────────────────────────────────────────────

app.post('/api/crawl-page', async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url in request body' });
  }

  let parsed: URL;
  try { parsed = new URL(url); }
  catch { return res.status(400).json({ error: 'Invalid URL' }); }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Only HTTP(S) URLs allowed' });
  }

  try {
    return res.status(200).json(await crawlPage(url));
  } catch (err: any) {
    return res.status(err?.status ?? 500).json({ error: err?.message ?? 'Failed to crawl page' });
  }
});

// ─── 사용 기록 ───────────────────────────────────────────────────────────────

/*
  나라별 법인이 얼마나 쓰는지 보려고 다운로드 한 번을 한 줄로 남긴다.
  기록이 실패해도 사용자에게는 영향이 없어야 하므로 항상 200 으로 답한다 —
  다운로드는 이미 끝난 뒤에 부르는 것이라 여기서 막을 이유가 없다.
*/
app.post('/api/log-usage', async (req, res) => {
  try {
    await appendUsage(req.body || {}, clientIp(req.headers, req.socket.remoteAddress));
  } catch (err) {
    console.warn('usage log failed:', err);
  }
  return res.status(200).json({ ok: true });
});

/*
  모인 기록 내려받기. 브라우저 주소창에 치면 CSV 가 떨어진다.
    https://도메인/api/usage.csv?key=...
  key 는 USAGE_KEY 환경변수와 맞아야 한다. 안 걸어두면 아무나 볼 수 있으므로
  값이 없으면 아예 닫아 둔다.
*/
app.get('/api/usage.json', async (req, res) => {
  const k = checkUsageKey(req.query.key);
  if (k === 'no-key') return res.status(503).json({ error: 'USAGE_KEY not set on server' });
  if (k !== 'ok') return res.status(403).json({ error: 'Forbidden' });
  return res.json({ rows: await readUsageRows() });
});

app.get('/api/usage.csv', async (req, res) => {
  const k = checkUsageKey(req.query.key);
  if (k === 'no-key') return res.status(503).json({ error: 'USAGE_KEY not set on server' });
  if (k !== 'ok') return res.status(403).json({ error: 'Forbidden' });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="usage.csv"');
  // 엑셀이 UTF-8 로 열도록 BOM 을 붙인다 (없으면 한글 제품명이 깨진다)
  return res.send('\uFEFF' + (await readUsage()));
});

// ─── 정적 파일 + SPA 폴백 ────────────────────────────────────────────────────

const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir, {
  setHeaders: (res, filePath) => {
    // 폰트·번들은 파일명에 해시가 붙거나 바뀌지 않으므로 길게 캐시한다.
    if (filePath.includes('/fonts/') || filePath.includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});
