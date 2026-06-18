// TypeScript version of UI management and DOM manipulation
import { State, Chat, Message, Persona, UIActions, DOMElements } from './types.js';
import state from './state.js';
import api from './api.js';
import { PERSONAS, escapeHtml } from './utils.js';

class UIManager implements UIActions {
  private elements: DOMElements;

  constructor() {
    this.elements = {
      sidebar: document.getElementById('sidebar') as HTMLElement,
      sidebarToggleBtn: document.getElementById('sidebar-toggle-btn') as HTMLElement,
      closeSidebarBtn: document.getElementById('close-sidebar-btn') as HTMLElement,
      sidebarOverlay: document.getElementById('sidebar-overlay') as HTMLElement,
      newChatBtn: document.getElementById('new-chat-btn') as HTMLElement,
      chatList: document.getElementById('chat-list') as HTMLElement,
      
      settingsTrigger: document.getElementById('settings-trigger') as HTMLElement,
      settingsChevron: document.getElementById('settings-chevron') as HTMLElement,
      settingsPanel: document.getElementById('settings-panel') as HTMLElement,
      
      // Inputs
      proxyUrlInput: document.getElementById('proxy-url') as HTMLInputElement,
      apiKeyInput: document.getElementById('api-key') as HTMLInputElement,
      modelSelect: document.getElementById('model-select') as HTMLSelectElement,
      customModelGroup: document.getElementById('custom-model-group') as HTMLElement,
      modelNameInput: document.getElementById('model-name') as HTMLInputElement,
      enableTurnsLimitCheckbox: document.getElementById('enable-turns-limit') as HTMLInputElement,
      maxTurnsInput: document.getElementById('max-turns') as HTMLInputElement,
      personaSelect: document.getElementById('persona-select') as HTMLSelectElement,
      systemPromptTextarea: document.getElementById('system-prompt') as HTMLTextAreaElement,
      
      // Main Chat UI
      activeChatTitle: document.getElementById('active-chat-title') as HTMLElement,
      editTitleBtn: document.getElementById('edit-title-btn') as HTMLElement,
      clearChatBtn: document.getElementById('clear-chat-btn') as HTMLElement,
      exportChatBtn: document.getElementById('export-chat-btn') as HTMLElement,
      chatFeedContainer: document.getElementById('chat-feed-container') as HTMLElement,
      chatFeed: document.getElementById('chat-feed') as HTMLElement,
      
      // Footer Input
      limitReachedBanner: document.getElementById('limit-reached-banner') as HTMLElement,
      chatTextarea: document.getElementById('chat-textarea') as HTMLTextAreaElement,
      inputInfo: document.getElementById('input-info') as HTMLElement,
      stopGenBtn: document.getElementById('stop-gen-btn') as HTMLElement,
      sendBtn: document.getElementById('send-btn') as HTMLElement
    };
    
    this.bindEvents();
  }

  private bindEvents(): void {
    // Config toggle expand/collapse
    this.elements.settingsTrigger.addEventListener('click', () => {
      const isOpen = this.elements.settingsPanel.classList.toggle('open');
      this.elements.settingsChevron.setAttribute('data-lucide', isOpen ? 'chevron-down' : 'chevron-up');
      lucide.createIcons();
    });

    // Settings binding
    this.elements.proxyUrlInput.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      state.updateState({
        settings: { ...state.getState().settings, proxyUrl: target.value.trim() }
      });
    });
    
    this.elements.apiKeyInput.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      state.updateState({
        settings: { ...state.getState().settings, apiKey: target.value.trim() }
      });
    });

    this.elements.modelSelect.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      const currentSettings = state.getState().settings;
      
      if (val === 'custom') {
        this.elements.customModelGroup.style.display = 'inline-flex';
        state.updateState({
          settings: { ...currentSettings, modelName: this.elements.modelNameInput.value.trim() }
        });
        this.elements.modelNameInput.focus();
      } else {
        this.elements.customModelGroup.style.display = 'none';
        state.updateState({
          settings: { ...currentSettings, modelName: val }
        });
        this.elements.modelNameInput.value = val;
      }
    });

    this.elements.modelNameInput.addEventListener('input', (e) => {
      if (this.elements.modelSelect.value === 'custom') {
        const target = e.target as HTMLInputElement;
        state.updateState({
          settings: { ...state.getState().settings, modelName: target.value.trim() }
        });
      }
    });

    this.elements.enableTurnsLimitCheckbox.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const currentSettings = state.getState().settings;
      state.updateState({
        settings: { 
          ...currentSettings, 
          useMaxTurns: target.checked,
          maxTurns: target.checked ? currentSettings.maxTurns : 5
        }
      });
      this.elements.maxTurnsInput.disabled = !target.checked;
      this.updateInputUIState();
    });

    this.elements.maxTurnsInput.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      state.updateState({
        settings: { 
          ...state.getState().settings, 
          maxTurns: parseInt(target.value) || 5 
        }
      });
      this.updateInputUIState();
    });

    // Persona Selector binding
    this.elements.personaSelect.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      const currentSettings = state.getState().settings;
      
      state.updateState({
        settings: { ...currentSettings, currentPersona: val }
      });

      if (val === 'custom') {
        this.elements.systemPromptTextarea.value = currentSettings.customSystemPrompt || '';
        this.elements.systemPromptTextarea.disabled = false;
      } else {
        this.elements.systemPromptTextarea.value = PERSONAS[val as keyof typeof PERSONAS].system;
        this.elements.systemPromptTextarea.disabled = true;
      }

      const activeChat = state.getActiveChat();
      if (activeChat && state.getMessageCountWithoutSystem(activeChat) === 0) {
        activeChat.persona = val;
        activeChat.systemPrompt = this.elements.systemPromptTextarea.value;
        activeChat.messages[0].content = activeChat.systemPrompt;
        state.saveToStorage();
      }
    });

    this.elements.systemPromptTextarea.addEventListener('input', (e) => {
      if (state.getState().settings.currentPersona === 'custom') {
        const target = e.target as HTMLTextAreaElement;
        state.updateState({
          settings: { 
            ...state.getState().settings, 
            customSystemPrompt: target.value 
          }
        });

        const activeChat = state.getActiveChat();
        if (activeChat && state.getMessageCountWithoutSystem(activeChat) === 0) {
          activeChat.systemPrompt = target.value;
          activeChat.messages[0].content = target.value;
          state.saveToStorage();
        }
      }
    });

    // Session UI elements
    this.elements.newChatBtn.addEventListener('click', () => {
      this.createNewChat();
      if (window.innerWidth <= 768) {
        this.toggleSidebar(false);
      }
    });

    this.elements.sidebarToggleBtn.addEventListener('click', () => {
      this.toggleSidebar();
    });

    this.elements.closeSidebarBtn.addEventListener('click', () => {
      this.toggleSidebar(false);
    });

    this.elements.sidebarOverlay.addEventListener('click', () => {
      this.toggleSidebar(false);
    });

    this.elements.editTitleBtn.addEventListener('click', () => {
      this.startEditingTitle();
    });

    this.elements.clearChatBtn.addEventListener('click', () => {
      this.clearCurrentChat();
    });

    this.elements.exportChatBtn.addEventListener('click', () => {
      this.exportCurrentChat();
    });

    // Chat Input logic
    this.elements.chatTextarea.addEventListener('input', () => {
      this.handleTextareaAutoGrow();
    });

    this.elements.chatTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.triggerSend();
      }
    });

    this.elements.sendBtn.addEventListener('click', () => {
      this.triggerSend();
    });

    this.elements.stopGenBtn.addEventListener('click', () => {
      this.stopGenerating();
    });

    window.addEventListener('resize', () => {
      this.adjustResponsiveLayout();
    });
  }

  toggleSidebar(forceState?: boolean): void {
    const isCollapsed = this.elements.sidebar.classList.contains('collapsed');
    const shouldCollapse = forceState !== undefined ? !forceState : !isCollapsed;
    
    this.elements.sidebar.classList.toggle('collapsed', shouldCollapse);
    this.elements.sidebarOverlay.classList.toggle('active', !shouldCollapse && window.innerWidth <= 768);
  }

  adjustResponsiveLayout(): void {
    const isMobile = window.innerWidth <= 768;
    this.elements.closeSidebarBtn.style.display = isMobile ? 'flex' : 'none';
    if (!isMobile) {
      this.elements.sidebarOverlay.classList.remove('active');
    } else {
      this.elements.sidebar.classList.add('collapsed');
    }
  }

  handleTextareaAutoGrow(): void {
    this.elements.chatTextarea.style.height = 'auto';
    this.elements.chatTextarea.style.height = this.elements.chatTextarea.scrollHeight + 'px';
    this.elements.sendBtn.disabled = this.elements.chatTextarea.value.trim().length === 0 || state.getState().isGenerating;
  }

  updateInputUIState(): void {
    const activeChat = state.getActiveChat();
    if (!activeChat) return;

    const isTurnLimitReached = state.getState().settings.useMaxTurns && activeChat.turnCount >= state.getState().settings.maxTurns;
    this.elements.limitReachedBanner.style.display = isTurnLimitReached ? 'block' : 'none';
    
    this.elements.chatTextarea.disabled = isTurnLimitReached || state.getState().isGenerating;
    this.elements.chatTextarea.placeholder = isTurnLimitReached 
      ? "Turn limit reached. Please start a new conversation."
      : "Type your message here... (Enter to send, Shift+Enter for newline)";

    if (state.getState().settings.useMaxTurns) {
      this.elements.inputInfo.style.display = 'block';
      this.elements.inputInfo.innerHTML = `<span style="font-weight:600;">Exchanges:</span> ${activeChat.turnCount} of ${state.getState().settings.maxTurns}`;
    } else {
      this.elements.inputInfo.style.display = 'none';
    }

    this.handleTextareaAutoGrow();
  }

  async triggerSend(): Promise<void> {
    const text = this.elements.chatTextarea.value.trim();
    const activeChat = state.getActiveChat();
    
    if (!text || !activeChat || state.getState().isGenerating) return;

    if (state.getState().settings.useMaxTurns && activeChat.turnCount >= state.getState().settings.maxTurns) {
      alert("Turn limit reached. Start a new session or increase the limit in settings.");
      return;
    }

    activeChat.messages.push({ role: 'user', content: text });
    this.elements.chatTextarea.value = '';
    this.handleTextareaAutoGrow();

    this.renderChatFeed();
    this.renderChatList();
    await this.triggerSendAPI();
  }

  async triggerSendAPI(): Promise<void> {
    const activeChat = state.getActiveChat();
    if (!activeChat) return;

    state.updateState({ isGenerating: true });

    const loadingRow = document.createElement('div');
    loadingRow.className = 'message-row assistant';
    loadingRow.id = 'temp-loading-bubble';
    loadingRow.innerHTML = `
      <div class="message-bubble">
        <div class="msg-header assistant">
          ${PERSONAS[activeChat.persona as keyof typeof PERSONAS]?.icon || '🤖'} ${PERSONAS[activeChat.persona as keyof typeof PERSONAS]?.label || 'Assistant'}
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
    this.elements.chatFeed.appendChild(loadingRow);
    this.scrollToBottom();

    state.updateState({ abortController: new AbortController() });
    const apiMessages = activeChat.messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      const content = await api.sendMessage(apiMessages, state.getState().abortController as AbortController);

      const bubble = document.getElementById('temp-loading-bubble');
      if (bubble) bubble.remove();

      if (content) {
        activeChat.messages.push({ role: 'assistant', content: content });
        activeChat.turnCount++;
        state.saveToStorage();
      } else {
        throw new Error('Received an empty response from the server.');
      }

    } catch (err) {
      const bubble = document.getElementById('temp-loading-bubble');
      if (bubble) bubble.remove();

      if ((err as Error).name === 'AbortError') {
        activeChat.messages.push({ 
          role: 'assistant', 
          content: 'Response generation was stopped.', 
          isStopped: true 
        });
        state.saveToStorage();
      } else {
        console.error("API Fetch Error:", err);
        activeChat.messages.push({ 
          role: 'assistant', 
          content: `Failed to fetch AI response: ${(err as Error).message}`, 
          isError: true 
        });
        state.saveToStorage();
      }
    } finally {
      state.updateState({ isGenerating: false, abortController: null });
      this.renderChatFeed();
      this.updateInputUIState();
    }
  }

  stopGenerating(): void {
    if (state.getState().abortController) {
      state.getState().abortController.abort();
    }
  }

  setGeneratingState(generating: boolean): void {
    state.updateState({ isGenerating: generating });
    this.elements.chatTextarea.disabled = generating;
    this.elements.sendBtn.style.display = generating ? 'none' : 'flex';
    this.elements.stopGenBtn.style.display = generating ? 'flex' : 'none';
    
    if (!generating) {
      this.elements.chatTextarea.focus();
    }
  }

  createNewChat(initialPersona?: string): void {
    const currentState = state.getState();
    const persona = initialPersona || currentState.settings.currentPersona;
    const systemPrompt = persona === 'custom' 
      ? (currentState.settings.customSystemPrompt || '') 
      : PERSONAS[persona as keyof typeof PERSONAS].system;

    const newChat: Chat = {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      title: 'Session ' + (currentState.chats.length + 1),
      persona: persona,
      systemPrompt: systemPrompt,
      messages: [
        { role: 'system', content: systemPrompt }
      ],
      turnCount: 0
    };

    state.updateState({ chats: [newChat, ...currentState.chats] });
    state.updateState({ currentChatId: newChat.id });
    
    this.renderChatList();
    this.selectChat(newChat.id);
  }

  selectChat(id: string): void {
    state.updateState({ currentChatId: id });
    
    const activeChat = state.getActiveChat();
    if (!activeChat) return;

    if (state.getMessageCountWithoutSystem(activeChat) === 0) {
      this.elements.personaSelect.value = activeChat.persona;
      if (activeChat.persona === 'custom') {
        this.elements.systemPromptTextarea.value = activeChat.systemPrompt;
        this.elements.systemPromptTextarea.disabled = false;
      } else {
        this.elements.systemPromptTextarea.value = PERSONAS[activeChat.persona as keyof typeof PERSONAS].system;
        this.elements.systemPromptTextarea.disabled = true;
      }
    }

    document.querySelectorAll('.chat-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-id') === id);
    });

    this.elements.activeChatTitle.textContent = activeChat.title;
    
    this.renderChatFeed();
    this.updateInputUIState();
    
    this.elements.chatTextarea.value = '';
    this.elements.chatTextarea.focus();
    this.handleTextareaAutoGrow();
  }

  renderChatList(): void {
    this.elements.chatList.innerHTML = '';
    const currentState = state.getState();
    
    if (currentState.chats.length === 0) {
      this.elements.chatList.innerHTML = `<div style="text-align: center; color: hsl(var(--text-muted)); font-size: 0.8rem; margin-top: 2rem;">No conversations</div>`;
      return;
    }

    currentState.chats.forEach(chat => {
      const item = document.createElement('div');
      item.className = 'chat-item';
      if (chat.id === currentState.currentChatId) item.classList.add('active');
      item.setAttribute('data-id', chat.id);
      
      const icon = PERSONAS[chat.persona as keyof typeof PERSONAS]?.icon || '🤖';

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
        if (e.target && (e.target as Element).closest('.chat-action-btn')) return;
        this.selectChat(chat.id);
        if (window.innerWidth <= 768) {
          this.toggleSidebar(false);
        }
      });

      item.querySelector('.rename-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const newName = prompt("Enter new title for conversation:", chat.title);
        if (newName && newName.trim() !== '') {
          chat.title = newName.trim();
          state.saveToStorage();
          this.renderChatList();
          if (chat.id === currentState.currentChatId) {
            this.elements.activeChatTitle.textContent = chat.title;
          }
        }
      });

      item.querySelector('.delete-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${chat.title}"?`)) {
          const index = currentState.chats.findIndex(c => c.id === chat.id);
          if (index !== -1) {
            currentState.chats.splice(index, 1);
            state.saveToStorage();
            
            if (currentState.chats.length === 0) {
              this.createNewChat();
            } else if (chat.id === currentState.currentChatId) {
              this.selectChat(currentState.chats[0].id);
            } else {
              this.renderChatList();
            }
          }
        }
      });

      this.elements.chatList.appendChild(item);
    });

    lucide.createIcons();
  }

  startEditingTitle(): void {
    const activeChat = state.getActiveChat();
    if (!activeChat) return;

    const titleContainer = this.elements.activeChatTitle.parentElement;
    const titleElement = this.elements.activeChatTitle;
    const editBtn = this.elements.editTitleBtn;

    titleElement.style.display = 'none';
    editBtn.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'title-edit-input';
    input.value = activeChat.title;
    titleContainer?.insertBefore(input, titleElement);
    input.focus();
    input.select();

    const finishEditing = () => {
      const val = input.value.trim();
      if (val !== '') {
        activeChat.title = val;
        state.saveToStorage();
        titleElement.textContent = val;
        this.renderChatList();
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

  clearCurrentChat(): void {
    const activeChat = state.getActiveChat();
    if (!activeChat) return;

    if (confirm("Clear all messages in this conversation? (Keep settings & system prompt)")) {
      activeChat.messages = [
        { role: 'system', content: activeChat.systemPrompt }
      ];
      activeChat.turnCount = 0;
      state.saveToStorage();
      this.renderChatFeed();
      this.updateInputUIState();
    }
  }

  exportCurrentChat(): void {
    const activeChat = state.getActiveChat();
    if (!activeChat) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeChat, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    
    const fileName = activeChat.title.toLowerCase().replace(/[^a-z0-9]+/g, '_') + "_export.json";
    downloadAnchor.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  renderChatFeed(): void {
    const activeChat = state.getActiveChat();
    this.elements.chatFeed.innerHTML = '';

    if (!activeChat || state.getMessageCountWithoutSystem(activeChat) === 0) {
      this.renderWelcomeScreen();
      return;
    }

    activeChat.messages.forEach((msg, idx) => {
      if (msg.role === 'system') return;

      const msgRow = document.createElement('div');
      msgRow.className = `message-row ${msg.role}`;
      
      const isUser = msg.role === 'user';
      const personaIcon = PERSONAS[activeChat.persona as keyof typeof PERSONAS]?.icon || '🤖';
      const personaLabel = PERSONAS[activeChat.persona as keyof typeof PERSONAS]?.label || 'AI Assistant';

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
          htmlContent = this.mdToHtml(msg.content);
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

      this.elements.chatFeed.appendChild(msgRow);
    });

    this.highlightCodeBlocks();
    renderMathInElement(this.elements.chatFeed, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
      ],
      throwOnError: false
    });

    lucide.createIcons();
    this.scrollToBottom();
  }

  renderWelcomeScreen(): void {
    this.elements.chatFeed.innerHTML = `
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

  selectPersonaForNewChat(personaName: string): void {
    const activeChat = state.getActiveChat();
    if (!activeChat) return;

    activeChat.persona = personaName;
    activeChat.systemPrompt = PERSONAS[personaName as keyof typeof PERSONAS].system;
    activeChat.messages[0].content = activeChat.systemPrompt;
    
    this.elements.personaSelect.value = personaName;
    this.elements.systemPromptTextarea.value = activeChat.systemPrompt;
    this.elements.systemPromptTextarea.disabled = true;

    state.saveToStorage();
    this.renderChatList();
    this.renderChatFeed();
    
    this.elements.chatTextarea.focus();
  }

  highlightCodeBlocks(): void {
    const preElements = this.elements.chatFeed.querySelectorAll('pre');
    preElements.forEach(pre => {
      const codeElement = pre.querySelector('code');
      if (!codeElement) return;

      let lang = 'code';
      const classes = codeElement.className.split(' ');
      const langClass = classes.find(c => c.startsWith('language-'));
      if (langClass) {
        lang = langClass.replace('language-', '');
      }

      if (pre.previousElementSibling && pre.previousElementSibling.classList.contains('code-block-header')) return;

      const container = document.createElement('div');
      container.className = 'code-container';
      pre.parentNode?.insertBefore(container, pre);

      const header = document.createElement('div');
      header.className = 'code-block-header';
      header.innerHTML = `
        <span>${lang.toUpperCase()}</span>
        <button class="btn-copy-code" onclick="copyCodeSnippet(this)">
          <i data-lucide="copy" style="width: 10px; height: 10px;"></i>
          <span>Copy</span>
        </button>
      `;
      
      container.appendChild(header);
      container.appendChild(pre);

      pre.className = 'code-block-body';
    });
    
    Prism.highlightAllUnder(this.elements.chatFeed);
  }

  copyCodeSnippet(button: HTMLElement): void {
    const container = button.closest('.code-container');
    const codeBlock = container?.querySelector('code');
    const textToCopy = codeBlock?.textContent;

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        const textSpan = button.querySelector('span');
        button.style.borderColor = 'hsl(var(--success))';
        button.style.color = 'hsl(var(--success))';
        textSpan!.textContent = 'Copied!';
        
        setTimeout(() => {
          button.style.borderColor = '';
          button.style.color = '';
          textSpan!.textContent = 'Copy';
        }, 2000);
      });
    }
  }

  copyMessageText(button: HTMLElement, index: number): void {
    const activeChat = state.getActiveChat();
    if (!activeChat || !activeChat.messages[index]) return;

    navigator.clipboard.writeText(activeChat.messages[index].content).then(() => {
      const originalHtml = button.innerHTML;
      button.innerHTML = '<i data-lucide="check" style="width: 12px; height: 12px; color: hsl(var(--success));"></i>';
      lucide.createIcons();
      setTimeout(() => {
        button.innerHTML = originalHtml;
        lucide.createIcons();
      }, 1500);
    });
  }

  deleteMessage(index: number): void {
    const activeChat = state.getActiveChat();
    if (!activeChat) return;

    if (confirm("Delete this message?")) {
      activeChat.messages.splice(index, 1);
      const userMsgCount = activeChat.messages.filter(m => m.role === 'user').length;
      activeChat.turnCount = userMsgCount;
      
      state.saveToStorage();
      this.renderChatFeed();
      this.updateInputUIState();
    }
  }

  editUserMessage(index: number): void {
    const activeChat = state.getActiveChat();
    if (!activeChat) return;

    const message = activeChat.messages[index];
    const newText = prompt("Edit your message:", message.content);
    
    if (newText !== null && newText.trim() !== '') {
      message.content = newText.trim();
      activeChat.messages = activeChat.messages.slice(0, index + 1);
      
      const userMsgCount = activeChat.messages.filter(m => m.role === 'user').length;
      activeChat.turnCount = userMsgCount;
      
      state.saveToStorage();
      this.renderChatFeed();
      this.updateInputUIState();
      
      this.triggerSendAPI();
    }
  }

  retryMessage(errorIndex: number): void {
    const activeChat = state.getActiveChat();
    if (!activeChat) return;

    activeChat.messages = activeChat.messages.slice(0, errorIndex);
    state.saveToStorage();
    this.renderChatFeed();
    this.triggerSendAPI();
  }

  mdToHtml(text: string): string {
    if (typeof marked !== 'undefined' && marked.parse) {
      try {
        return this.sanitizeHtml(marked.parse(text, { breaks: true }));
      } catch (e) {
        console.error("Markdown parsing failed", e);
      }
    }
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  sanitizeHtml(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    doc.querySelectorAll('script, iframe, object, embed, style').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
      for (const attr of [...el.attributes]) {
        if (attr.name.startsWith('on') ||
            (attr.name === 'href' && /^\s*javascript\s*:/i.test(attr.value)) ||
            (attr.name === 'src' && /^\s*javascript\s*:/i.test(attr.value))) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return doc.body.innerHTML;
  }

  scrollToBottom(): void {
    this.elements.chatFeedContainer.scrollTop = this.elements.chatFeedContainer.scrollHeight;
  }
}

export default new UIManager();