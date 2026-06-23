async function handleFetchUrl(args) {
  const CACHE_TTL = 300000;
  const cacheKey = '_fetch_cache_' + encodeURIComponent(args.url);

  // Check domain block first (before cache, so blocked domains can't return stale data)
  try {
    const host = new URL(args.url).host;
    const blockRaw = llmStoreGet('_blocked_domain_' + host);
    if (blockRaw) {
      const block = JSON.parse(blockRaw);
      if (Date.now() < block.until) {
        return { error: 'Domain ' + host + ' is temporarily blocked (retry after ' + Math.ceil((block.until - Date.now()) / 1000) + 's)', blocked: true, retry_after: Math.ceil((block.until - Date.now()) / 1000) };
      }
    }
  } catch {}

  try {
    const cachedRaw = llmStoreGet(cacheKey);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return { ...cached, cached: true, age_ms: Date.now() - cached.timestamp };
      }
    }
  } catch {}

  var proxyUrls = ['https://airgap-fetch.gitub.workers.dev/'];
  if (settings.fetchUrl && settings.fetchUrl !== 'https://airgap-fetch.gitub.workers.dev/') {
    proxyUrls.push(settings.fetchUrl);
  }
  if (settings.backupFetchUrl) {
    proxyUrls.push(settings.backupFetchUrl);
  }
  var fallbackProxies = [
    'https://cors-anywhere.onrender.com',
    'https://api.allorigins.win/raw',
    'https://proxy.cors.sh',
    'https://corsfix.com'
  ];
  for (var fpi = 0; fpi < fallbackProxies.length; fpi++) {
    if (proxyUrls.indexOf(fallbackProxies[fpi]) === -1) proxyUrls.push(fallbackProxies[fpi]);
  }

  var lastErr = null;
  for (var pi = 0; pi < proxyUrls.length; pi++) {
    var fetchUrl = proxyUrls[pi];
    try {
      var proxyRes = await fetch(fetchUrl + '?url=' + encodeURIComponent(args.url), { signal: abortController?.signal });
      var data = await parseProxyResponse(proxyRes);

      if (data.status === 429 || data.error) {
        var host;
        try { host = new URL(args.url).host; } catch {}
        if (host && data.retry_after) {
          try { llmStoreSet('_blocked_domain_' + host, JSON.stringify({ until: Date.now() + data.retry_after * 1000 })); } catch {}
        }
        lastErr = data.error || ('HTTP ' + data.status);
        if (data.status === 429) {
          // Try backup proxy if available
          continue;
        }
        return { error: data.error || ('HTTP ' + data.status) };
      }

      if (data.content && !data.error && data.status === 200) {
        try {
          llmStoreSet(cacheKey, JSON.stringify({ ...data, timestamp: Date.now() }));
          var storedKey = '_fetched_' + encodeURIComponent(args.url);
          llmStoreSet(storedKey, data.content);
        } catch {}
        data.stored_key = '_fetched_' + encodeURIComponent(args.url);
      }
      // Apply optional offset/limit for partial reads
      if (data.content && (args.offset || args.limit)) {
        var contentOffset = Math.max(0, args.offset || 0);
        var totalLen = data.content.length;
        data.content = data.content.slice(contentOffset, args.limit > 0 ? contentOffset + args.limit : undefined);
        data.range = { offset: contentOffset, count: data.content.length, total: totalLen };
      }
      return { ...data, cached: false };
    } catch (err) {
      lastErr = err.message;
    }
  }

  return { error: 'All proxies failed: ' + lastErr };
}

async function handleSearchWeb(args) {
  try {
    const query = encodeURIComponent(args.query);

    var proxyUrls = ['https://airgap-fetch.gitub.workers.dev/'];
    if (settings.fetchUrl && settings.fetchUrl !== 'https://airgap-fetch.gitub.workers.dev/') {
      proxyUrls.push(settings.fetchUrl);
    }
    if (settings.backupFetchUrl) {
      proxyUrls.push(settings.backupFetchUrl);
    }
    var fallbackProxies = [
      'https://cors-anywhere.onrender.com',
      'https://api.allorigins.win/raw',
      'https://proxy.cors.sh',
      'https://corsfix.com'
    ];
    for (var fpi = 0; fpi < fallbackProxies.length; fpi++) {
      if (proxyUrls.indexOf(fallbackProxies[fpi]) === -1) proxyUrls.push(fallbackProxies[fpi]);
    }

    const searxngInstances = [
      'https://searx.be',
      'https://searx.tiekoetter.com',
      'https://opnxng.com',
      'https://search.sapti.me',
      'https://searx.perennialte.ch'
    ];

    const engines = [
      {
        name: 'DuckDuckGo',
        url: 'https://lite.duckduckgo.com/lite/?q=' + query,
        parse: function(html) {
          const results = [];
          const linkRe = /<a[^>]+href="([^"]*)"[^>]*rel="nofollow"[^>]*>([\s\S]*?)<\/a>/gi;
          const snippetRe = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
          const links = []; let m;
          while ((m = linkRe.exec(html)) !== null) links.push({ url: m[1], title: m[2].replace(/<[^>]+>/g, '').trim() });
          const snippets = [];
          while ((m = snippetRe.exec(html)) !== null) snippets.push(m[1].replace(/<[^>]+>/g, '').trim());
          for (let i = 0; i < Math.min(links.length, 10); i++) results.push({ title: links[i].title, url: links[i].url, snippet: snippets[i] || '' });
          return results;
        }
      },
      {
        name: 'SearXNG',
        instances: searxngInstances.flatMap(base => [
          base + '/search?q=' + query + '&format=json',
          base + '/search?q=' + query
        ]),
        parse: function(content) {
          try {
            const json = JSON.parse(content);
            if (json.results && Array.isArray(json.results)) {
              return json.results.slice(0, 10).map(r => ({
                title: r.title || '',
                url: r.url || '',
                snippet: r.content || ''
              }));
            }
          } catch {}
          try {
            const results = [];
            var articleRe = /<article[^>]*>([\s\S]*?)<\/article>/gi;
            var am;
            while ((am = articleRe.exec(content)) !== null) {
              var lm = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(am[1]);
              if (lm) {
                var title = lm[2].replace(/<[^>]+>/g, '').trim();
                var pRe = /<p[^>]*>([\s\S]*?)<\/p>/i;
                var pm = pRe.exec(am[1]);
                var snippet = pm ? pm[1].replace(/<[^>]+>/g, '').trim() : '';
                if (title) results.push({ title: title, url: lm[1], snippet: snippet });
                if (results.length >= 10) break;
              }
            }
            return results;
          } catch {}
          return [];
        }
      },
      {
        name: 'DDG Instant Answer',
        url: 'https://api.duckduckgo.com/?q=' + query + '&format=json&no_html=1&skip_disambig=1',
        direct: true,
        parse: function(content) {
          var json = JSON.parse(content);
          var results = [];
          if (json.AbstractText) results.push({ title: json.Heading || 'Summary', url: json.AbstractURL || '', snippet: json.AbstractText });
          if (json.Answer) results.push({ title: 'Answer', url: '', snippet: json.Answer });
          if (json.Definition) results.push({ title: json.Definition, url: json.DefinitionURL || '', snippet: json.DefinitionSource || '' });
          (json.RelatedTopics || []).slice(0, 5).forEach(function(t) {
            if (t.Text) results.push({ title: t.Text.split(' - ')[0], url: t.FirstURL || '', snippet: t.Text });
          });
          return results;
        }
      },
      {
        name: 'Ecosia',
        url: 'https://www.ecosia.org/search?q=' + query,
        parse: function(html) {
          const results = [];
          const re = new RegExp('<a[^>]+href="(https?://[^"]+)"[^>]*class="[^"]*result[^"]*"[^>]*>([\\s\\S]*?)<\\/a>', 'gi');
          let m;
          while ((m = re.exec(html)) !== null) {
            const title = m[2].replace(/<[^>]+>/g, '').trim();
            if (title && title.length > 3) results.push({ title, url: m[1], snippet: '' });
            if (results.length >= 10) break;
          }
          return results;
        }
      },
      {
        name: 'Bing',
        url: 'https://www.bing.com/search?q=' + query,
        parse: function(html) {
          const results = [];
          const re = new RegExp('<a[^>]+href="(https?://[^"]+)"[^>]*>([\\s\\S]*?)<\\/a>', 'gi');
          let m;
          while ((m = re.exec(html)) !== null) {
            const title = m[2].replace(/<[^>]+>/g, '').trim();
            if (title && title.length > 3 && !/bing|microsoft/i.test(title)) results.push({ title, url: m[1], snippet: '' });
            if (results.length >= 10) break;
          }
          return results;
        }
      },
      {
        name: 'Brave',
        url: 'https://search.brave.com/search?q=' + query,
        parse: function(html) {
          const results = [];
          const blockRe = /<div[^>]*class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
          const blocks = []; let m;
          while ((m = blockRe.exec(html)) !== null) blocks.push(m[1]);
          for (const block of blocks) {
            const linkRe = new RegExp('<a[^>]*href="(https?://[^"]+)"[^>]*>([\\s\\S]*?)<\\/a>', 'i');
            const lm = linkRe.exec(block);
            if (lm) {
              const title = lm[2].replace(/<[^>]+>/g, '').trim();
              if (title) results.push({ title, url: lm[1], snippet: block.replace(/<[^>]+>/g, '').replace(title, '').trim().slice(0, 200) });
            }
            if (results.length >= 10) break;
          }
          return results;
        }
      }
    ];

    const settled = await Promise.allSettled(engines.map(e => {
      if (e.direct) {
        return (async function() {
          try {
            var directRes = await fetch(e.url, { signal: abortController?.signal });
            if (directRes.ok) {
              var text = await directRes.text();
              return { engine: e.name, data: { content: text, status: directRes.status }, parse: e.parse };
            }
          } catch {}
          for (var dpi = 0; dpi < proxyUrls.length; dpi++) {
            try {
              var proxyRes = await fetch(proxyUrls[dpi] + '?url=' + encodeURIComponent(e.url), { signal: abortController?.signal });
              var d = await parseProxyResponse(proxyRes);
              if (!d.error && d.content && d.content.length > 50) return { engine: e.name, data: d, parse: e.parse };
            } catch {}
          }
          throw new Error('All attempts failed for ' + e.name);
        })();
      }
      if (e.instances) {
        return (async () => {
          for (const url of e.instances) {
            try {
              const directRes = await fetch(url, { signal: abortController?.signal });
              if (directRes.ok) {
                if (url.includes('format=json')) {
                  const json = await directRes.json();
                  if (json.results && Array.isArray(json.results) && json.results.length > 0) {
                    return { engine: e.name, data: { content: JSON.stringify(json) }, parse: e.parse };
                  }
                } else {
                  const html = await directRes.text();
                  if (html.length > 100) {
                    return { engine: e.name, data: { content: html }, parse: e.parse };
                  }
                }
              }
            } catch {}
            for (var spi = 0; spi < proxyUrls.length; spi++) {
              try {
                const proxyRes = await fetch(proxyUrls[spi] + '?url=' + encodeURIComponent(url), { signal: abortController?.signal });
                const d = await parseProxyResponse(proxyRes);
                if (!d.error && d.content && d.content.length > 100) {
                  return { engine: e.name, data: d, parse: e.parse };
                }
              } catch {}
            }
          }
          throw new Error('All SearXNG instances failed');
        })();
      }
      return (async () => {
        for (var ppi = 0; ppi < proxyUrls.length; ppi++) {
          try {
            var proxyRes = await fetch(proxyUrls[ppi] + '?url=' + encodeURIComponent(e.url), { signal: abortController?.signal });
            var d = await parseProxyResponse(proxyRes);
            if (!d.error && d.content && d.content.length > 100) return { engine: e.name, data: d, parse: e.parse };
          } catch {}
        }
        throw new Error('All proxies failed for ' + e.name);
      })();
    }));

    const priority = ['SearXNG', 'DDG Instant Answer', 'DuckDuckGo', 'Ecosia', 'Bing', 'Brave'];
    for (const name of priority) {
      const entry = settled.find(s => s.status === 'fulfilled' && s.value.engine === name);
      if (!entry) continue;
      const { data, parse } = entry.value;
      if (data.error || data.status === 429 || !data.content || data.content.length < 100) continue;
      const results = parse(data.content);
      if (results.length > 0) {
        return { query: args.query, engine: name, results, count: results.length };
      }
    }

    const lastErr = settled.find(s => s.status === 'rejected')?.reason?.message || 'no results from any engine';
    return { error: 'All search engines failed. ' + lastErr };
  } catch (err) {
    return { error: 'Search failed: ' + err.message };
  }
}

async function handleReadRss(args) {
  try {
    var rssProxyUrl = settings.fetchUrl && settings.fetchUrl !== 'https://airgap-fetch.gitub.workers.dev/' ? settings.fetchUrl : 'https://airgap-fetch.gitub.workers.dev/';
    const limit = Math.min(args.limit || 10, 50);
    const proxyRes = await fetch(rssProxyUrl + '?url=' + encodeURIComponent(args.url), {
      signal: abortController?.signal
    });
    if (!proxyRes.ok) {
      return { error: 'Failed to fetch feed: HTTP ' + proxyRes.status };
    }
    const data = await parseProxyResponse(proxyRes);
    if (data.error) return { error: 'Feed fetch error: ' + data.error };
    const xml = data.content || '';
    if (!xml) return { error: 'Empty response from feed URL' };

    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) return { error: 'XML parse error: ' + parseError.textContent };

    const items = [];

    // RSS 2.0
    const rssItems = doc.querySelectorAll('rss > channel > item');
    if (rssItems.length > 0) {
      rssItems.forEach(item => {
        if (items.length >= limit) return;
        const title = item.querySelector('title')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';
        const desc = item.querySelector('description')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || item.querySelector('dc\\:date')?.textContent || '';
        const creator = item.querySelector('dc\\:creator')?.textContent || '';
        items.push({ title: title.trim(), link: link.trim(), summary: stripHtml(desc).trim().slice(0, 500), date: pubDate.trim(), author: creator.trim() });
      });
    }

    // Atom
    const atomEntries = doc.querySelectorAll('feed > entry');
    if (atomEntries.length > 0) {
      atomEntries.forEach(entry => {
        if (items.length >= limit) return;
        const title = entry.querySelector('title')?.textContent || '';
        const link = entry.querySelector('link[rel="alternate"]')?.getAttribute('href') || entry.querySelector('link')?.getAttribute('href') || '';
        const content = entry.querySelector('content')?.textContent || entry.querySelector('summary')?.textContent || '';
        const published = entry.querySelector('published')?.textContent || entry.querySelector('updated')?.textContent || '';
        const author = entry.querySelector('author > name')?.textContent || '';
        items.push({ title: title.trim(), link: link.trim(), summary: stripHtml(content).trim().slice(0, 500), date: published.trim(), author: author.trim() });
      });
    }

    // RSS 1.0 / RDF
    const rdfItems = doc.querySelectorAll('rdf\\:RDF > rdf\\:item, RDF > item');
    if (rdfItems.length > 0) {
      rdfItems.forEach(item => {
        if (items.length >= limit) return;
        const title = item.querySelector('title')?.textContent || item.querySelector('rdf\\:title')?.textContent || '';
        const link = item.querySelector('link')?.textContent || item.querySelector('rdf\\:link')?.getAttribute('resource') || '';
        const desc = item.querySelector('description')?.textContent || '';
        const date = item.querySelector('dc\\:date')?.textContent || '';
        const creator = item.querySelector('dc\\:creator')?.textContent || '';
        items.push({ title: title.trim(), link: link.trim(), summary: stripHtml(desc).trim().slice(0, 500), date: date.trim(), author: creator.trim() });
      });
    }

    if (items.length === 0) return { error: 'No items found in the feed' };

    const feedTitle = doc.querySelector('channel > title')?.textContent || doc.querySelector('feed > title')?.textContent || '';
    return { feed: args.url, feed_title: feedTitle.trim(), items, count: items.length };
  } catch (err) {
    return { error: 'RSS read failed: ' + err.message };
  }
}
