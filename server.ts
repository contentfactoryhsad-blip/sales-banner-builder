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
import { crawlPage, fetchProxyImage, isImageDomainAllowed } from './api-handlers';

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
