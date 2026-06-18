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
    : PERSONAS[persona].system;

  const newChat = {
    id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    title: 'Session ' + (chats.length + 1),
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

    item.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete "${chat.title}"?`)) {
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

function clearCurrentChat() {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  if (confirm("Clear all messages in this conversation? (Keep settings & system prompt)")) {
    activeChat.messages = [
      { role: 'system', content: activeChat.systemPrompt }
    ];
    activeChat.turnCount = 0;
    saveChats();
    renderChatFeed();
    updateInputUIState();
  }
}

function exportCurrentChat() {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeChat, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", activeChat.title.toLowerCase().replace(/[^a-z0-9]+/g, '_') + "_export.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
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
  renderMathInElement(elements.chatFeed, {
    delimiters: [
      {left: '$$', right: '$$', display: true},
      {left: '$', right: '$', display: false},
      {left: '\\(', right: '\\)', display: false},
      {left: '\\[', right: '\\]', display: true}
    ],
    throwOnError: false
  });

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
  activeChat.systemPrompt = PERSONAS[personaName].system;
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
function deleteMessage(index) {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  if (confirm("Delete this message?")) {
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

  if (settings.useMaxTurns) {
    elements.inputInfo.style.display = 'block';
    elements.inputInfo.innerHTML = `<span style="font-weight:600;">Exchanges:</span> ${activeChat.turnCount} of ${settings.maxTurns}`;
  } else {
    elements.inputInfo.style.display = 'none';
  }

  handleTextareaAutoGrow();
}
