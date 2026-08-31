import type { Plugin } from 'vite';
import { appendUsage, clientIp, crawlPage, fetchProxyImage, isImageDomainAllowed, readUsageIn, readUsageRows, resetUsage } from './api-handlers';

/**
 * 개발 서버용 API — 운영(server.ts)과 **같은 핸들러**를 쓴다.
 *
 * 크롤링·프록시 로직은 api-handlers.ts 한 곳에만 있다. 여기 복사해 두면
 * 개발에서만 되고 배포하면 안 되는 상황이 다시 생긴다.
 */
export function apiPlugin(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/proxy-image', async (req, res) => {
        const json = (code: number, body: unknown) => {
          res.writeHead(code, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(body));
        };
        const url = new URL(req.url || '', 'http://localhost').searchParams.get('url');
        if (!url) return json(400, { error: 'Missing url parameter' });

        let parsed: URL;
        try { parsed = new URL(url); } catch { return json(400, { error: 'Invalid URL' }); }
        if (!['http:', 'https:'].includes(parsed.protocol)) return json(400, { error: 'Only HTTP(S) URLs allowed' });
        if (!isImageDomainAllowed(parsed.hostname)) return json(403, { error: 'Domain not allowed' });

        try {
          const { contentType, buffer } = await fetchProxyImage(url);
          // ACAO 를 붙여야 캔버스가 픽셀을 읽을 때 tainted 되지 않는다 (누끼 처리에 필요).
          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(buffer);
        } catch (err: any) {
          json(err?.status ?? 500, { error: err?.message ?? 'Failed to fetch image' });
        }
      });

      // 사용 기록 — 운영(server.ts)과 같은 핸들러를 쓴다
      server.middlewares.use('/api/log-usage', async (req, res) => {
        let body = '';
        for await (const chunk of req) body += chunk;
        try { await appendUsage(JSON.parse(body || '{}'), clientIp(req.headers as never, req.socket.remoteAddress)); }
        catch (err) { console.warn('usage log failed:', err); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });

      server.middlewares.use('/api/usage.json', async (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ rows: await readUsageRows() }));
      });

      server.middlewares.use('/api/usage/reset', async (_req, res) => {
        // 개발에서는 열쇠 없이 — 로컬 logs/usage.csv 만 건드린다
        const backup = await resetUsage();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, backup }));
      });

      server.middlewares.use('/api/usage.csv', async (req, res) => {
        // 개발에서는 열쇠 없이 본다 — 로컬에서만 뜨는 서버다
        const tz = new URL(req.url || '', 'http://localhost').searchParams.get('tz') || 'Asia/Seoul';
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
        res.end('\uFEFF' + (await readUsageIn(tz)));
      });

      server.middlewares.use('/api/crawl-page', async (req, res) => {
        const json = (code: number, body: unknown) => {
          res.writeHead(code, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(body));
        };
        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          return res.end();
        }
        if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

        let body = '';
        for await (const chunk of req) body += chunk;

        let pageUrl: string;
        try { pageUrl = JSON.parse(body).url; } catch { return json(400, { error: 'Invalid JSON body' }); }
        if (!pageUrl) return json(400, { error: 'Missing url' });

        try { json(200, await crawlPage(pageUrl)); }
        catch (err: any) { json(err?.status ?? 500, { error: err?.message ?? 'Failed to crawl page' }); }
      });
    },
  };
}
