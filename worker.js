export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response(JSON.stringify({ error: 'Missing url parameter', status: 400 }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid url parameter', status: 400 }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    };

    const cacheKey = new Request(targetUrl.toString(), { headers, method: 'GET' });
    const cache = caches.default;

    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const json = await cachedResponse.json();
      json.cached = true;
      return new Response(JSON.stringify(json), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    try {
      const response = await fetch(targetUrl.toString(), {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });

      const content = await response.text();
      const result = {
        content,
        status: response.status,
        content_type: response.headers.get('content-type') || 'text/plain',
        url: target,
      };

      if (!response.ok) {
        result.error = `HTTP ${response.status}: ${response.statusText}`;
      }

      const body = JSON.stringify(result);
      const resp = new Response(body, {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });

      if (response.ok) {
        await cache.put(cacheKey, resp.clone());
      }

      return resp;
    } catch (err) {
      const result = { error: err.message, status: 502, url: target };
      if (err.name === 'TimeoutError') {
        result.error = 'Request timed out after 15s';
        result.status = 504;
      }
      return new Response(JSON.stringify(result), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
