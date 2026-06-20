// Save helpers
function saveSettings() {
  localStorage.setItem('opencode_settings', JSON.stringify(settings));
}

function saveChats() {
  localStorage.setItem('opencode_chats', JSON.stringify(chats));
}

// Custom Tools Management
function renderCustomToolsList() {
  const container = elements.customToolsList;
  if (!container) return;
  const tools = settings.customTools || [];
  if (tools.length === 0) {
    container.innerHTML = '<div style="font-size:0.7rem;color:hsl(var(--text-muted));padding:0.3rem 0;">No custom tools defined.</div>';
    return;
  }
  container.innerHTML = tools.map((tool, i) => {
    const paramsStr = tool.parameters ? JSON.stringify(tool.parameters, null, 2) : 'No parameters';
    return `
      <div class="custom-tool-card">
        <div class="custom-tool-header">
          <span class="custom-tool-name">${escapeHtml(tool.name || 'unnamed')}</span>
          <button class="custom-tool-remove" data-tool-index="${i}" title="Remove tool">
            <i data-lucide="x" style="width:12px;height:12px;"></i>
          </button>
        </div>
        <div class="custom-tool-desc">${escapeHtml(tool.description || '')}</div>
        <div class="custom-tool-params-preview">${escapeHtml(paramsStr)}</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.custom-tool-remove').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.dataset.toolIndex);
      if (showConfirm('Remove custom tool "' + (settings.customTools[idx]?.name || 'unnamed') + '"?')) {
        settings.customTools.splice(idx, 1);
        saveSettings();
        renderCustomToolsList();
      }
    });
  });

  lucide.createIcons();
}

function showCustomToolEditor(existingIndex) {
  const tools = settings.customTools || [];
  let tool = existingIndex !== undefined ? tools[existingIndex] : { name: '', description: '', parameters: {} };
  const isEdit = existingIndex !== undefined;

  const name = prompt('Tool name (e.g. get_weather):', tool.name || '');
  if (!name || !name.trim()) return;
  const description = prompt('Tool description:', tool.description || '');
  if (!description) return;
  const paramsStr = prompt('Parameters JSON schema (optional — leave empty for no parameters):',
    tool.parameters && Object.keys(tool.parameters).length ? JSON.stringify(tool.parameters, null, 2) : '');

  let parameters = {};
  if (paramsStr && paramsStr.trim()) {
    try {
      parameters = JSON.parse(paramsStr);
    } catch {
      showToast('Invalid JSON for parameters', 'error');
      return;
    }
  }

  const toolDef = {
    type: 'function',
    function: {
      name: name.trim(),
      description: description.trim(),
      parameters: Object.keys(parameters).length > 0 ? parameters : undefined
    }
  };

  if (isEdit) {
    tools[existingIndex] = toolDef;
  } else {
    tools.push(toolDef);
  }

  settings.customTools = tools;
  saveSettings();
  renderCustomToolsList();
}

function getAllTools() {
  const builtIn = AVAILABLE_TOOLS;
  const custom = settings.customTools || [];
  return builtIn.concat(custom);
}

// Global chat search
function performGlobalChatSearch(query) {
  const container = elements.chatSearchGlobalResults;
  const q = query.toLowerCase().trim();

  if (!q) {
    container.style.display = 'none';
    container.innerHTML = '';
    elements.chatSearchGlobalClear.style.display = 'none';
    return;
  }

  elements.chatSearchGlobalClear.style.display = 'flex';
  const results = [];

  chats.forEach(chat => {
    const titleMatch = chat.title.toLowerCase().includes(q);
    if (titleMatch) {
      results.push({
        chatId: chat.id,
        title: chat.title,
        snippet: 'Title match',
        msgIdx: -1
      });
    }
    chat.messages.forEach((msg, idx) => {
      if (msg.role === 'system') return;
      const content = (msg.content || '');
      const lower = content.toLowerCase();
      let pos = lower.indexOf(q);
      let snippetCount = 0;
      while (pos !== -1 && snippetCount < 3) {
        const start = Math.max(0, pos - 40);
        const end = Math.min(content.length, pos + q.length + 60);
        let snippet = content.slice(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
        results.push({
          chatId: chat.id,
          title: chat.title,
          snippet: escapeHtml(snippet),
          msgIdx: idx,
          role: msg.role
        });
        snippetCount++;
        pos = lower.indexOf(q, pos + 1);
      }
    });
  });

  if (results.length === 0) {
    container.innerHTML = '<div class="chat-search-global-result-empty">No results found</div>';
    container.style.display = 'block';
    return;
  }

  container.innerHTML = results.map((r, i) => `
    <div class="chat-search-global-result-item" data-index="${i}">
      <div class="chat-search-global-result-title">${escapeHtml(r.title)}${r.msgIdx >= 0 ? ' · ' + r.role : ''}</div>
      <div class="chat-search-global-result-snippet">${r.msgIdx >= 0 ? r.snippet : 'Conversation title matches search'}</div>
    </div>
  `).join('');

  container.style.display = 'block';

  container.querySelectorAll('.chat-search-global-result-item').forEach(el => {
    el.addEventListener('click', function() {
      const idx = parseInt(this.dataset.index);
      const r = results[idx];
      selectChat(r.chatId);
      if (window.innerWidth <= 768) toggleSidebar(false);
      if (r.msgIdx >= 0) {
        setTimeout(() => {
          const msgs = elements.chatFeed.querySelectorAll('.message-row');
          if (msgs[r.msgIdx]) msgs[r.msgIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
      elements.chatSearchGlobalInput.value = '';
      container.style.display = 'none';
      container.innerHTML = '';
      elements.chatSearchGlobalClear.style.display = 'none';
    });
  });
}

function clearGlobalChatSearch() {
  elements.chatSearchGlobalInput.value = '';
  elements.chatSearchGlobalResults.style.display = 'none';
  elements.chatSearchGlobalResults.innerHTML = '';
  elements.chatSearchGlobalClear.style.display = 'none';
}

// File attachment helpers
function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function getFileIcon(mime, name) {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'file-text';
  const ext = name.split('.').pop().toLowerCase();
  if (['js','py','html','css','json','md','xml','yaml','yml','sh','bat','ps1','c','cpp','h','java','rs','go','ts','jsx','tsx','sql','rb','php','pl','lua','r','swift','kt','scala','dart','prisma','graphql'].includes(ext)) return 'file-code';
  if (['txt','log','ini','cfg','toml','env','gitignore','dockerfile'].includes(ext)) return 'file-text';
  return 'file';
}

function handleFileAttach(file) {
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast("File too large (max 10 MB): " + file.name, 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    pendingAttachment = {
      name: file.name,
      type: file.type || 'application/octet-stream',
      data: e.target.result,
      size: file.size
    };
    showPendingAttachmentUI();
  };
  reader.onerror = function() {
    showToast('Failed to read file', 'error');
  };
  reader.readAsDataURL(file);
}

function clearPendingAttachmentUI() {
  pendingAttachment = null;
  if (elements.fileInput) elements.fileInput.value = '';
  if (elements.fileChip) elements.fileChip.style.display = 'none';
}

function showPendingAttachmentUI() {
  if (!pendingAttachment) return;
  if (elements.fileChipName) elements.fileChipName.textContent = pendingAttachment.name;
  if (elements.fileChipSize) elements.fileChipSize.textContent = formatFileSize(pendingAttachment.size);
  if (elements.fileChip) elements.fileChip.style.display = 'flex';
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
  clearGlobalChatSearch();
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

  if (chatSearchState.visible) clearChatSearch();
  clearPendingAttachmentUI();
  clearGlobalChatSearch();
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
      let parts = [];
      if (msg.content) {
        parts.push(`<p>${escapeHtml(msg.content)}</p>`);
      }
      if (msg.attachment) {
        const att = msg.attachment;
        if (att.type.startsWith('image/')) {
          parts.push(`<a href="${att.data}" target="_blank" class="attachment-image-link"><img src="${att.data}" alt="${escapeHtml(att.name)}" class="attachment-image" loading="lazy"></a>`);
        } else {
          const sizeStr = formatFileSize(att.size);
          const icon = getFileIcon(att.type, att.name);
          parts.push(`<div class="attachment-card"><div class="attachment-card-icon"><i data-lucide="${icon}" style="width:16px;height:16px;"></i></div><div class="attachment-card-info"><div class="attachment-card-name">${escapeHtml(att.name)}</div><div class="attachment-card-meta">${att.type} · ${sizeStr}</div></div><a href="${att.data}" target="_blank" class="attachment-card-download" download="${escapeHtml(att.name)}"><i data-lucide="download" style="width:12px;height:12px;"></i> Open</a></div>`);
        }
      }
      htmlContent = parts.join('');
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
          <button class="msg-action-btn" title="Branch from here" onclick="branchFromMessage(${idx})">
            <i data-lucide="git-branch" style="width: 12px; height: 12px;"></i>
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
      <p class="welcome-subtitle">Your conversations stay on your machine. Bring your own API key, choose a teaching persona below, and start — zero servers, zero signup, zero data leakage.</p>

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

function branchFromMessage(index) {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  const messages = activeChat.messages.slice(0, index + 1);
  const systemMsg = messages[0]?.role === 'system' ? messages[0] : null;

  const newChat = {
    id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    title: activeChat.title + ' (branch)',
    persona: activeChat.persona,
    systemPrompt: systemMsg?.content || '',
    messages: messages,
    turnCount: messages.filter(m => m.role === 'user').length
  };

  chats.unshift(newChat);
  currentChatId = newChat.id;
  saveChats();
  localStorage.setItem('opencode_current_chat_id', currentChatId);
  renderChatList();
  selectChat(currentChatId);
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

// ── In-Chat Search (Ctrl+F) ──────────────────────────────────────────────────

const chatSearchState = {
  visible: false,
  currentMatch: 0,
  totalMatches: 0,
  marks: []
};

function clearChatSearch() {
  chatSearchState.marks.forEach(m => {
    const parent = m.parentNode;
    if (parent) parent.replaceChild(document.createTextNode(m.textContent), m);
  });
  chatSearchState.marks = [];
  chatSearchState.currentMatch = 0;
  chatSearchState.totalMatches = 0;
  elements.chatSearchCounter.textContent = '';
  elements.chatSearchBar.style.display = 'none';
  chatSearchState.visible = false;
  document.querySelector('.search-highlight-current')?.classList.remove('search-highlight-current');
}

function performChatSearch() {
  // Remove old marks
  chatSearchState.marks.forEach(m => {
    const parent = m.parentNode;
    if (parent) parent.replaceChild(document.createTextNode(m.textContent), m);
  });
  chatSearchState.marks = [];
  document.querySelector('.search-highlight-current')?.classList.remove('search-highlight-current');

  const term = elements.chatSearchInput.value.trim();
  if (!term || term.length < 2) {
    chatSearchState.totalMatches = 0;
    chatSearchState.currentMatch = 0;
    elements.chatSearchCounter.textContent = '';
    return;
  }

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'gi');
  const contentDivs = elements.chatFeed.querySelectorAll('.msg-content');

  contentDivs.forEach(div => {
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(node => {
      const text = node.textContent;
      regex.lastIndex = 0;
      let match;
      const frags = [];
      let lastIdx = 0;
      let count = 0;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIdx) frags.push(document.createTextNode(text.slice(lastIdx, match.index)));
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = match[0];
        chatSearchState.marks.push(mark);
        frags.push(mark);
        lastIdx = match.index + match[0].length;
        count++;
      }
      if (count > 0) {
        if (lastIdx < text.length) frags.push(document.createTextNode(text.slice(lastIdx)));
        const parent = node.parentNode;
        frags.forEach(f => parent.insertBefore(f, node));
        parent.removeChild(node);
      }
    });
  });

  chatSearchState.totalMatches = chatSearchState.marks.length;
  chatSearchState.currentMatch = 0;
  if (chatSearchState.totalMatches > 0) {
    chatSearchState.marks[0].classList.add('search-highlight-current');
    chatSearchState.marks[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    elements.chatSearchCounter.textContent = `1 of ${chatSearchState.totalMatches}`;
  } else {
    elements.chatSearchCounter.textContent = 'No matches';
  }
}

function navigateChatSearch(dir) {
  if (chatSearchState.totalMatches === 0) return;
  const prev = chatSearchState.marks[chatSearchState.currentMatch];
  if (prev) prev.classList.remove('search-highlight-current');

  chatSearchState.currentMatch = (chatSearchState.currentMatch + dir + chatSearchState.totalMatches) % chatSearchState.totalMatches;

  const curr = chatSearchState.marks[chatSearchState.currentMatch];
  if (curr) {
    curr.classList.add('search-highlight-current');
    curr.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  elements.chatSearchCounter.textContent = `${chatSearchState.currentMatch + 1} of ${chatSearchState.totalMatches}`;
}
