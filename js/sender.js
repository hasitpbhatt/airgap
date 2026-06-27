// API Communication Logic (Fetch + Abort)
async function triggerSend() {
  const text = elements.chatTextarea.value.trim();
  const activeChat = getActiveChat();
  const hasAttachment = pendingAttachment !== null;

  if ((!text && !hasAttachment) || !activeChat || isGenerating) return;

  // Command registry
  const COMMANDS = {
    compact: () => {
      elements.chatTextarea.value = '';
      handleTextareaAutoGrow();
      triggerCompact();
    },
    clear: () => {
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
    },
    new: () => {
      createNewChat();
      elements.chatTextarea.value = '';
      handleTextareaAutoGrow();
    },
    export: (format) => {
      format = format || 'json';
      const valid = ['json', 'markdown', 'md', 'text', 'txt'];
      if (!valid.includes(format)) format = 'json';
      if (format === 'md') format = 'markdown';
      if (format === 'text') format = 'txt';
      exportCurrentChat(format);
      elements.chatTextarea.value = '';
      handleTextareaAutoGrow();
    },
    persona: (name) => {
      if (!name) return;
      const keys = Object.keys(PERSONAS);
      const match = keys.find(k => k.toLowerCase() === name.toLowerCase());
      if (!match) return;
      settings.currentPersona = match;
      elements.personaSelect.value = match;
      if (match === 'custom') {
        elements.systemPromptTextarea.value = settings.customSystemPrompt || '';
        elements.systemPromptTextarea.disabled = false;
      } else {
        elements.systemPromptTextarea.value = PERSONAS[match]?.system || '';
        elements.systemPromptTextarea.disabled = true;
      }
      saveSettings();
      const currentChat = getActiveChat();
      if (currentChat && getMessageCountWithoutSystem(currentChat) === 0) {
        currentChat.persona = match;
        currentChat.systemPrompt = match === 'custom'
          ? (settings.customSystemPrompt || '')
          : (PERSONAS[match]?.system || '');
        currentChat.messages[0].content = currentChat.systemPrompt;
        saveChats();
      }
      elements.chatTextarea.value = '';
      handleTextareaAutoGrow();
    }
  };

  const cmdMatch = text.match(/^\/(\w+)(?:\s+(.*))?$/);
  if (cmdMatch) {
    const cmd = cmdMatch[1];
    const arg = cmdMatch[2];
    if (COMMANDS[cmd]) {
      COMMANDS[cmd](arg);
      return;
    }
  }

  if (settings.useMaxTurns && activeChat.turnCount >= settings.maxTurns) {
    showToast("Turn limit reached. Start a new session or increase the limit in settings.", "error");
    return;
  }

  // Auto-compact when conversation exceeds threshold
  if (getMessageCountWithoutSystem(activeChat) >= AUTO_COMPACT_THRESHOLD) {
    await triggerCompact();
  }

  const userMsg = { role: 'user', content: text };
  if (hasAttachment) {
    userMsg.attachment = pendingAttachment;
    clearPendingAttachmentUI();
  }
  activeChat.messages.push(userMsg);
  elements.chatTextarea.value = '';
  handleTextareaAutoGrow();

  renderChatFeed();
  renderChatList();

  if (settings.engine === 'local') {
    triggerSendLocal();
  } else {
    triggerSendAPI();
  }
}

async function triggerSendAPI() {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  let messages, toolDepth, saveFileUsed, consecutiveErrors, lastToolName, sameToolCount, effectiveLimit;

  const isResume = !!pausedAgentState;

  if (isResume) {
    const state = pausedAgentState;
    pausedAgentState = null;
    messages = state.messages;
    toolDepth = state.toolDepth;
    saveFileUsed = state.saveFileUsed;
    consecutiveErrors = 0;
    lastToolName = '';
    sameToolCount = 0;
    effectiveLimit = toolDepth + (settings.useMaxToolLoops ? settings.maxToolLoops : MAX_TOOL_LOOP_RESUME);
  } else {
    toolDepth = 0;
    saveFileUsed = false;
    consecutiveErrors = 0;
    lastToolName = '';
    sameToolCount = 0;
    effectiveLimit = settings.useMaxToolLoops ? settings.maxToolLoops : MAX_TOOL_LOOP;
  }

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

  if (!isResume) {
    messages = activeChat.messages.map(m => {
    if (m.role === 'user' && m.attachment) {
      const desc = m.content
        ? m.content + '\n\n---\n[User attached file: ' + m.attachment.name + ' (' + m.attachment.type + ')]'
        : '[User attached file: ' + m.attachment.name + ' (' + m.attachment.type + ')]';
      return { role: 'user', content: desc };
    }
    return { role: m.role, content: m.content };
    });

    // Inject tool call budget guidance into system prompt (in-memory only, not persisted)
    const toolBudget = settings.useMaxToolLoops ? settings.maxToolLoops : MAX_TOOL_LOOP;
    const toolCallHint = '\n\nYou have a budget of ' + toolBudget + ' tool call rounds per request. Prioritize the most impactful tool first. If a tool errors, try an alternative or ask the user — do not retry the same operation. Once you have enough information, provide your final answer rather than continuing to call tools.' +
  '\n\nIMPORTANT - USE YOUR TOOLS: You have GitHub API tools (github_get_contents, github_create_or_update_file, github_create_pr, github_create_issue) at your disposal. The user has already configured a GitHub token in Settings. Call the appropriate tool immediately when needed — do NOT describe steps, do NOT ask the user to do things manually. Just use the tools and complete the task.';
    if (messages.length > 0 && messages[0].role === 'system') {
      messages[0] = { ...messages[0], content: messages[0].content + toolCallHint };
    }
  }

  try {
    while (toolDepth < effectiveLimit) {
      const headers = { 'Content-Type': 'application/json' };
      if (settings.apiKey) {
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
      }

      trimMessagesToFit(messages);

      const body = {
        model: settings.modelName || 'mistral-small-latest',
        stream: true,
        messages
      };
      const allTools = getAllTools();
      if (allTools.length > 0) {
        body.tools = allTools;
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

      // SSE streaming reader
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamContent = '';
      let toolCalls = [];
      let finishReason = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const chunk = JSON.parse(data);
            const choice = chunk.choices?.[0];
            if (!choice) continue;
            finishReason = choice.finish_reason || finishReason;
            const delta = choice.delta || {};
            if (delta.content) {
              streamContent += delta.content;
              const loadingBubble = document.getElementById('temp-loading-bubble');
              if (loadingBubble) {
                const msgContent = loadingBubble.querySelector('.msg-content');
                if (msgContent) msgContent.innerHTML = mdToHtml(streamContent);
              }
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index || 0;
                if (!toolCalls[idx]) {
                  toolCalls[idx] = { id: tc.id, type: 'function', function: { name: '', arguments: '' } };
                }
                if (tc.id) toolCalls[idx].id = tc.id;
                if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
                if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
              }
            }
          } catch (e) {}
        }
      }

      toolCalls = toolCalls.filter(Boolean);

      if (toolCalls.length > 0) {
        const bubble = document.getElementById('temp-loading-bubble');
        if (bubble) bubble.remove();

        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.function.name, arguments: tc.function.arguments }
          }))
        });

        let wasCompacted = false;
        for (const tc of toolCalls) {
          if (tc.function.name === 'save_file') saveFileUsed = true;
          appendToolCallUI(tc);
          const result = await executeToolCall(tc);
          updateToolCallUI(tc, result);

          // Track consecutive errors
          if (result && result.error) {
            consecutiveErrors++;
          } else {
            consecutiveErrors = 0;
          }
          // Track same-tool repetition
          if (tc.function.name === lastToolName) {
            sameToolCount++;
          } else {
            sameToolCount = 1;
            lastToolName = tc.function.name;
          }

          if (tc.function.name === 'compact') {
            wasCompacted = true;
          } else {
            if (result && result.content && typeof result.content === 'string' && result.content.length > MAX_TOOL_RESULT_CHARS) {
              result = Object.assign({}, result, {
                content: result.content.slice(0, MAX_TOOL_RESULT_CHARS) + '\n\n[... content truncated at ' + MAX_TOOL_RESULT_CHARS + ' chars (original was ' + result.content.length + ' chars). To read the rest, call again with the same url/path and offset=' + MAX_TOOL_RESULT_CHARS + ' (or add limit=N for chunk size). ...]'
              });
            }
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

        // Create a new loading bubble for the next streaming phase
        const nextRow = document.createElement('div');
        nextRow.className = 'message-row assistant';
        nextRow.id = 'temp-loading-bubble';
        nextRow.innerHTML = `
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
        elements.chatFeed.appendChild(nextRow);
        tryAutoScroll();

        toolDepth++;

        // Smart guard: pause on repeated errors
        if (consecutiveErrors >= 2) {
          const bubble = document.getElementById('temp-loading-bubble');
          if (bubble) bubble.remove();
          pausedAgentState = { messages, toolDepth, saveFileUsed };
          setGeneratingState(false);
          elements.continueGenBtn.style.display = 'flex';
          renderChatFeed();
          updateInputUIState();
          return;
        }
        // Smart guard: pause on same-tool repetition
        if (sameToolCount >= 3) {
          const bubble = document.getElementById('temp-loading-bubble');
          if (bubble) bubble.remove();
          pausedAgentState = { messages, toolDepth, saveFileUsed };
          setGeneratingState(false);
          elements.continueGenBtn.style.display = 'flex';
          renderChatFeed();
          updateInputUIState();
          return;
        }

        continue;
      }

      if (streamContent) {
        const bubble = document.getElementById('temp-loading-bubble');
        if (bubble) {
          bubble.removeAttribute('id');
          highlightCodeBlocks();
        }

        if (saveFileUsed) {
          streamContent = streamContent.replace(/\[([^\]]*)\]\(https?:\/\/[^\)]+\)/g, '$1');
          streamContent = streamContent.replace(/https?:\/\/\S+/g, '');
          streamContent = streamContent.replace(/\bdownload\b/gi, '');
          streamContent = streamContent.replace(/\s{2,}/g, ' ').trim();
        }
        activeChat.messages.push({ role: 'assistant', content: streamContent });
        activeChat.turnCount++;
        saveChats();
      } else {
        throw new Error('Received an empty response from the server.');
      }

      return;
    }

    // Tool call limit reached — pause and wait for user decision
    {
      const bubble = document.getElementById('temp-loading-bubble');
      if (bubble) bubble.remove();
      pausedAgentState = { messages, toolDepth, saveFileUsed };
      setGeneratingState(false);
      elements.continueGenBtn.style.display = 'flex';
      renderChatFeed();
      updateInputUIState();
      return;
    }
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
    if (pausedAgentState) {
      elements.continueGenBtn.style.display = 'flex';
    }
  }
}

async function triggerSendLocal() {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  if (!window.__localEngine || !window.__localEngine.isLoaded()) {
    showToast('Local model not loaded. If using file://, serve via HTTP (python3 -m http.server 8080) first, then download a model in Settings > Engine.', 'error');
    setGeneratingState(false);
    return;
  }

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

  let messages = activeChat.messages.map(m => ({
    role: m.role,
    content: m.content
  }));

  // Use local-only tools
  const localTools = getAllTools().filter(t => {
    const name = t.function?.name;
    return name && LOCAL_TOOLS.has(name);
  });

  abortController = new AbortController();

  try {
    const gen = window.__localEngine.chatCompletion(messages, localTools.length > 0 ? localTools : undefined);
    let streamContent = '';
    let hasToolCalls = false;

    for await (const result of gen) {
      if (abortController.signal.aborted) break;

      if (result.type === 'delta') {
        streamContent = result.fullText;
        const loadingBubble = document.getElementById('temp-loading-bubble');
        if (loadingBubble) {
          const msgContent = loadingBubble.querySelector('.msg-content');
          if (msgContent) msgContent.innerHTML = mdToHtml(streamContent);
        }
      } else if (result.type === 'tool_calls') {
        hasToolCalls = true;
        const bubble = document.getElementById('temp-loading-bubble');
        if (bubble) bubble.remove();

        for (const tc of result.toolCalls) {
          const tcObj = {
            id: 'local_' + Date.now(),
            type: 'function',
            function: {
              name: tc.name,
              arguments: tc.arguments || '{}'
            }
          };
          appendToolCallUI(tcObj);
          const toolResult = await executeToolCall(tcObj);
          updateToolCallUI(tcObj, toolResult);
          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [tcObj]
          });
          messages.push({
            role: 'tool',
            tool_call_id: tcObj.id,
            content: JSON.stringify(toolResult)
          });
        }

        // Create new loading bubble for next streaming pass
        const nextRow = document.createElement('div');
        nextRow.className = 'message-row assistant';
        nextRow.id = 'temp-loading-bubble';
        nextRow.innerHTML = `
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
        elements.chatFeed.appendChild(nextRow);
        tryAutoScroll();
      }
    }

    if (hasToolCalls) return;

    const bubble = document.getElementById('temp-loading-bubble');
    if (bubble) bubble.remove();

    if (streamContent) {
      activeChat.messages.push({ role: 'assistant', content: streamContent });
      activeChat.turnCount++;
      saveChats();
    }

    renderChatFeed();
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
      console.error('Local Engine Error:', err);
      activeChat.messages.push({
        role: 'assistant',
        content: 'Failed to get response from local model: ' + err.message,
        isError: true
      });
      saveChats();
    }
    renderChatFeed();
  } finally {
    setGeneratingState(false);
    abortController = null;
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

function trimMessagesToFit(messages) {
  var limit = getContextLimit();
  var maxTokens = Math.floor(limit * CONTEXT_WINDOW_MARGIN);
  var totalTokens = 0;
  for (var i = 0; i < messages.length; i++) {
    totalTokens += estimateTokens(messages[i].content || '');
  }
  if (totalTokens <= maxTokens) return;

  // Pass 1: truncate largest tool messages by 50% until under budget
  var toolIndices = [];
  for (var i = 0; i < messages.length; i++) {
    if (messages[i].role === 'tool' && messages[i].content) {
      toolIndices.push(i);
    }
  }
  toolIndices.sort(function(a, b) { return (messages[b].content || '').length - (messages[a].content || '').length; });

  for (var t = 0; t < toolIndices.length && totalTokens > maxTokens; t++) {
    var idx = toolIndices[t];
    var origLen = messages[idx].content.length;
    messages[idx].content = messages[idx].content.slice(0, Math.floor(origLen / 2)) + '\n\n[... truncated ...]';
    totalTokens = 0;
    for (var i = 0; i < messages.length; i++) {
      totalTokens += estimateTokens(messages[i].content || '');
    }
  }

  // Pass 2: drop oldest non-system messages
  while (messages.length > 2 && totalTokens > maxTokens) {
    var removed = messages.splice(1, 1)[0];
    if (removed) {
      totalTokens -= estimateTokens(removed.content || '');
    }
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
  elements.continueGenBtn.style.display = 'none';

  if (!generating) {
    elements.chatTextarea.focus();
  }
}
