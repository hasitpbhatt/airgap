async function executeToolCall(toolCall) {
  const { name, arguments: argsRaw } = toolCall.function;
  let args;
  try {
    args = JSON.parse(argsRaw);
  } catch {
    return { error: `Invalid tool arguments: ${argsRaw}` };
  }

  if (name === 'fetch_url') {
    const CACHE_TTL = 300000; // 5 minutes
    const cacheKey = '_fetch_cache_' + encodeURIComponent(args.url);

    try {
      const cachedRaw = llmStoreGet(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_TTL) {
          return { ...cached, cached: true, age_ms: age };
        }
      }
    } catch {}

    try {
      const fetchUrl = settings.fetchUrl || 'fetch_url.php';
      const proxyRes = await fetch(fetchUrl + '?url=' + encodeURIComponent(args.url), {
        signal: abortController?.signal
      });

      if (!proxyRes.ok) {
        const errText = await proxyRes.text().catch(() => '');
        return { error: `Fetch proxy error ${proxyRes.status}: ${errText || proxyRes.statusText}` };
      }

      const data = await proxyRes.json();
      if (!data.error) {
        try {
          llmStoreSet(cacheKey, JSON.stringify({ ...data, timestamp: Date.now() }));
        } catch {}
      }
      return { ...data, cached: false };
    } catch (err) {
      return { error: err.message };
    }
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
      const fetchUrl = settings.fetchUrl || 'fetch_url.php';

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
          name: 'Brave',
          url: 'https://search.brave.com/search?q=' + query,
          parse: function(html) {
            const results = [];
            const blockRe = /<div[^>]*class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
            const blocks = []; let m;
            while ((m = blockRe.exec(html)) !== null) blocks.push(m[1]);
            for (const block of blocks) {
              const linkRe = /<a[^>]*href="(https?://[^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
              const lm = linkRe.exec(block);
              if (lm) {
                const title = lm[2].replace(/<[^>]+>/g, '').trim();
                if (title) results.push({ title, url: lm[1], snippet: block.replace(/<[^>]+>/g, '').replace(title, '').trim().slice(0, 200) });
              }
              if (results.length >= 10) break;
            }
            return results;
          }
        },
        {
          name: 'Ecosia',
          url: 'https://www.ecosia.org/search?q=' + query,
          parse: function(html) {
            const results = [];
            const re = /<a[^>]+href="(https?://[^"]+)"[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
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
            const re = /<a[^>]+href="(https?://[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
            let m;
            while ((m = re.exec(html)) !== null) {
              const title = m[2].replace(/<[^>]+>/g, '').trim();
              if (title && title.length > 3 && !/bing|microsoft/i.test(title)) results.push({ title, url: m[1], snippet: '' });
              if (results.length >= 10) break;
            }
            return results;
          }
        }
      ];

      const settled = await Promise.allSettled(engines.map(e =>
        fetch(fetchUrl + '?url=' + encodeURIComponent(e.url), { signal: abortController?.signal })
          .then(r => r.json())
          .then(d => ({ engine: e.name, data: d, parse: e.parse }))
      ));

      const priority = ['DuckDuckGo', 'Brave', 'Ecosia', 'Bing'];
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

  if (name === 'read_rss') {
    try {
      const fetchUrl = settings.fetchUrl || 'fetch_url.php';
      const limit = Math.min(args.limit || 10, 50);
      const proxyRes = await fetch(fetchUrl + '?url=' + encodeURIComponent(args.url), {
        signal: abortController?.signal
      });
      if (!proxyRes.ok) {
        return { error: 'Failed to fetch feed: HTTP ' + proxyRes.status };
      }
      const data = await proxyRes.json();
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

  scrollToBottom();
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
  } else {
    const doneLabels = {
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

  scrollToBottom();
  lucide.createIcons();
}
