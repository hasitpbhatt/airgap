async function executeToolCall(toolCall) {
  const { name, arguments: argsRaw } = toolCall.function;
  let args;
  try {
    args = JSON.parse(argsRaw);
  } catch {
    return { error: `Invalid tool arguments: ${argsRaw}` };
  }

  if (name === 'fetch_url') {
    try {
      const fetchUrl = settings.fetchUrl || 'fetch_url.php';
      const proxyRes = await fetch(fetchUrl + '?url=' + encodeURIComponent(args.url), {
        signal: abortController?.signal
      });

      if (!proxyRes.ok) {
        const errText = await proxyRes.text().catch(() => '');
        return { error: `Fetch proxy error ${proxyRes.status}: ${errText || proxyRes.statusText}` };
      }

      return await proxyRes.json();
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

  return { error: `Unknown tool: ${name}` };
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
    const toolLabels = {
      store_value: 'Storing:',
      read_value: 'Reading:',
      list_stored_keys: 'Listing keys',
      delete_value: 'Deleting:'
    };
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble">
        <div class="msg-content">
          <i data-lucide="database" style="width: 14px; height: 14px; vertical-align: middle;"></i>
          <span class="tool-call-label">${toolLabels[name] || name}</span>
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
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-done">
        <div class="msg-content">
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>
          <span class="tool-call-label">Fetched:</span>
          <code class="tool-call-url">${result.status} OK</code>
          <span class="tool-call-detail">(${(result.content || '').length} bytes)</span>
        </div>
      </div>
    `;
  } else {
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-done">
        <div class="msg-content">
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>
          <span class="tool-call-label">${name} OK</span>
        </div>
      </div>
    `;
  }

  scrollToBottom();
  lucide.createIcons();
}
