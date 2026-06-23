async function parseProxyResponse(res) {
  var text = await res.text();
  try {
    var json = JSON.parse(text);
    if (json.content !== undefined || json.error !== undefined || json.status !== undefined) {
      return json;
    }
  } catch {}
  return { content: text, status: res.status, content_type: res.headers.get('content-type') || 'text/plain' };
}

async function executeToolCall(toolCall) {
  const { name, arguments: argsRaw } = toolCall.function;
  let args;
  try {
    args = JSON.parse(argsRaw);
  } catch {
    return { error: `Invalid tool arguments: ${argsRaw}` };
  }

  if (name === 'fetch_url') {
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
        return { ...data, cached: false };
      } catch (err) {
        lastErr = err.message;
      }
    }

    return { error: 'All proxies failed: ' + lastErr };
  }

  if (name === 'store_value') {
    try {
      llmStoreSet(args.key, args.value);
      return { success: true, key: args.key };
    } catch (err) {
      return { error: err.message };
    }
  }

  if (name === 'read_value') {
    try {
      const value = llmStoreGet(args.key);
      if (value === null) return { error: `Key not found: ${args.key}` };
      return { key: args.key, value };
    } catch (err) {
      return { error: err.message };
    }
  }

  if (name === 'list_stored_keys') {
    try {
      return { keys: llmStoreListKeys() };
    } catch (err) {
      return { error: err.message };
    }
  }

  if (name === 'delete_value') {
    try {
      llmStoreDelete(args.key);
      return { success: true, key: args.key };
    } catch (err) {
      return { error: err.message };
    }
  }

  if (name === 'compact') {
    const summary = args.summary;
    if (!summary) return { error: 'Summary is required' };
    const activeChat = getActiveChat();
    if (!activeChat) return { error: 'No active chat' };

    const systemMsg = activeChat.messages.find(m => m.role === 'system');
    const newMessages = [];
    if (systemMsg) newMessages.push({ ...systemMsg });
    newMessages.push({ role: 'assistant', content: `[Conversation compacted]\n\n${summary}` });

    const userMessages = activeChat.messages.filter(m => m.role === 'user');
    if (userMessages.length > 0) {
      newMessages.push({ ...userMessages[userMessages.length - 1] });
    }

    activeChat.messages = newMessages;
    saveChats();
    return { success: true, message: 'Conversation compacted successfully' };
  }

  if (name === 'calculate') {
    try {
      const result = Function('"use strict"; return (' + args.expression + ')')();
      return { expression: args.expression, result, type: typeof result };
    } catch (err) {
      return { error: `Invalid expression: ${err.message}` };
    }
  }

  if (name === 'get_current_time') {
    const now = new Date();
    return {
      iso: now.toISOString(),
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekday: now.toLocaleDateString(undefined, { weekday: 'long' })
    };
  }

  if (name === 'search_web') {
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

  if (name === 'remember') {
    try {
      globalStoreSet(args.key, args.value);
      refreshMemoryPanelIfOpen();
      return { success: true, key: args.key };
    } catch (err) {
      return { error: err.message };
    }
  }

  if (name === 'recall') {
    try {
      const keyword = args.keyword;
      const allKeys = globalStoreListKeys();
      if (allKeys.length === 0) {
        return { result: 'No data stored in global memory yet.' };
      }

      const exact = globalStoreGet(keyword);
      if (exact !== null) {
        return { key: keyword, value: exact, source: 'exact_match' };
      }

      const matches = allKeys.filter(k => k.toLowerCase().includes(keyword.toLowerCase()));
      if (matches.length === 0) {
        return { result: 'No matching keys found in global memory for: ' + keyword, all_keys: allKeys };
      }

      const values = {};
      matches.forEach(k => { values[k] = globalStoreGet(k); });
      return { matches, values, count: matches.length, source: 'substring_match' };
    } catch (err) {
      return { error: err.message };
    }
  }

  if (name === 'forget') {
    try {
      globalStoreDelete(args.key);
      refreshMemoryPanelIfOpen();
      return { success: true, key: args.key };
    } catch (err) {
      return { error: err.message };
    }
  }

  if (name === 'forget_all') {
    try {
      globalStoreClear();
      refreshMemoryPanelIfOpen();
      return { success: true, message: 'All global memory cleared.' };
    } catch (err) {
      return { error: err.message };
    }
  }

  if (name === 'send_notification') {
    if (!('Notification' in window)) {
      return { error: 'Notifications not supported in this browser' };
    }
    if (Notification.permission === 'denied') {
      return { error: 'Notification permission was denied' };
    }
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        return { error: 'Notification permission not granted' };
      }
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(args.title || 'Notification', { body: args.body || '' });
    } catch {
      new Notification(args.title || 'Notification', { body: args.body || '' });
    }
    return { success: true, title: args.title, body: args.body };
  }

  if (name === 'notes_create') {
    try {
      noteStoreSet(args.key, args.content);
      return { success: true, key: args.key };
    } catch (err) { return { error: err.message }; }
  }

  if (name === 'notes_read') {
    try {
      const val = noteStoreGet(args.key);
      if (val === null) return { error: 'Note not found: ' + args.key };
      return { key: args.key, content: val };
    } catch (err) { return { error: err.message }; }
  }

  if (name === 'notes_list') {
    try {
      const allKeys = noteStoreListKeys();
      if (allKeys.length === 0) return { result: 'No notes yet.' };
      const query = (args.query || '').toLowerCase();
      const matches = query ? allKeys.filter(k => k.toLowerCase().includes(query)) : allKeys;
      if (matches.length === 0) return { result: 'No notes matching: ' + args.query, all_keys: allKeys };
      const notes = {};
      matches.forEach(k => { notes[k] = (noteStoreGet(k) || '').substring(0, 200); });
      return { notes: notes, count: matches.length };
    } catch (err) { return { error: err.message }; }
  }

  if (name === 'notes_delete') {
    try {
      noteStoreDelete(args.key);
      return { success: true, key: args.key };
    } catch (err) { return { error: err.message }; }
  }

  if (name === 'set_setting') {
    const key = args.key;
    const value = args.value;
    if (key === 'proxyUrl') {
      settings.proxyUrl = value;
      elements.proxyUrlInput.value = value;
    } else if (key === 'modelName') {
      settings.modelName = value;
      elements.modelNameInput.value = value;
      // Select "custom" if the model name doesn't match a preset option
      var customFound = false;
      var opts = elements.modelSelect.options;
      for (var i = 0; i < opts.length; i++) {
        if (opts[i].value === value) {
          elements.modelSelect.value = value;
          customFound = true;
          break;
        }
      }
      if (!customFound) {
        elements.modelSelect.value = 'custom';
        elements.modelNameInput.value = value;
        elements.modelNameInput.disabled = false;
      }
    } else if (key === 'persona') {
      if (PERSONAS[value]) {
        settings.currentPersona = value;
        elements.personaSelect.value = value;
        if (value === 'custom') {
          elements.systemPromptTextarea.value = settings.customSystemPrompt || '';
          elements.systemPromptTextarea.disabled = false;
        } else {
          elements.systemPromptTextarea.value = PERSONAS[value].system;
          elements.systemPromptTextarea.disabled = true;
        }
      }
    }
    saveSettings();
    return { success: true, key: key, value: value };
  }

  if (name === 'clipboard_write') {
    const clipId = 'clip-' + toolCall.id;
    pendingClipboard.push({ toolCallId: toolCall.id, clipId, text: args.text || '' });
    return { success: true, length: (args.text || '').length };
  }

  if (name === 'generate_chart') {
    const chartConfig = {
      type: args.type || 'bar',
      title: args.title || '',
      labels: args.labels || [],
      datasets: args.datasets || []
    };
    pendingCharts.push({ toolCallId: toolCall.id, config: chartConfig });
    return { success: true, type: chartConfig.type, title: chartConfig.title, dataPoints: chartConfig.labels.length };
  }

  if (name === 'save_file') {
    const filename = args.filename || 'download.txt';
    const content = args.content || '';
    const fileId = 'file-' + toolCall.id;
    pendingDownloads.push({ toolCallId: toolCall.id, fileId, filename, content });

    const activeChat = getActiveChat();
    if (activeChat) {
      if (!activeChat.savedFiles) activeChat.savedFiles = [];
      activeChat.savedFiles.push({ fileId, filename, size: content.length, ts: Date.now() });
      saveChats();
    }

    return { success: true, filename, size: content.length };
  }

  if (name === 'read_rss') {
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

  if (name === 'github_get_contents') {
    if (!githubToken) return { error: 'GitHub token not configured. Add one in Settings.' };
    if (typeof Octokit === 'undefined') return { error: 'GitHub API library not loaded. Please refresh the page.' };
    try {
      const octokit = new Octokit({ auth: githubToken });
      const response = await octokit.rest.repos.getContent({
        owner: args.owner, repo: args.repo, path: args.path,
        ...(args.ref ? { ref: args.ref } : {})
      });
      const data = response.data;
      let content = '';
      if (data.type === 'file' && data.content) {
        content = decodeURIComponent(escape(atob(data.content)));
      }
      return { sha: data.sha, content, size: data.size, encoding: data.encoding, html_url: data.html_url, path: data.path, type: data.type, name: data.name };
    } catch (err) {
      return { error: err.message };
    }
  }

  if (name === 'github_create_or_update_file') {
    if (!githubToken) return { error: 'GitHub token not configured. Add one in Settings.' };
    if (typeof Octokit === 'undefined') return { error: 'GitHub API library not loaded. Please refresh the page.' };
    try {
      const octokit = new Octokit({ auth: githubToken });
      const encoded = btoa(unescape(encodeURIComponent(args.content)));
      const response = await octokit.rest.repos.createOrUpdateFileContents({
        owner: args.owner, repo: args.repo, path: args.path,
        message: args.message, content: encoded, branch: args.branch,
        ...(args.sha ? { sha: args.sha } : {})
      });
      const data = response.data;
      return { content: { html_url: data.content.html_url }, commit: { sha: data.commit.sha, html_url: data.commit.html_url } };
    } catch (err) {
      return { error: err.message };
    }
  }

  if (name === 'github_create_pr') {
    if (!githubToken) return { error: 'GitHub token not configured. Add one in Settings.' };
    if (typeof Octokit === 'undefined') return { error: 'GitHub API library not loaded. Please refresh the page.' };
    try {
      const octokit = new Octokit({ auth: githubToken });
      const response = await octokit.rest.pulls.create({
        owner: args.owner, repo: args.repo, title: args.title,
        head: args.head, base: args.base,
        ...(args.body ? { body: args.body } : {}),
        ...(args.draft ? { draft: true } : {})
      });
      const data = response.data;
      return { html_url: data.html_url, number: data.number, state: data.state, title: data.title };
    } catch (err) {
      return { error: err.message };
    }
  }

  if (name === 'github_create_issue') {
    if (!githubToken) return { error: 'GitHub token not configured. Add one in Settings.' };
    if (typeof Octokit === 'undefined') return { error: 'GitHub API library not loaded. Please refresh the page.' };
    try {
      const octokit = new Octokit({ auth: githubToken });
      const response = await octokit.rest.issues.create({
        owner: args.owner, repo: args.repo, title: args.title,
        ...(args.body ? { body: args.body } : {}),
        ...(args.labels ? { labels: args.labels } : {}),
        ...(args.assignees ? { assignees: args.assignees } : {})
      });
      const data = response.data;
      return { html_url: data.html_url, number: data.number, state: data.state, title: data.title };
    } catch (err) {
      return { error: err.message };
    }
  }

  return { error: `Unknown tool: ${name}` };
}

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

function appendToolCallUI(toolCall) {
  const { name, arguments: argsRaw } = toolCall.function;

  const loadingBubble = document.getElementById('temp-loading-bubble');
  const row = document.createElement('div');
  row.className = 'message-row tool-call';
  row.id = `tool-call-${toolCall.id}`;

  if (name === 'fetch_url') {
    let url = '';
    try { url = JSON.parse(argsRaw).url || argsRaw; } catch { url = argsRaw; }
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble">
        <div class="msg-content">
          <i data-lucide="globe" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          <span class="tool-call-label">Fetching:</span>
          <code class="tool-call-url">${escapeHtml(url)}</code>
          <span class="tool-call-status">...</span>
        </div>
      </div>
    `;
  } else if (name === 'search_web') {
    let query = '';
    try { query = JSON.parse(argsRaw).query || ''; } catch {}
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble">
        <div class="msg-content">
          <i data-lucide="search" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          <span class="tool-call-label">Searching:</span>
          <code class="tool-call-url">${escapeHtml(query)}</code>
          <span class="tool-call-status">...</span>
        </div>
      </div>
    `;
  } else if (name === 'send_notification') {
    row.innerHTML = '<div class="message-bubble tool-call-bubble"><div class="msg-content"><i data-lucide="bell" style="width: 14px; height: 14px; vertical-align: middle;"></i><span class="tool-call-label">Sending notification...</span><span class="tool-call-status">...</span></div></div>';
  } else if (name === 'notes_create') {
    row.innerHTML = '<div class="message-bubble tool-call-bubble"><div class="msg-content"><i data-lucide="file-text" style="width: 14px; height: 14px; vertical-align: middle;"></i><span class="tool-call-label">Saving note...</span><span class="tool-call-status">...</span></div></div>';
  } else if (name === 'notes_read') {
    row.innerHTML = '<div class="message-bubble tool-call-bubble"><div class="msg-content"><i data-lucide="file-text" style="width: 14px; height: 14px; vertical-align: middle;"></i><span class="tool-call-label">Reading note...</span><span class="tool-call-status">...</span></div></div>';
  } else if (name === 'notes_list') {
    row.innerHTML = '<div class="message-bubble tool-call-bubble"><div class="msg-content"><i data-lucide="list" style="width: 14px; height: 14px; vertical-align: middle;"></i><span class="tool-call-label">Listing notes...</span><span class="tool-call-status">...</span></div></div>';
  } else if (name === 'notes_delete') {
    row.innerHTML = '<div class="message-bubble tool-call-bubble"><div class="msg-content"><i data-lucide="trash-2" style="width: 14px; height: 14px; vertical-align: middle;"></i><span class="tool-call-label">Deleting note...</span><span class="tool-call-status">...</span></div></div>';
  } else if (name === 'set_setting') {
    let key = '';
    try { key = JSON.parse(argsRaw).key || ''; } catch {}
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble">
        <div class="msg-content">
          <i data-lucide="settings" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          <span class="tool-call-label">Changing ${escapeHtml(key)}...</span>
          <span class="tool-call-status">...</span>
        </div>
      </div>
    `;
  } else if (name === 'clipboard_write') {
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble">
        <div class="msg-content">
          <i data-lucide="clipboard" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          <span class="tool-call-label">Copying to clipboard...</span>
          <span class="tool-call-status">...</span>
        </div>
      </div>
    `;
  } else if (name === 'generate_chart') {
    let title = '';
    try { title = JSON.parse(argsRaw).title || ''; } catch {}
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble">
        <div class="msg-content">
          <i data-lucide="bar-chart-3" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          <span class="tool-call-label">Generating chart:</span>
          <code class="tool-call-url">${escapeHtml(title)}</code>
          <span class="tool-call-status">...</span>
        </div>
      </div>
    `;
  } else if (name === 'save_file') {
    let filename = '';
    try { filename = JSON.parse(argsRaw).filename || ''; } catch {}
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble">
        <div class="msg-content">
          <i data-lucide="download" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          <span class="tool-call-label">Saving:</span>
          <code class="tool-call-url">${escapeHtml(filename)}</code>
          <span class="tool-call-status">...</span>
        </div>
      </div>
    `;
  } else if (name === 'read_rss') {
    let url = '';
    try { url = JSON.parse(argsRaw).url || argsRaw; } catch { url = argsRaw; }
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble">
        <div class="msg-content">
          <i data-lucide="rss" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          <span class="tool-call-label">Reading feed:</span>
          <code class="tool-call-url">${escapeHtml(url)}</code>
          <span class="tool-call-status">...</span>
        </div>
      </div>
    `;
  } else if (name === 'github_get_contents') {
    let path = '';
    try { path = JSON.parse(argsRaw).path || ''; } catch {}
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble">
        <div class="msg-content">
          <i data-lucide="github" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          <span class="tool-call-label">Reading from GitHub:</span>
          <code class="tool-call-url">${escapeHtml(path)}</code>
          <span class="tool-call-status">...</span>
        </div>
      </div>
    `;
  } else if (name === 'github_create_or_update_file') {
    let path = '';
    try { path = JSON.parse(argsRaw).path || ''; } catch {}
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble">
        <div class="msg-content">
          <i data-lucide="git-commit" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          <span class="tool-call-label">Committing to GitHub:</span>
          <code class="tool-call-url">${escapeHtml(path)}</code>
          <span class="tool-call-status">...</span>
        </div>
      </div>
    `;
  } else if (name === 'github_create_pr') {
    let title = '';
    try { title = JSON.parse(argsRaw).title || ''; } catch {}
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble">
        <div class="msg-content">
          <i data-lucide="git-pull-request" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          <span class="tool-call-label">Creating PR:</span>
          <code class="tool-call-url">${escapeHtml(title)}</code>
          <span class="tool-call-status">...</span>
        </div>
      </div>
    `;
  } else if (name === 'github_create_issue') {
    let title = '';
    try { title = JSON.parse(argsRaw).title || ''; } catch {}
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble">
        <div class="msg-content">
          <i data-lucide="circle-alert" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          <span class="tool-call-label">Creating issue:</span>
          <code class="tool-call-url">${escapeHtml(title)}</code>
          <span class="tool-call-status">...</span>
        </div>
      </div>
    `;
  } else if (name === 'compact') {
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble">
        <div class="msg-content">
          <i data-lucide="file-text" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          <span class="tool-call-label">Compacting conversation...</span>
          <span class="tool-call-status">...</span>
        </div>
      </div>
    `;
  } else {
    let key = '';
    try { key = JSON.parse(argsRaw).key || ''; } catch {}
    const storageLabels = {
      store_value: 'Storing:',
      read_value: 'Reading:',
      list_stored_keys: 'Listing keys',
      delete_value: 'Deleting:'
    };
    const memoryLabels = {
      remember: 'Remembering:',
      recall: 'Recalling:',
      forget: 'Forgetting:',
      forget_all: 'Clearing all memory'
    };
    const isMemory = memoryLabels[name];
    const iconName = isMemory ? 'brain' : 'database';
    const label = storageLabels[name] || memoryLabels[name] || name;
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble">
        <div class="msg-content">
          <i data-lucide="${iconName}" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          <span class="tool-call-label">${label}</span>
          ${key ? `<code class="tool-call-url">${escapeHtml(key)}</code>` : ''}
          <span class="tool-call-status">...</span>
        </div>
      </div>
    `;
  }

  if (loadingBubble) {
    elements.chatFeed.insertBefore(row, loadingBubble);
  } else {
    elements.chatFeed.appendChild(row);
  }

  tryAutoScroll();
  lucide.createIcons();
}

function updateToolCallUI(toolCall, result) {
  const row = document.getElementById(`tool-call-${toolCall.id}`);
  if (!row) return;

  const name = toolCall.function.name;

  if (result.error) {
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-error">
        <div class="msg-content">
          <i data-lucide="alert-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--danger));"></i>
          <span class="tool-call-label">${name} failed:</span>
          <code class="tool-call-url">${escapeHtml(result.error)}</code>
        </div>
      </div>
    `;
  } else if (name === 'fetch_url') {
    const preview = (result.content || '').slice(0, 80).replace(/\s+/g, ' ').trim();
    const cacheLabel = result.cached ? `<span class="tool-call-detail">(cached ${(result.age_ms / 1000).toFixed(0)}s ago)</span>` : '';
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-done">
        <div class="msg-content">
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>
          <span class="tool-call-label">Fetched:</span>
          <code class="tool-call-url">${result.status} OK</code>
          <span class="tool-call-detail">(${(result.content || '').length} bytes)</span>
          ${cacheLabel}
        </div>
      </div>
    `;
  } else if (name === 'search_web') {
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-done">
        <div class="msg-content">
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>
          <span class="tool-call-label">Search done:</span>
          <code class="tool-call-url">${result.count || 0} results</code>
        </div>
      </div>
    `;
  } else if (name === 'send_notification') {
    row.innerHTML = '<div class="message-bubble tool-call-bubble tool-call-done"><div class="msg-content"><i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i><span class="tool-call-label">Notification sent</span><span class="tool-call-detail">' + escapeHtml(result.title) + '</span></div></div>';
  } else if (name === 'notes_create') {
    row.innerHTML = '<div class="message-bubble tool-call-bubble tool-call-done"><div class="msg-content"><i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i><span class="tool-call-label">Note saved:</span><code class="tool-call-url">' + escapeHtml(result.key) + '</code></div></div>';
  } else if (name === 'notes_read') {
    row.innerHTML = '<div class="message-bubble tool-call-bubble tool-call-done"><div class="msg-content" style="flex-direction:column;align-items:stretch;"><div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem;"><i data-lucide="file-text" style="width:14px;height:14px;flex-shrink:0;color:hsl(var(--success));"></i><span class="tool-call-label">Note:</span><code class="tool-call-url">' + escapeHtml(result.key) + '</code></div><pre style="font-size:0.7rem;white-space:pre-wrap;word-break:break-word;background:hsl(var(--bg-subtle));padding:0.35rem;border-radius:0.25rem;margin:0;max-height:200px;overflow-y:auto;color:hsl(var(--text-secondary));">' + escapeHtml(result.content) + '</pre></div></div>';
  } else if (name === 'notes_list') {
    var noteSummary = result.notes ? Object.keys(result.notes).map(function (k) { return k + ': ' + (result.notes[k] || '').substring(0, 80); }).join('\n') : (result.result || 'No results');
    row.innerHTML = '<div class="message-bubble tool-call-bubble tool-call-done"><div class="msg-content" style="flex-direction:column;align-items:stretch;"><div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem;"><i data-lucide="check-circle" style="width:14px;height:14px;flex-shrink:0;color:hsl(var(--success));"></i><span class="tool-call-label">Notes:</span><span class="tool-call-detail">' + (result.count || 0) + ' found</span></div><pre style="font-size:0.7rem;white-space:pre-wrap;word-break:break-word;background:hsl(var(--bg-subtle));padding:0.35rem;border-radius:0.25rem;margin:0;max-height:200px;overflow-y:auto;color:hsl(var(--text-secondary));">' + escapeHtml(noteSummary) + '</pre></div></div>';
  } else if (name === 'notes_delete') {
    row.innerHTML = '<div class="message-bubble tool-call-bubble tool-call-done"><div class="msg-content"><i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i><span class="tool-call-label">Note deleted:</span><code class="tool-call-url">' + escapeHtml(result.key) + '</code></div></div>';
  } else if (name === 'set_setting') {
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-done">
        <div class="msg-content">
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>
          <span class="tool-call-label">Setting changed:</span>
          <code class="tool-call-url">${escapeHtml(result.key)}</code>
          <span class="tool-call-detail">= ${escapeHtml((result.value || '').substring(0, 50))}</span>
        </div>
      </div>
    `;
  } else if (name === 'clipboard_write') {
    const clipId = 'clip-' + toolCall.id;
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-done">
        <div class="msg-content">
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>
          <span class="tool-call-label">Clipboard:</span>
          <span class="tool-call-detail">${result.length} chars</span>
          <button class="btn-clipboard-copy" data-clip-id="${clipId}">
            <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
            Click to copy
          </button>
        </div>
      </div>
    `;
  } else if (name === 'generate_chart') {
    const chartEntry = pendingCharts.find(d => d.toolCallId === toolCall.id);
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-done">
        <div class="msg-content" style="flex-direction: column; align-items: stretch;">
          <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.3rem;">
            <i data-lucide="check-circle" style="width: 14px; height: 14px; flex-shrink: 0; color: hsl(var(--success));"></i>
            <span class="tool-call-label">Chart:</span>
            <code class="tool-call-url">${escapeHtml(result.title)}</code>
            <span class="tool-call-detail">(${result.type})</span>
          </div>
          <canvas class="chart-canvas" width="280" height="180"></canvas>
        </div>
      </div>
    `;
    if (chartEntry) {
      const canvas = row.querySelector('.chart-canvas');
      if (canvas) drawChart(canvas, chartEntry.config);
    }
  } else if (name === 'save_file') {
    const fileId = 'file-' + toolCall.id;
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-done">
        <div class="msg-content">
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>
          <span class="tool-call-label">File ready:</span>
          <code class="tool-call-url">${escapeHtml(result.filename)}</code>
          <span class="tool-call-detail">(${result.size} bytes)</span>
          <button class="btn-download-file" data-file-id="${fileId}">
            <i data-lucide="download" style="width: 12px; height: 12px;"></i>
            Download
          </button>
        </div>
      </div>
    `;
  } else if (name === 'read_rss') {
    const feedTitle = result.feed_title || 'Feed';
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-done">
        <div class="msg-content">
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>
          <span class="tool-call-label">Feed read:</span>
          <code class="tool-call-url">${escapeHtml(feedTitle)}</code>
          <span class="tool-call-detail">(${result.count || 0} items)</span>
        </div>
      </div>
    `;
  } else if (name === 'github_get_contents') {
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-done">
        <div class="msg-content">
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>
          <span class="tool-call-label">Read:</span>
          <code class="tool-call-url">${escapeHtml(result.path)}</code>
          <span class="tool-call-detail">(${result.size} bytes, ${result.type})</span>
        </div>
      </div>
    `;
  } else if (name === 'github_create_or_update_file') {
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-done">
        <div class="msg-content">
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>
          <span class="tool-call-label">Committed:</span>
          <code class="tool-call-url">${escapeHtml(result.commit.sha.slice(0, 7))}</code>
          <span class="tool-call-detail"><a href="${escapeHtml(result.content.html_url)}" target="_blank" rel="noopener">view file</a></span>
        </div>
      </div>
    `;
  } else if (name === 'github_create_pr') {
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-done">
        <div class="msg-content">
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>
          <span class="tool-call-label">PR created:</span>
          <code class="tool-call-url">#${result.number}</code>
          <span class="tool-call-detail"><a href="${escapeHtml(result.html_url)}" target="_blank" rel="noopener">open</a></span>
        </div>
      </div>
    `;
  } else if (name === 'github_create_issue') {
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-done">
        <div class="msg-content">
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>
          <span class="tool-call-label">Issue created:</span>
          <code class="tool-call-url">#${result.number}</code>
          <span class="tool-call-detail"><a href="${escapeHtml(result.html_url)}" target="_blank" rel="noopener">open</a></span>
        </div>
      </div>
    `;
  } else {
    const doneLabels = {
      send_notification: 'Notification sent',
      notes_create: 'Note saved',
      notes_read: 'Note read',
      notes_list: 'Notes listed',
      notes_delete: 'Note deleted',
      remember: 'Memory stored',
      recall: 'Memory recalled',
      forget: 'Memory deleted',
      forget_all: 'All memory cleared'
    };
    const doneLabel = doneLabels[name] || (name + ' OK');
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-done">
        <div class="msg-content">
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>
          <span class="tool-call-label">${doneLabel}</span>
        </div>
      </div>
    `;
  }

  tryAutoScroll();
  lucide.createIcons();
}

function drawChart(canvas, config) {
  const ctx = canvas.getContext('2d');
  const { type, title, labels, datasets } = config;
  const w = canvas.width;
  const h = canvas.height;
  const pad = { top: 28, bottom: 36, left: 44, right: 12 };
  const colors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];
  const textColor = '#a1a1aa';
  const axisColor = 'rgba(255,255,255,0.12)';
  function getColor(i) { return colors[i % colors.length]; }

  ctx.clearRect(0, 0, w, h);

  if (title) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, w / 2, 4);
  }

  if (!labels || labels.length === 0) {
    ctx.fillStyle = textColor;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data', w / 2, h / 2);
    return;
  }

  if (type === 'pie') {
    const cx = w / 2;
    const cy = h / 2 + 6;
    const radius = Math.min(w / 2 - 28, h / 2 - 34);
    const dataset = datasets && datasets[0] ? datasets[0].data : [];
    const total = dataset.reduce(function (s, v) { return s + v; }, 0);
    if (total === 0) {
      ctx.fillStyle = textColor;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data', cx, cy);
      return;
    }
    var startAngle = -Math.PI / 2;
    dataset.forEach(function (val, i) {
      if (val <= 0) return;
      var sliceAngle = (val / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = getColor(i);
      ctx.fill();
      if (sliceAngle > 0.25) {
        var midAngle = startAngle + sliceAngle / 2;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(val / total * 100) + '%', cx + Math.cos(midAngle) * (radius * 0.6), cy + Math.sin(midAngle) * (radius * 0.6));
      }
      startAngle += sliceAngle;
    });
    return;
  }

  var left = pad.left;
  var right = w - pad.right;
  var top = pad.top + 4;
  var bottom = h - pad.bottom;
  var cw = right - left;
  var ch = bottom - top;

  ctx.strokeStyle = axisColor;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.stroke();

  var maxVal = 0;
  datasets.forEach(function (ds) {
    ds.data.forEach(function (v) {
      if (v > maxVal) maxVal = v;
    });
  });
  if (maxVal === 0) maxVal = 1;
  maxVal = Math.ceil(maxVal * 1.1);

  ctx.fillStyle = textColor;
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  var ySteps = 4;
  for (var i = 0; i <= ySteps; i++) {
    var val = (maxVal / ySteps) * i;
    var y = bottom - (val / maxVal) * ch;
    ctx.fillText(Math.round(val), left - 3, y);
    ctx.strokeStyle = axisColor;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  if (type === 'bar') {
    var n = labels.length;
    var groupW = cw / n;
    var barW = groupW * 0.6;
    var gapW = groupW * 0.4;
    var dsCount = datasets.length;
    var itemW = barW / dsCount;
    labels.forEach(function (label, i) {
      var groupX = left + i * groupW;
      ctx.fillStyle = textColor;
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, groupX + groupW / 2, bottom + 4);
      datasets.forEach(function (ds, j) {
        var val = ds.data[i] || 0;
        var barH = (val / maxVal) * ch;
        var x = groupX + gapW / 2 + j * (itemW + 1);
        ctx.fillStyle = ds.color || getColor(j);
        ctx.fillRect(x, bottom - barH, itemW, barH);
      });
    });
  } else if (type === 'line') {
    var n = labels.length;
    var stepX = n > 1 ? cw / (n - 1) : 0;
    datasets.forEach(function (ds, j) {
      ctx.strokeStyle = ds.color || getColor(j);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ds.data.forEach(function (val, i) {
        var x = left + i * stepX;
        var y = bottom - (val / maxVal) * ch;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    labels.forEach(function (label, i) {
      ctx.fillStyle = textColor;
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, left + i * stepX, bottom + 4);
      datasets.forEach(function (ds, j) {
        var val = ds.data[i] || 0;
        var x = left + i * stepX;
        var y = bottom - (val / maxVal) * ch;
        ctx.fillStyle = ds.color || getColor(j);
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
  }
}
