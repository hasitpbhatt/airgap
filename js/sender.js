// API Communication Logic (Fetch + Abort)
async function triggerSend() {
  const text = elements.chatTextarea.value.trim();
  const activeChat = getActiveChat();

  if (!text || !activeChat || isGenerating) return;

  // Handle commands
  if (text === '/compact') {
    elements.chatTextarea.value = '';
    handleTextareaAutoGrow();
    triggerCompact();
    return;
  }
  if (text === '/clear') {
    if (!activeChat) return;
    activeChat.messages = [
      { role: 'system', content: activeChat.systemPrompt }
    ];
    activeChat.turnCount = 0;
    elements.chatTextarea.value = '';
    handleTextareaAutoGrow();
    saveChats();
    renderChatFeed();
    updateInputUIState();
    return;
  }

  if (settings.useMaxTurns && activeChat.turnCount >= settings.maxTurns) {
    showToast("Turn limit reached. Start a new session or increase the limit in settings.", "error");
    return;
  }

  // Auto-compact when conversation exceeds threshold
  if (getMessageCountWithoutSystem(activeChat) >= AUTO_COMPACT_THRESHOLD) {
    await triggerCompact();
  }

  activeChat.messages.push({ role: 'user', content: text });
  elements.chatTextarea.value = '';
  handleTextareaAutoGrow();

  renderChatFeed();
  renderChatList();
  triggerSendAPI();
}

async function triggerSendAPI() {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  setGeneratingState(true);

  const loadingRow = document.createElement('div');
  loadingRow.className = 'message-row assistant';
  loadingRow.id = 'temp-loading-bubble';
  loadingRow.innerHTML = `
    <div class="message-bubble">
      <div class="msg-header assistant">
        ${PERSONAS[activeChat.persona]?.icon || '🤖'} ${PERSONAS[activeChat.persona]?.label || 'Assistant'}
      </div>
      <div class="msg-content">
        <div class="typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    </div>
  `;
  elements.chatFeed.appendChild(loadingRow);
  tryAutoScroll();

  abortController = new AbortController();
  const messages = activeChat.messages.map(m => ({
    role: m.role,
    content: m.content
  }));
  let toolDepth = 0;
  let saveFileUsed = false;

  try {
    while (toolDepth < MAX_TOOL_LOOP) {
      const headers = { 'Content-Type': 'application/json' };
      if (settings.apiKey) {
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
      }

      const body = {
        model: settings.modelName || 'mistral-small-latest',
        messages
      };
      if (AVAILABLE_TOOLS.length > 0) {
        body.tools = AVAILABLE_TOOLS;
      }

      const res = await fetch(settings.proxyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abortController.signal
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const message = data.choices?.[0]?.message;

      if (message?.tool_calls && message.tool_calls.length > 0) {
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: message.tool_calls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.function.name, arguments: tc.function.arguments }
          }))
        });

        let wasCompacted = false;
        for (const tc of message.tool_calls) {
          if (tc.function.name === 'save_file') saveFileUsed = true;
          appendToolCallUI(tc);
          const result = await executeToolCall(tc);
          updateToolCallUI(tc, result);

          if (tc.function.name === 'compact') {
            wasCompacted = true;
          } else {
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result)
            });
          }
        }

        if (wasCompacted) {
          const activeChat = getActiveChat();
          if (activeChat) {
            messages.length = 0;
            for (const m of activeChat.messages) {
              messages.push({ role: m.role, content: m.content });
            }
          }
        }

        toolDepth++;
        continue;
      }

      const bubble = document.getElementById('temp-loading-bubble');
      if (bubble) bubble.remove();

      let content = message?.content || '';
      if (content) {
        if (saveFileUsed) {
          content = content.replace(/\[([^\]]*)\]\(https?:\/\/[^\)]+\)/g, '$1');
        }
        activeChat.messages.push({ role: 'assistant', content });
        activeChat.turnCount++;
        saveChats();
      } else {
        throw new Error('Received an empty response from the server.');
      }

      return;
    }

    throw new Error(`Agent exceeded maximum of ${MAX_TOOL_LOOP} tool call rounds.`);
  } catch (err) {
    const bubble = document.getElementById('temp-loading-bubble');
    if (bubble) bubble.remove();

    if (err.name === 'AbortError') {
      activeChat.messages.push({
        role: 'assistant',
        content: 'Response generation was stopped.',
        isStopped: true
      });
      saveChats();
    } else {
      console.error('API Fetch Error:', err);
      activeChat.messages.push({
        role: 'assistant',
        content: `Failed to fetch AI response: ${err.message}`,
        isError: true
      });
      saveChats();
    }
  } finally {
    setGeneratingState(false);
    abortController = null;
    renderChatFeed();
    updateInputUIState();
  }
}

async function triggerCompact() {
  const activeChat = getActiveChat();
  if (!activeChat || activeChat.messages.length < 2) return;

  setGeneratingState(true);

  const loadingRow = document.createElement('div');
  loadingRow.className = 'message-row assistant';
  loadingRow.id = 'temp-loading-bubble';
  loadingRow.innerHTML = `
    <div class="message-bubble">
      <div class="msg-header assistant">🧹 Compacting conversation...</div>
      <div class="msg-content">
        <div class="typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    </div>
  `;
  elements.chatFeed.appendChild(loadingRow);
  tryAutoScroll();

  abortController = new AbortController();

  const messages = activeChat.messages.map(m => ({
    role: m.role,
    content: m.content
  }));

  const compactPrompt = 'Please summarize the above conversation concisely. Preserve all key facts, decisions, and context. Start your response directly with the summary.';
  messages.push({ role: 'user', content: compactPrompt });

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (settings.apiKey) headers['Authorization'] = `Bearer ${settings.apiKey}`;

    const res = await fetch(settings.proxyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.modelName || 'mistral-small-latest',
        messages
      }),
      signal: abortController.signal
    });

    if (!res.ok) throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content || '';

    if (summary) {
      const systemMsg = activeChat.messages.find(m => m.role === 'system');
      activeChat.messages = [];
      if (systemMsg) activeChat.messages.push({ ...systemMsg });
      activeChat.messages.push({ role: 'assistant', content: `[Conversation compacted]\n\n${summary}` });
      saveChats();
    }

    const bubble = document.getElementById('temp-loading-bubble');
    if (bubble) bubble.remove();

    const noticeRow = document.createElement('div');
    noticeRow.className = 'message-row system';
    noticeRow.innerHTML = `<div class="message-bubble" style="border-color: hsl(var(--warning));"><div class="msg-content"><i data-lucide="file-text" style="width:14px;height:14px;vertical-align:middle;margin-right:6px;"></i> Conversation compacted. Previous messages replaced with summary.</div></div>`;
    elements.chatFeed.appendChild(noticeRow);
    tryAutoScroll();
    lucide.createIcons();

  } catch (err) {
    const bubble = document.getElementById('temp-loading-bubble');
    if (bubble) bubble.remove();
    console.error('Compact Error:', err);
  } finally {
    setGeneratingState(false);
    abortController = null;
    updateInputUIState();
  }
}

function stopGenerating() {
  if (abortController) {
    abortController.abort();
  }
}

function setGeneratingState(generating) {
  isGenerating = generating;
  elements.chatTextarea.disabled = generating;
  elements.sendBtn.style.display = generating ? 'none' : 'flex';
  elements.stopGenBtn.style.display = generating ? 'flex' : 'none';

  if (!generating) {
    elements.chatTextarea.focus();
  }
}
