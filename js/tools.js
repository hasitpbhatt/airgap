async function executeToolCall(toolCall) {
  const { name, arguments: argsRaw } = toolCall.function;
  let args;
  try {
    args = JSON.parse(argsRaw);
  } catch {
    return { error: 'Invalid tool arguments: ' + argsRaw };
  }

  switch (name) {
    case 'fetch_url': return handleFetchUrl(args);
    case 'search_web': return handleSearchWeb(args);
    case 'read_rss': return handleReadRss(args);

    case 'store_value': return handleStoreValue(args);
    case 'read_value': return handleReadValue(args);
    case 'list_stored_keys': return handleListStoredKeys();
    case 'delete_value': return handleDeleteValue(args);
    case 'remember': return handleRemember(args);
    case 'recall': return handleRecall(args);
    case 'forget': return handleForget(args);
    case 'forget_all': return handleForgetAll();

    case 'notes_create': return handleNotesCreate(args);
    case 'notes_read': return handleNotesRead(args);
    case 'notes_list': return handleNotesList(args);
    case 'notes_delete': return handleNotesDelete(args);

    case 'github_get_contents': return handleGitHubGetContents(args);
    case 'github_create_or_update_file': return handleGitHubCreateOrUpdateFile(args);
    case 'github_create_pr': return handleGitHubCreatePr(args);
    case 'github_create_issue': return handleGitHubCreateIssue(args);

    case 'compact': return handleCompact(args);
    case 'calculate': return handleCalculate(args);
    case 'get_current_time': return handleGetCurrentTime();
    case 'send_notification': return handleSendNotification(args);
    case 'set_setting': return handleSetSetting(args);
    case 'clipboard_write': return handleClipboardWrite(args, toolCall.id);
    case 'generate_chart': return handleGenerateChart(args, toolCall.id);
    case 'save_file': return handleSaveFile(args, toolCall.id);

    default: return { error: 'Unknown tool: ' + name };
  }
}

function appendToolCallUI(toolCall) {
  const { name, arguments: argsRaw } = toolCall.function;

  const loadingBubble = document.getElementById('temp-loading-bubble');
  const row = document.createElement('div');
  row.className = 'message-row tool-call';
  row.id = 'tool-call-' + toolCall.id;

  if (name === 'fetch_url') {
    let url = '';
    try { url = JSON.parse(argsRaw).url || argsRaw; } catch { url = argsRaw; }
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble">\
        <div class="msg-content">\
          <i data-lucide="globe" style="width: 14px; height: 14px; vertical-align: middle;"></i>\
          <span class="tool-call-label">Fetching:</span>\
          <code class="tool-call-url">' + escapeHtml(url) + '</code>\
          <span class="tool-call-status">...</span>\
        </div>\
      </div>';
  } else if (name === 'search_web') {
    let query = '';
    try { query = JSON.parse(argsRaw).query || ''; } catch {}
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble">\
        <div class="msg-content">\
          <i data-lucide="search" style="width: 14px; height: 14px; vertical-align: middle;"></i>\
          <span class="tool-call-label">Searching:</span>\
          <code class="tool-call-url">' + escapeHtml(query) + '</code>\
          <span class="tool-call-status">...</span>\
        </div>\
      </div>';
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
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble">\
        <div class="msg-content">\
          <i data-lucide="settings" style="width: 14px; height: 14px; vertical-align: middle;"></i>\
          <span class="tool-call-label">Changing ' + escapeHtml(key) + '...</span>\
          <span class="tool-call-status">...</span>\
        </div>\
      </div>';
  } else if (name === 'clipboard_write') {
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble">\
        <div class="msg-content">\
          <i data-lucide="clipboard" style="width: 14px; height: 14px; vertical-align: middle;"></i>\
          <span class="tool-call-label">Copying to clipboard...</span>\
          <span class="tool-call-status">...</span>\
        </div>\
      </div>';
  } else if (name === 'generate_chart') {
    let title = '';
    try { title = JSON.parse(argsRaw).title || ''; } catch {}
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble">\
        <div class="msg-content">\
          <i data-lucide="bar-chart-3" style="width: 14px; height: 14px; vertical-align: middle;"></i>\
          <span class="tool-call-label">Generating chart:</span>\
          <code class="tool-call-url">' + escapeHtml(title) + '</code>\
          <span class="tool-call-status">...</span>\
        </div>\
      </div>';
  } else if (name === 'save_file') {
    let filename = '';
    try { filename = JSON.parse(argsRaw).filename || ''; } catch {}
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble">\
        <div class="msg-content">\
          <i data-lucide="download" style="width: 14px; height: 14px; vertical-align: middle;"></i>\
          <span class="tool-call-label">Saving:</span>\
          <code class="tool-call-url">' + escapeHtml(filename) + '</code>\
          <span class="tool-call-status">...</span>\
        </div>\
      </div>';
  } else if (name === 'read_rss') {
    let url = '';
    try { url = JSON.parse(argsRaw).url || argsRaw; } catch { url = argsRaw; }
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble">\
        <div class="msg-content">\
          <i data-lucide="rss" style="width: 14px; height: 14px; vertical-align: middle;"></i>\
          <span class="tool-call-label">Reading feed:</span>\
          <code class="tool-call-url">' + escapeHtml(url) + '</code>\
          <span class="tool-call-status">...</span>\
        </div>\
      </div>';
  } else if (name === 'github_get_contents') {
    let path = '';
    try { path = JSON.parse(argsRaw).path || ''; } catch {}
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble">\
        <div class="msg-content">\
          <i data-lucide="github" style="width: 14px; height: 14px; vertical-align: middle;"></i>\
          <span class="tool-call-label">Reading from GitHub:</span>\
          <code class="tool-call-url">' + escapeHtml(path) + '</code>\
          <span class="tool-call-status">...</span>\
        </div>\
      </div>';
  } else if (name === 'github_create_or_update_file') {
    let path = '';
    try { path = JSON.parse(argsRaw).path || ''; } catch {}
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble">\
        <div class="msg-content">\
          <i data-lucide="git-commit" style="width: 14px; height: 14px; vertical-align: middle;"></i>\
          <span class="tool-call-label">Committing to GitHub:</span>\
          <code class="tool-call-url">' + escapeHtml(path) + '</code>\
          <span class="tool-call-status">...</span>\
        </div>\
      </div>';
  } else if (name === 'github_create_pr') {
    let title = '';
    try { title = JSON.parse(argsRaw).title || ''; } catch {}
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble">\
        <div class="msg-content">\
          <i data-lucide="git-pull-request" style="width: 14px; height: 14px; vertical-align: middle;"></i>\
          <span class="tool-call-label">Creating PR:</span>\
          <code class="tool-call-url">' + escapeHtml(title) + '</code>\
          <span class="tool-call-status">...</span>\
        </div>\
      </div>';
  } else if (name === 'github_create_issue') {
    let title = '';
    try { title = JSON.parse(argsRaw).title || ''; } catch {}
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble">\
        <div class="msg-content">\
          <i data-lucide="circle-alert" style="width: 14px; height: 14px; vertical-align: middle;"></i>\
          <span class="tool-call-label">Creating issue:</span>\
          <code class="tool-call-url">' + escapeHtml(title) + '</code>\
          <span class="tool-call-status">...</span>\
        </div>\
      </div>';
  } else if (name === 'compact') {
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble">\
        <div class="msg-content">\
          <i data-lucide="file-text" style="width: 14px; height: 14px; vertical-align: middle;"></i>\
          <span class="tool-call-label">Compacting conversation...</span>\
          <span class="tool-call-status">...</span>\
        </div>\
      </div>';
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
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble">\
        <div class="msg-content">\
          <i data-lucide="' + iconName + '" style="width: 14px; height: 14px; vertical-align: middle;"></i>\
          <span class="tool-call-label">' + label + '</span>\
          ' + (key ? '<code class="tool-call-url">' + escapeHtml(key) + '</code>' : '') + '\
          <span class="tool-call-status">...</span>\
        </div>\
      </div>';
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
  const row = document.getElementById('tool-call-' + toolCall.id);
  if (!row) return;

  const name = toolCall.function.name;

  if (result.error) {
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble tool-call-error">\
        <div class="msg-content">\
          <i data-lucide="alert-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--danger));"></i>\
          <span class="tool-call-label">' + name + ' failed:</span>\
          <code class="tool-call-url">' + escapeHtml(result.error) + '</code>\
        </div>\
      </div>';
  } else if (name === 'fetch_url') {
    const preview = (result.content || '').slice(0, 80).replace(/\s+/g, ' ').trim();
    const cacheLabel = result.cached ? '<span class="tool-call-detail">(cached ' + (result.age_ms / 1000).toFixed(0) + 's ago)</span>' : '';
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble tool-call-done">\
        <div class="msg-content">\
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>\
          <span class="tool-call-label">Fetched:</span>\
          <code class="tool-call-url">' + result.status + ' OK</code>\
          <span class="tool-call-detail">(' + (result.content || '').length + ' bytes)</span>\
          ' + cacheLabel + '\
        </div>\
      </div>';
  } else if (name === 'search_web') {
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble tool-call-done">\
        <div class="msg-content">\
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>\
          <span class="tool-call-label">Search done:</span>\
          <code class="tool-call-url">' + (result.count || 0) + ' results</code>\
        </div>\
      </div>';
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
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble tool-call-done">\
        <div class="msg-content">\
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>\
          <span class="tool-call-label">Setting changed:</span>\
          <code class="tool-call-url">' + escapeHtml(result.key) + '</code>\
          <span class="tool-call-detail">= ' + escapeHtml((result.value || '').substring(0, 50)) + '</span>\
        </div>\
      </div>';
  } else if (name === 'clipboard_write') {
    const clipId = 'clip-' + toolCall.id;
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble tool-call-done">\
        <div class="msg-content">\
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>\
          <span class="tool-call-label">Clipboard:</span>\
          <span class="tool-call-detail">' + result.length + ' chars</span>\
          <button class="btn-clipboard-copy" data-clip-id="' + clipId + '">\
            <i data-lucide="copy" style="width: 12px; height: 12px;"></i>\
            Click to copy\
          </button>\
        </div>\
      </div>';
  } else if (name === 'generate_chart') {
    const chartEntry = pendingCharts.find(d => d.toolCallId === toolCall.id);
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble tool-call-done">\
        <div class="msg-content" style="flex-direction: column; align-items: stretch;">\
          <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.3rem;">\
            <i data-lucide="check-circle" style="width: 14px; height: 14px; flex-shrink: 0; color: hsl(var(--success));"></i>\
            <span class="tool-call-label">Chart:</span>\
            <code class="tool-call-url">' + escapeHtml(result.title) + '</code>\
            <span class="tool-call-detail">(' + result.type + ')</span>\
          </div>\
          <canvas class="chart-canvas" width="280" height="180"></canvas>\
        </div>\
      </div>';
    if (chartEntry) {
      const canvas = row.querySelector('.chart-canvas');
      if (canvas) drawChart(canvas, chartEntry.config);
    }
  } else if (name === 'save_file') {
    const fileId = 'file-' + toolCall.id;
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble tool-call-done">\
        <div class="msg-content">\
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>\
          <span class="tool-call-label">File ready:</span>\
          <code class="tool-call-url">' + escapeHtml(result.filename) + '</code>\
          <span class="tool-call-detail">(' + result.size + ' bytes)</span>\
          <button class="btn-download-file" data-file-id="' + fileId + '">\
            <i data-lucide="download" style="width: 12px; height: 12px;"></i>\
            Download\
          </button>\
        </div>\
      </div>';
  } else if (name === 'read_rss') {
    const feedTitle = result.feed_title || 'Feed';
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble tool-call-done">\
        <div class="msg-content">\
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>\
          <span class="tool-call-label">Feed read:</span>\
          <code class="tool-call-url">' + escapeHtml(feedTitle) + '</code>\
          <span class="tool-call-detail">(' + (result.count || 0) + ' items)</span>\
        </div>\
      </div>';
  } else if (name === 'github_get_contents') {
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble tool-call-done">\
        <div class="msg-content">\
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>\
          <span class="tool-call-label">Read:</span>\
          <code class="tool-call-url">' + escapeHtml(result.path) + '</code>\
          <span class="tool-call-detail">(' + result.size + ' bytes, ' + result.type + ')</span>\
        </div>\
      </div>';
  } else if (name === 'github_create_or_update_file') {
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble tool-call-done">\
        <div class="msg-content">\
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>\
          <span class="tool-call-label">Committed:</span>\
          <code class="tool-call-url">' + escapeHtml(result.commit.sha.slice(0, 7)) + '</code>\
          <span class="tool-call-detail"><a href="' + escapeHtml(result.content.html_url) + '" target="_blank" rel="noopener">view file</a></span>\
        </div>\
      </div>';
  } else if (name === 'github_create_pr') {
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble tool-call-done">\
        <div class="msg-content">\
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>\
          <span class="tool-call-label">PR created:</span>\
          <code class="tool-call-url">#' + result.number + '</code>\
          <span class="tool-call-detail"><a href="' + escapeHtml(result.html_url) + '" target="_blank" rel="noopener">open</a></span>\
        </div>\
      </div>';
  } else if (name === 'github_create_issue') {
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble tool-call-done">\
        <div class="msg-content">\
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>\
          <span class="tool-call-label">Issue created:</span>\
          <code class="tool-call-url">#' + result.number + '</code>\
          <span class="tool-call-detail"><a href="' + escapeHtml(result.html_url) + '" target="_blank" rel="noopener">open</a></span>\
        </div>\
      </div>';
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
    row.innerHTML = '\
      <div class="message-bubble tool-call-bubble tool-call-done">\
        <div class="msg-content">\
          <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>\
          <span class="tool-call-label">' + doneLabel + '</span>\
        </div>\
      </div>';
  }

  tryAutoScroll();
  lucide.createIcons();
}
