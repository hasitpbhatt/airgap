const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Subscription-Token',
};

// Matched browser profiles including an authentic mobile footprint
const BROWSER_PROFILES = [
  {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  },
  {
    // Mobile Profile Profile (Diversity)
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Android WebView";v="122"',
    'Sec-Ch-Ua-Mobile': '?1',
    'Sec-Ch-Ua-Platform': '"Android"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
  }
];

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // 1. Try to serve from Cloudflare's Cache API first (Only valid for GET)
    const cache = caches.default;
    let cachedResponse = await cache.match(request);
    if (cachedResponse) {
      // Return cached response with CORS headers appended dynamically if necessary
      const newHeaders = new Headers(cachedResponse.headers);
      Object.keys(CORS).forEach(key => newHeaders.set(key, CORS[key]));
      return new Response(cachedResponse.body, { status: cachedResponse.status, headers: newHeaders });
    }

    const url = new URL(request.url).searchParams.get('url');
    if (!url) return new Response(JSON.stringify({ error: 'Missing "url"' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });

    let upstreamUrl;
    try { upstreamUrl = new URL(url); } catch { return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }); }

    const host = upstreamUrl.hostname;
    const now = Math.floor(Date.now() / 1000);
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (env.KV) {
      // 2. Strict Client-IP Rate Limit (Check block window)
      const clientBlock = await env.KV.get(`block:client:${clientIp}`);
      if (clientBlock && parseInt(clientBlock) > now) {
        return new Response(JSON.stringify({ error: 'Your IP is temporarily rate limited.' }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }

      // Upstream Domain specific temporary ban check (Back-off logic)
      const domainBlocked = await env.KV.get(`blocked:domain:${host}`);
      if (domainBlocked && parseInt(domainBlocked) > now) {
        return new Response(JSON.stringify({ error: `Domain ${host} is backed off (retry after ${parseInt(domainBlocked) - now}s)` }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }

      // Sliding window rate limiting per client IP (15 requests/min)
      const rlKey = `rl:client:${clientIp}`;
      const entry = await env.KV.get(rlKey, { type: 'json' }) || { timestamps: [] };
      const recent = entry.timestamps.filter(t => now - t < 60);

      if (recent.length >= 15) {
        // Punish malicious client IP with a 5-minute cooldown ban
        await env.KV.put(`block:client:${clientIp}`, String(now + 300), { expirationTtl: 300 });
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Banned for 5 minutes.' }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      recent.push(now);
      await env.KV.put(rlKey, JSON.stringify({ timestamps: recent }), { expirationTtl: 120 });
    }

    try {
      const profile = BROWSER_PROFILES[Math.floor(Math.random() * BROWSER_PROFILES.length)];
      const forwardHeaders = new Headers();
      
      Object.keys(profile).forEach(key => forwardHeaders.set(key, profile[key]));

      const clientAuth = request.headers.get('X-Subscription-Token');
      if (clientAuth) forwardHeaders.set('X-Subscription-Token', clientAuth);

      const resp = await fetch(url, {
        method: 'GET',
        headers: forwardHeaders,
        redirect: 'follow',
        cf: {
          cacheEverything: false,
          minify: { javascript: false, css: false, html: false },
          mirage: false
        }
      });

      // Handle Upstream 429 via KV Backoff
      if (resp.status === 429 && env.KV) {
        const retryAfter = parseInt(resp.headers.get('Retry-After')) || 60;
        await env.KV.put(`blocked:domain:${host}`, String(now + retryAfter), { expirationTtl: retryAfter });
      }

      // 3. Map Response headers starting from upstream response metadata
      const responseHeaders = new Headers(resp.headers);
      
      // Merge CORS
      Object.keys(CORS).forEach(key => responseHeaders.set(key, CORS[key]));
      
      // Fix: Stripping Content-Length allows proper edge streaming / chunked encoding transfers
      responseHeaders.delete('Content-Length');

      // 4. Cache Management for Successful Proxies
      const finalResponse = new Response(resp.body, { status: resp.status, headers: responseHeaders });
      
      if (resp.status === 200) {
        // Clone response before returning to feed it to Cache asynchronously
        const cacheResponse = finalResponse.clone();
        // Override Cache-Control to keep it alive on the edge for 5 minutes
        cacheResponse.headers.set('Cache-Control', 'public, max-age=300');
        ctx.waitUntil(cache.put(request, cacheResponse));
      }

      return finalResponse;

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
  },
};
