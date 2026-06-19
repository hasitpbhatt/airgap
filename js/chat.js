// Save helpers
function saveSettings() {
  localStorage.setItem('opencode_settings', JSON.stringify(settings));
}

function saveChats() {
  localStorage.setItem('opencode_chats', JSON.stringify(chats));
}

// Chat session logic
function getActiveChat() {
  return chats.find(c => c.id === currentChatId);
}

function getMessageCountWithoutSystem(chat) {
  if (!chat) return 0;
  return chat.messages.filter(m => m.role !== 'system').length;
}

function createNewChat(initialPersona = null) {
  const persona = initialPersona || settings.currentPersona;
  const systemPrompt = persona === 'custom'
    ? (settings.customSystemPrompt || '')
    : (PERSONAS[persona]?.system || '');

  const newChat = {
    id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    title: new Date().toLocaleString(),
    persona: persona,
    systemPrompt: systemPrompt,
    messages: [
      { role: 'system', content: systemPrompt }
    ],
    turnCount: 0
  };

  chats.unshift(newChat);
  currentChatId = newChat.id;

  saveChats();
  localStorage.setItem('opencode_current_chat_id', currentChatId);

  renderChatList();
  selectChat(currentChatId);
}

function selectChat(id) {
  currentChatId = id;
  localStorage.setItem('opencode_current_chat_id', id);

  const activeChat = getActiveChat();
  if (!activeChat) return;

  if (getMessageCountWithoutSystem(activeChat) === 0) {
    elements.personaSelect.value = activeChat.persona;
    if (activeChat.persona === 'custom') {
      elements.systemPromptTextarea.value = activeChat.systemPrompt;
      elements.systemPromptTextarea.disabled = false;
    } else {
      elements.systemPromptTextarea.value = PERSONAS[activeChat.persona].system;
      elements.systemPromptTextarea.disabled = true;
    }
  }

  document.querySelectorAll('.chat-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-id') === id);
  });

  elements.activeChatTitle.textContent = activeChat.title;

  renderChatFeed();
  updateInputUIState();

  elements.chatTextarea.value = '';
  elements.chatTextarea.focus();
  handleTextareaAutoGrow();
}

function renderChatList() {
  elements.chatList.innerHTML = '';
  if (chats.length === 0) {
    elements.chatList.innerHTML = `<div style="text-align: center; color: hsl(var(--text-muted)); font-size: 0.8rem; margin-top: 2rem;">No conversations</div>`;
    return;
  }

  chats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'chat-item';
    if (chat.id === currentChatId) item.classList.add('active');
    item.setAttribute('data-id', chat.id);

    const icon = PERSONAS[chat.persona]?.icon || '🤖';

    item.innerHTML = `
      <div class="chat-item-left">
        <span style="font-size: 1rem;">${icon}</span>
        <div class="chat-item-title">${escapeHtml(chat.title)}</div>
      </div>
      <div class="chat-item-actions">
        <button class="chat-action-btn rename-btn" title="Rename Session">
          <i data-lucide="edit-2" style="width: 12px; height: 12px;"></i>
        </button>
        <button class="chat-action-btn delete-btn" title="Delete Session">
          <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
        </button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.chat-action-btn')) return;
      selectChat(chat.id);
      if (window.innerWidth <= 768) {
        toggleSidebar(false);
      }
    });

    item.querySelector('.rename-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const newName = prompt("Enter new title for conversation:", chat.title);
      if (newName && newName.trim() !== '') {
        chat.title = newName.trim();
        saveChats();
        renderChatList();
        if (chat.id === currentChatId) {
          elements.activeChatTitle.textContent = chat.title;
        }
      }
    });

    item.querySelector('.delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (await showConfirm(`Are you sure you want to delete "${chat.title}"?`)) {
        const index = chats.findIndex(c => c.id === chat.id);
        if (index !== -1) {
          chats.splice(index, 1);
          saveChats();

          if (chats.length === 0) {
            createNewChat();
          } else if (chat.id === currentChatId) {
            selectChat(chats[0].id);
          } else {
            renderChatList();
          }
        }
      }
    });

    elements.chatList.appendChild(item);
  });

  lucide.createIcons();
}

function startEditingTitle() {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  const titleContainer = elements.activeChatTitle.parentElement;
  const titleElement = elements.activeChatTitle;
  const editBtn = elements.editTitleBtn;

  titleElement.style.display = 'none';
  editBtn.style.display = 'none';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'title-edit-input';
  input.value = activeChat.title;
  titleContainer.insertBefore(input, titleElement);
  input.focus();
  input.select();

  const finishEditing = () => {
    const val = input.value.trim();
    if (val !== '') {
      activeChat.title = val;
      saveChats();
      titleElement.textContent = val;
      renderChatList();
    }
    input.remove();
    titleElement.style.display = '';
    editBtn.style.display = '';
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finishEditing();
    if (e.key === 'Escape') {
      input.remove();
      titleElement.style.display = '';
      editBtn.style.display = '';
    }
  });

  input.addEventListener('blur', finishEditing);
}

async function clearCurrentChat() {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  if (await showConfirm("Clear all messages in this conversation? (Keep settings & system prompt)")) {
    activeChat.messages = [
      { role: 'system', content: activeChat.systemPrompt }
    ];
    activeChat.turnCount = 0;
    saveChats();
    renderChatFeed();
    updateInputUIState();
  }
}

function exportCurrentChat(format) {
  const activeChat = getActiveChat();
  if (!activeChat) return;
  format = format || 'json';

  const slug = activeChat.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  let blob, ext;

  if (format === 'markdown') {
    ext = 'md';
    let md = `# ${activeChat.title}\n\n`;
    activeChat.messages.forEach(msg => {
      if (msg.role === 'system') return;
      if (msg.role === 'user') {
        md += `**You:** ${msg.content}\n\n`;
      } else {
        md += `**Assistant:**\n${msg.content}\n\n`;
      }
    });
    blob = new Blob([md], { type: 'text/markdown' });
  } else if (format === 'text') {
    ext = 'txt';
    let txt = `${activeChat.title}\n${'='.repeat(activeChat.title.length)}\n\n`;
    activeChat.messages.forEach(msg => {
      if (msg.role === 'system') return;
      if (msg.role === 'user') {
        txt += `You: ${msg.content}\n\n`;
      } else {
        txt += `Assistant:\n${msg.content}\n\n`;
      }
    });
    blob = new Blob([txt], { type: 'text/plain' });
  } else {
    ext = 'json';
    blob = new Blob([JSON.stringify(activeChat, null, 2)], { type: 'application/json' });
  }

  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", url);
  downloadAnchor.setAttribute("download", `${slug}_export.${ext}`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  URL.revokeObjectURL(url);
}

// Chat view rendering (Markdown + Prism + KaTeX)
function renderChatFeed() {
  const activeChat = getActiveChat();
  elements.chatFeed.innerHTML = '';

  if (!activeChat || getMessageCountWithoutSystem(activeChat) === 0) {
    renderWelcomeScreen();
    return;
  }

  activeChat.messages.forEach((msg, idx) => {
    if (msg.role === 'system') return;

    const msgRow = document.createElement('div');
    msgRow.className = `message-row ${msg.role}`;

    const isUser = msg.role === 'user';
    const personaIcon = PERSONAS[activeChat.persona]?.icon || '🤖';
    const personaLabel = PERSONAS[activeChat.persona]?.label || 'AI Assistant';

    let htmlContent = '';
    if (isUser) {
      htmlContent = `<p>${escapeHtml(msg.content)}</p>`;
    } else {
      if (msg.isError) {
        htmlContent = `
          <div class="error-text">
            <i data-lucide="alert-triangle"></i>
            <span>${escapeHtml(msg.content)}</span>
          </div>
          <button class="btn-retry" onclick="retryMessage(${idx})">
            <i data-lucide="rotate-ccw" style="width: 12px; height: 12px;"></i>
            Retry Response
          </button>
        `;
      } else {
        htmlContent = mdToHtml(msg.content);
      }
    }

    msgRow.innerHTML = `
      <div class="message-bubble ${msg.isError ? 'error' : ''}">
        <div class="msg-header ${msg.role}">
          ${isUser ? 'You' : `${personaIcon} ${personaLabel}`}
        </div>
        <div class="msg-content">
          ${htmlContent}
        </div>
        <div class="msg-actions">
          <span class="msg-tokens">${estimateTokens(msg.content).toLocaleString()} tok</span>
          <button class="msg-action-btn" title="Copy to Clipboard" onclick="copyMessageText(this, ${idx})">
            <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
          </button>
          ${isUser ? `
            <button class="msg-action-btn" title="Edit Message" onclick="editUserMessage(${idx})">
              <i data-lucide="pencil" style="width: 12px; height: 12px;"></i>
            </button>
          ` : ''}
          <button class="msg-action-btn" title="Delete Message" onclick="deleteMessage(${idx})">
            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
          </button>
        </div>
      </div>
    `;

    elements.chatFeed.appendChild(msgRow);
  });

  highlightCodeBlocks();
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(elements.chatFeed, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
      ],
      throwOnError: false
    });
  }

  // Re-render saved file download buttons so they survive re-renders
  if (activeChat.savedFiles?.length) {
    activeChat.savedFiles.forEach(sf => {
      const entry = pendingDownloads.find(d => d.fileId === sf.fileId);
      if (!entry) return;
      const row = document.createElement('div');
      row.className = 'message-row assistant';
      row.innerHTML = `
        <div class="message-bubble tool-call-bubble tool-call-done">
          <div class="msg-content">
            <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--success));"></i>
            <span class="tool-call-label">File ready:</span>
            <code class="tool-call-url">${escapeHtml(sf.filename)}</code>
            <span class="tool-call-detail">(${sf.size} bytes)</span>
            <button class="btn-download-file" data-file-id="${sf.fileId}">
              <i data-lucide="download" style="width: 12px; height: 12px;"></i>
              Download
            </button>
          </div>
        </div>
      `;
      elements.chatFeed.appendChild(row);
    });
  }

  lucide.createIcons();
  scrollToBottom();
}

function renderWelcomeScreen() {
  elements.chatFeed.innerHTML = `
    <div class="welcome-container">
      <div class="welcome-logo">
        <i data-lucide="cpu"></i>
      </div>
      <h2 class="welcome-title">OpenCode LLM Chat</h2>
      <p class="welcome-subtitle">A gorgeous, developer-centric interface for talking to LLMs. Select a teaching persona or customize configuration in the sidebar settings to get started.</p>

      <h3 class="welcome-section-title">Select a Conversation Persona</h3>
      <div class="personas-grid">
        <div class="persona-card" onclick="selectPersonaForNewChat('general')">
          <div class="persona-card-header">
            <span class="persona-card-icon">🤖</span>
            <span>General Assistant</span>
          </div>
          <div class="persona-card-desc">Helpful, general purpose coding and problem-solving assistant.</div>
        </div>
        <div class="persona-card" onclick="selectPersonaForNewChat('child')">
          <div class="persona-card-header">
            <span class="persona-card-icon">🧒</span>
            <span>Like I'm 10</span>
          </div>
          <div class="persona-card-desc">Explains tough concepts using fun analogies and simple words.</div>
        </div>
        <div class="persona-card" onclick="selectPersonaForNewChat('deep')">
          <div class="persona-card-header">
            <span class="persona-card-icon">🔬</span>
            <span>Deep Dive</span>
          </div>
          <div class="persona-card-desc">Advanced technical breakdowns connecting concepts to state-of-the-art research.</div>
        </div>
        <div class="persona-card" onclick="selectPersonaForNewChat('first-principles')">
          <div class="persona-card-header">
            <span class="persona-card-icon">🧠</span>
            <span>First Principles</span>
          </div>
          <div class="persona-card-desc">Deconstructs topics to fundamental truths using logical reasoning.</div>
        </div>
      </div>
    </div>
  `;
  lucide.createIcons();
}

function selectPersonaForNewChat(personaName) {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  activeChat.persona = personaName;
  activeChat.systemPrompt = PERSONAS[personaName]?.system || '';
  activeChat.messages[0].content = activeChat.systemPrompt;

  elements.personaSelect.value = personaName;
  elements.systemPromptTextarea.value = activeChat.systemPrompt;
  elements.systemPromptTextarea.disabled = true;

  saveChats();
  renderChatList();
  renderChatFeed();

  elements.chatTextarea.focus();
}

// Message actions
async function deleteMessage(index) {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  if (await showConfirm("Delete this message?")) {
    activeChat.messages.splice(index, 1);
    const userMsgCount = activeChat.messages.filter(m => m.role === 'user').length;
    activeChat.turnCount = userMsgCount;

    saveChats();
    renderChatFeed();
    updateInputUIState();
  }
}

function editUserMessage(index) {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  const message = activeChat.messages[index];
  const newText = prompt("Edit your message:", message.content);

  if (newText !== null && newText.trim() !== '') {
    message.content = newText.trim();
    activeChat.messages = activeChat.messages.slice(0, index + 1);

    const userMsgCount = activeChat.messages.filter(m => m.role === 'user').length;
    activeChat.turnCount = userMsgCount;

    saveChats();
    renderChatFeed();
    updateInputUIState();

    triggerSendAPI();
  }
}

function retryMessage(errorIndex) {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  activeChat.messages = activeChat.messages.slice(0, errorIndex);
  saveChats();
  renderChatFeed();
  triggerSendAPI();
}

// Input UI State
function updateInputUIState() {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  const isTurnLimitReached = settings.useMaxTurns && activeChat.turnCount >= settings.maxTurns;
  elements.limitReachedBanner.style.display = isTurnLimitReached ? 'block' : 'none';

  elements.chatTextarea.disabled = isTurnLimitReached || isGenerating;
  elements.chatTextarea.placeholder = isTurnLimitReached
    ? "Turn limit reached. Please start a new conversation."
    : "Type your message here... (Enter to send, Shift+Enter for newline)";

  let parts = [];
  if (settings.useMaxTurns) {
    parts.push(`<span style="font-weight:600;">Exchanges:</span> ${activeChat.turnCount} of ${settings.maxTurns}`);
  }

  // Context token indicator
  const totalTokens = calculateTotalTokens(activeChat);
  const limit = getContextLimit();
  const pct = Math.min(100, (totalTokens / limit) * 100);
  const color = pct >= 95 ? 'var(--danger)' : pct >= 80 ? 'var(--warning)' : 'var(--text-muted)';
  parts.push(`<span class="context-indicator">
    <span class="context-text" style="color: ${color}">${totalTokens.toLocaleString()} / ${limit.toLocaleString()} tok</span>
    <span class="context-bar"><span class="context-bar-fill" style="width:${Math.round(pct)}%;background:${color}"></span></span>
  </span>`);

  elements.inputInfo.style.display = parts.length ? 'block' : 'none';
  elements.inputInfo.innerHTML = parts.join(' · ');

  handleTextareaAutoGrow();
}

function calculateTotalTokens(chat) {
  if (!chat || !chat.messages) return 0;
  let total = 0;
  for (const msg of chat.messages) {
    if (msg.content) {
      total += estimateTokens(msg.content);
    }
  }
  return total;
}

function getContextLimit() {
  return CONTEXT_LIMITS[settings.modelName] || 32768;
}

function refreshMemoryPanelIfOpen() {
  if (elements.memoryPanel && elements.memoryPanel.classList.contains('open')) {
    renderMemoryPanel();
  }
}

function renderMemoryPanel() {
  const keys = globalStoreListKeys();
  elements.memoryList.innerHTML = '';

  if (keys.length === 0) {
    elements.memoryList.innerHTML = '<div class="memory-empty">No stored memories yet. Ask the AI to remember something.</div>';
    return;
  }

  const searchTerm = (elements.memorySearch.value || '').toLowerCase();
  const filtered = searchTerm ? keys.filter(k => k.toLowerCase().includes(searchTerm)) : keys;

  if (filtered.length === 0) {
    elements.memoryList.innerHTML = `<div class="memory-empty">No keys match "${escapeHtml(elements.memorySearch.value)}"</div>`;
    return;
  }

  const sorted = filtered.sort((a, b) => a.localeCompare(b));

  sorted.forEach(key => {
    const value = globalStoreGet(key) || '';
    const isLong = value.length > 100;
    const truncated = isLong ? value.slice(0, 100) + '…' : value;

    const item = document.createElement('div');
    item.className = 'memory-item';
    item.innerHTML = `
      <div class="memory-item-info">
        <div class="memory-item-key">${escapeHtml(key)}</div>
        <div class="memory-item-value">${escapeHtml(truncated)}${isLong ? ' <span class="memory-expand-hint">(show all)</span>' : ''}</div>
      </div>
      <div class="memory-item-actions">
        <button class="memory-item-edit" data-key="${escapeHtml(key)}" title="Edit this memory">
          <i data-lucide="pencil" style="width: 12px; height: 12px;"></i>
        </button>
        <button class="memory-item-delete" data-key="${escapeHtml(key)}" title="Delete this memory">
          <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
        </button>
      </div>
    `;

    // Click item to expand/collapse full value
    item.querySelector('.memory-item-info').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isLong) return;
      const expanded = item.classList.toggle('expanded');
      const valEl = item.querySelector('.memory-item-value');
      const hint = valEl.querySelector('.memory-expand-hint');
      if (expanded) {
        valEl.childNodes[0].textContent = value;
        if (hint) hint.textContent = ' (show less)';
      } else {
        valEl.childNodes[0].textContent = truncated;
        if (hint) hint.textContent = ' (show all)';
      }
    });

    // Edit key/value via prompt
    item.querySelector('.memory-item-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      const k = e.currentTarget.getAttribute('data-key');
      const v = globalStoreGet(k) || '';
      const newKey = prompt('Edit memory key:', k);
      if (newKey === null) return;
      const newValue = prompt('Edit memory value:', v);
      if (newValue === null) return;
      if (newKey.trim() && newValue.trim()) {
        if (newKey.trim() !== k) {
          globalStoreDelete(k);
        }
        globalStoreSet(newKey.trim(), newValue.trim());
        renderMemoryPanel();
      }
    });

    item.querySelector('.memory-item-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      const k = e.currentTarget.getAttribute('data-key');
      if (await showConfirm(`Delete "${k}" from global memory?`)) {
        globalStoreDelete(k);
        renderMemoryPanel();
      }
    });

    elements.memoryList.appendChild(item);
  });

  lucide.createIcons();
}
