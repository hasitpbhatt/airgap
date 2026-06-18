// System Constants
const PERSONAS = {
  general: {
    label: 'General Assistant',
    icon: '🤖',
    system: 'You are a helpful, precise, and friendly AI assistant. Answer the user\'s questions thoroughly and accurately.'
  },
  child: {
    label: 'Like I\'m 10',
    icon: '🧒',
    system: 'You are explaining to a 10-year-old child. Use simple words, fun analogies, and everyday examples. No jargon. Keep it engaging and easy to understand.'
  },
  deep: {
    label: 'Deep Dive',
    icon: '🔬',
    system: 'You are a domain expert. Provide deep, nuanced insights and connect the concept to advanced research, industry practices, or expert-level perspectives. Assume the student has strong foundational knowledge.'
  },
  'first-principles': {
    label: 'First Principles',
    icon: '🧠',
    system: 'You are a first-principles thinker. Break the concept down to its most fundamental truths and derive the explanation from base principles. Use logical reasoning, and where applicable, mathematical or formal foundations. Assume the student is comfortable with abstract thinking.'
  },
  socratic: {
    label: 'Socratic Tutor',
    icon: '❓',
    system: 'You are a Socratic tutor. Do not give direct answers. Instead, ask guiding questions that lead the student to discover the concept themselves. Challenge their assumptions and help them reason step by step.'
  },
  custom: {
    label: 'Custom Persona',
    icon: '⚙️',
    system: ''
  }
};

// Tool Definitions for Agentic Behaviour
const AVAILABLE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'fetch_url',
      description: 'Fetch and read the content from any URL on the web. Use this to get the latest information, read documentation, access web pages, or retrieve data from APIs.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The complete URL (including protocol, e.g. https://) to fetch' }
        },
        required: ['url']
      }
    }
  }
];
const MAX_TOOL_LOOP = 10;

// State Variables
let chats = [];
let currentChatId = null;
let settings = {
  proxyUrl: 'https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/',
  fetchUrl: '',
  apiKey: '',
  modelName: 'mistral-small-latest',
  useMaxTurns: false,
  maxTurns: 5,
  currentPersona: 'general',
  customSystemPrompt: ''
};
let abortController = null;
let isGenerating = false;

// DOM Elements Reference
const elements = {
  sidebar: document.getElementById('sidebar'),
  sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
  closeSidebarBtn: document.getElementById('close-sidebar-btn'),
  sidebarOverlay: document.getElementById('sidebar-overlay'),
  newChatBtn: document.getElementById('new-chat-btn'),
  chatList: document.getElementById('chat-list'),
  
  settingsTrigger: document.getElementById('settings-trigger'),
  settingsChevron: document.getElementById('settings-chevron'),
  settingsPanel: document.getElementById('settings-panel'),
  
  // Inputs
  proxyUrlInput: document.getElementById('proxy-url'),
  fetchUrlInput: document.getElementById('fetch-url'),
  apiKeyInput: document.getElementById('api-key'),
  modelSelect: document.getElementById('model-select'),
  customModelGroup: document.getElementById('custom-model-group'),
  modelNameInput: document.getElementById('model-name'),
  enableTurnsLimitCheckbox: document.getElementById('enable-turns-limit'),
  maxTurnsInput: document.getElementById('max-turns'),
  personaSelect: document.getElementById('persona-select'),
  systemPromptTextarea: document.getElementById('system-prompt'),
  
  // Main Chat UI
  activeChatTitle: document.getElementById('active-chat-title'),
  editTitleBtn: document.getElementById('edit-title-btn'),
  clearChatBtn: document.getElementById('clear-chat-btn'),
  exportChatBtn: document.getElementById('export-chat-btn'),
  chatFeedContainer: document.getElementById('chat-feed-container'),
  chatFeed: document.getElementById('chat-feed'),
  
  // Footer Input
  limitReachedBanner: document.getElementById('limit-reached-banner'),
  chatTextarea: document.getElementById('chat-textarea'),
  inputInfo: document.getElementById('input-info'),
  stopGenBtn: document.getElementById('stop-gen-btn'),
  sendBtn: document.getElementById('send-btn')
};

// Check if there is an environment/host injected proxy URL fallback
const getInitialProxyUrl = () => {
  if (typeof MISTRAL_PROXY_URL !== 'undefined' && MISTRAL_PROXY_URL) {
    return MISTRAL_PROXY_URL;
  }
  return 'https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/';
};

// 1. Initialization & Load from LocalStorage
function init() {
  // Setup default proxy
  settings.proxyUrl = getInitialProxyUrl();

  // Load Settings
  const savedSettings = localStorage.getItem('opencode_settings');
  if (savedSettings) {
    try {
      settings = { ...settings, ...JSON.parse(savedSettings) };
      // If the saved proxy is the old localhost default, upgrade it to the new worker proxy default
      if (settings.proxyUrl === 'http://localhost:8080/v1/chat/completions') {
        settings.proxyUrl = 'https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/';
      }
      // Upgrade: Turn limit disabled by default
      if (!localStorage.getItem('opencode_settings_turns_migrated')) {
        settings.useMaxTurns = false;
        localStorage.setItem('opencode_settings_turns_migrated', 'true');
        saveSettings();
      }
    } catch (e) {
      console.error("Failed to parse settings", e);
    }
  }
  
  // Override saved proxyUrl if dynamic MISTRAL_PROXY_URL is injected by host/environment
  if (typeof MISTRAL_PROXY_URL !== 'undefined' && MISTRAL_PROXY_URL) {
    settings.proxyUrl = MISTRAL_PROXY_URL;
  }
  
  // Bind settings to UI
  elements.proxyUrlInput.value = settings.proxyUrl;
  if (elements.fetchUrlInput) elements.fetchUrlInput.value = settings.fetchUrl;
  elements.apiKeyInput.value = settings.apiKey;
  
  // Bind Model Selection presets
  const MODEL_PRESETS = ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest', 'codestral-latest'];
  const isPreset = MODEL_PRESETS.includes(settings.modelName);
  if (isPreset) {
    elements.modelSelect.value = settings.modelName;
    elements.customModelGroup.style.display = 'none';
    elements.modelNameInput.value = settings.modelName;
  } else {
    elements.modelSelect.value = 'custom';
    elements.customModelGroup.style.display = 'inline-flex';
    elements.modelNameInput.value = settings.modelName || '';
  }
  
  elements.enableTurnsLimitCheckbox.checked = settings.useMaxTurns;
  elements.maxTurnsInput.value = settings.maxTurns;
  elements.maxTurnsInput.disabled = !settings.useMaxTurns;
  elements.personaSelect.value = settings.currentPersona;
  
  if (settings.currentPersona === 'custom') {
    elements.systemPromptTextarea.value = settings.customSystemPrompt || '';
  } else {
    elements.systemPromptTextarea.value = PERSONAS[settings.currentPersona].system;
    elements.systemPromptTextarea.disabled = true;
  }

  // Load Chats
  const savedChats = localStorage.getItem('opencode_chats');
  if (savedChats) {
    try {
      chats = JSON.parse(savedChats);
    } catch (e) {
      console.error("Failed to load chats", e);
      chats = [];
    }
  }

  currentChatId = localStorage.getItem('opencode_current_chat_id');
  if (chats.length === 0) {
    createNewChat();
  } else {
    const chatExists = chats.find(c => c.id === currentChatId);
    if (!chatExists) {
      currentChatId = chats[0].id;
    }
    selectChat(currentChatId);
  }

  // Initialize icons
  lucide.createIcons();
  setupEventListeners();
  adjustResponsiveLayout();
}

// Save helpers
function saveSettings() {
  localStorage.setItem('opencode_settings', JSON.stringify(settings));
}

function saveChats() {
  localStorage.setItem('opencode_chats', JSON.stringify(chats));
}

// 2. Settings Event Listeners & Binding
function setupEventListeners() {
  // Config toggle expand/collapse
  elements.settingsTrigger.addEventListener('click', () => {
    const isOpen = elements.settingsPanel.classList.toggle('open');
    elements.settingsChevron.setAttribute('data-lucide', isOpen ? 'chevron-down' : 'chevron-up');
    lucide.createIcons();
  });

  // Settings binding
  elements.proxyUrlInput.addEventListener('input', (e) => {
    settings.proxyUrl = e.target.value.trim();
    saveSettings();
  });
  if (elements.fetchUrlInput) {
    elements.fetchUrlInput.addEventListener('input', (e) => {
      settings.fetchUrl = e.target.value.trim();
      saveSettings();
    });
  }
  elements.apiKeyInput.addEventListener('input', (e) => {
    settings.apiKey = e.target.value.trim();
    saveSettings();
  });
  elements.modelSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      elements.customModelGroup.style.display = 'inline-flex';
      settings.modelName = elements.modelNameInput.value.trim();
      elements.modelNameInput.focus();
    } else {
      elements.customModelGroup.style.display = 'none';
      settings.modelName = val;
      elements.modelNameInput.value = val;
    }
    saveSettings();
  });

  elements.modelNameInput.addEventListener('input', (e) => {
    if (elements.modelSelect.value === 'custom') {
      settings.modelName = e.target.value.trim();
      saveSettings();
    }
  });
  elements.enableTurnsLimitCheckbox.addEventListener('change', (e) => {
    settings.useMaxTurns = e.target.checked;
    elements.maxTurnsInput.disabled = !settings.useMaxTurns;
    saveSettings();
    updateInputUIState();
  });
  elements.maxTurnsInput.addEventListener('input', (e) => {
    settings.maxTurns = parseInt(e.target.value) || 5;
    saveSettings();
    updateInputUIState();
  });

  // Persona Selector binding
  elements.personaSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    settings.currentPersona = val;
    
    if (val === 'custom') {
      elements.systemPromptTextarea.value = settings.customSystemPrompt || '';
      elements.systemPromptTextarea.disabled = false;
    } else {
      elements.systemPromptTextarea.value = PERSONAS[val].system;
      elements.systemPromptTextarea.disabled = true;
    }
    saveSettings();

    // Update current chat system prompt if it has no assistant turn yet
    const currentChat = getActiveChat();
    if (currentChat && getMessageCountWithoutSystem(currentChat) === 0) {
      currentChat.persona = val;
      currentChat.systemPrompt = elements.systemPromptTextarea.value;
      currentChat.messages[0].content = currentChat.systemPrompt;
      saveChats();
    }
  });

  elements.systemPromptTextarea.addEventListener('input', (e) => {
    if (settings.currentPersona === 'custom') {
      settings.customSystemPrompt = e.target.value;
      saveSettings();
      
      const currentChat = getActiveChat();
      if (currentChat && getMessageCountWithoutSystem(currentChat) === 0) {
        currentChat.systemPrompt = e.target.value;
        currentChat.messages[0].content = e.target.value;
        saveChats();
      }
    }
  });

  // Session UI elements
  elements.newChatBtn.addEventListener('click', () => {
    createNewChat();
    if (window.innerWidth <= 768) {
      toggleSidebar(false);
    }
  });
  
  elements.sidebarToggleBtn.addEventListener('click', () => {
    toggleSidebar();
  });
  elements.closeSidebarBtn.addEventListener('click', () => {
    toggleSidebar(false);
  });
  elements.sidebarOverlay.addEventListener('click', () => {
    toggleSidebar(false);
  });

  // Edit active chat title
  elements.editTitleBtn.addEventListener('click', startEditingTitle);
  elements.clearChatBtn.addEventListener('click', clearCurrentChat);
  elements.exportChatBtn.addEventListener('click', exportCurrentChat);

  // Chat Input logic
  elements.chatTextarea.addEventListener('input', handleTextareaAutoGrow);
  elements.chatTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      triggerSend();
    }
  });
  elements.sendBtn.addEventListener('click', triggerSend);
  elements.stopGenBtn.addEventListener('click', stopGenerating);

  window.addEventListener('resize', adjustResponsiveLayout);
}

// 3. UI helpers for Sidebar & Responsiveness
function toggleSidebar(forceState) {
  const isCollapsed = elements.sidebar.classList.contains('collapsed');
  const shouldCollapse = forceState !== undefined ? !forceState : !isCollapsed;
  
  elements.sidebar.classList.toggle('collapsed', shouldCollapse);
  elements.sidebarOverlay.classList.toggle('active', !shouldCollapse && window.innerWidth <= 768);
}

function adjustResponsiveLayout() {
  const isMobile = window.innerWidth <= 768;
  elements.closeSidebarBtn.style.display = isMobile ? 'flex' : 'none';
  if (!isMobile) {
    elements.sidebarOverlay.classList.remove('active');
  } else {
    elements.sidebar.classList.add('collapsed');
  }
}

// Textarea autogrow logic
function handleTextareaAutoGrow() {
  elements.chatTextarea.style.height = 'auto';
  elements.chatTextarea.style.height = elements.chatTextarea.scrollHeight + 'px';
  elements.sendBtn.disabled = elements.chatTextarea.value.trim().length === 0 || isGenerating;
}

// 4. Chat session logic
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

  // Update persona select and prompt field to match active chat parameters if it hasn't started yet
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

  // Render active state in list
  document.querySelectorAll('.chat-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-id') === id);
  });

  // Update header details
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
    
    // Find persona icon
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

    // Event to select
    item.addEventListener('click', (e) => {
      if (e.target.closest('.chat-action-btn')) return; // Avoid select when actions clicked
      selectChat(chat.id);
      if (window.innerWidth <= 768) {
        toggleSidebar(false);
      }
    });

    // Rename logic
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

    // Delete logic
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
            // If deleted active chat, load first
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

  // Hide active components
  titleElement.style.display = 'none';
  editBtn.style.display = 'none';

  // Insert input element
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
  
  const fileName = activeChat.title.toLowerCase().replace(/[^a-z0-9]+/g, '_') + "_export.json";
  downloadAnchor.setAttribute("download", fileName);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// 5. Chat view rendering (Markdown + Prism + KaTeX)
function renderChatFeed() {
  const activeChat = getActiveChat();
  elements.chatFeed.innerHTML = '';

  if (!activeChat || getMessageCountWithoutSystem(activeChat) === 0) {
    renderWelcomeScreen();
    return;
  }

  // Render Messages
  activeChat.messages.forEach((msg, idx) => {
    if (msg.role === 'system') return; // Hide system messages

    const msgRow = document.createElement('div');
    msgRow.className = `message-row ${msg.role}`;
    
    const isUser = msg.role === 'user';
    const personaIcon = PERSONAS[activeChat.persona]?.icon || '🤖';
    const personaLabel = PERSONAS[activeChat.persona]?.label || 'AI Assistant';

    // Set content HTML
    let htmlContent = '';
    if (isUser) {
      htmlContent = `<p>${escapeHtml(msg.content)}</p>`;
    } else {
      // If response has error format
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

  // Highlight syntax & math
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

// Helper functions for code rendering
function highlightCodeBlocks() {
  const preElements = elements.chatFeed.querySelectorAll('pre');
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
    pre.parentNode.insertBefore(container, pre);

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
  
  Prism.highlightAllUnder(elements.chatFeed);
}

function copyCodeSnippet(button) {
  const container = button.closest('.code-container');
  const codeBlock = container.querySelector('code');
  const textToCopy = codeBlock.textContent;

  navigator.clipboard.writeText(textToCopy).then(() => {
    const textSpan = button.querySelector('span');
    button.style.borderColor = 'hsl(var(--success))';
    button.style.color = 'hsl(var(--success))';
    textSpan.textContent = 'Copied!';
    
    setTimeout(() => {
      button.style.borderColor = '';
      button.style.color = '';
      textSpan.textContent = 'Copy';
    }, 2000);
  });
}

function copyMessageText(button, index) {
  const activeChat = getActiveChat();
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

function mdToHtml(text) {
  if (typeof marked !== 'undefined' && marked.parse) {
    try {
      return sanitizeHtml(marked.parse(text, { breaks: true }));
    } catch (e) {
      console.error("Markdown parsing failed", e);
    }
  }
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function sanitizeHtml(html) {
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

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function scrollToBottom() {
  elements.chatFeedContainer.scrollTop = elements.chatFeedContainer.scrollHeight;
}

// 6. Input UI State
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

// 7. API Communication Logic (Fetch + Abort)
function triggerSend() {
  const text = elements.chatTextarea.value.trim();
  const activeChat = getActiveChat();
  
  if (!text || !activeChat || isGenerating) return;
  
  if (settings.useMaxTurns && activeChat.turnCount >= settings.maxTurns) {
    alert("Turn limit reached. Start a new session or increase the limit in settings.");
    return;
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
  scrollToBottom();

  abortController = new AbortController();
  const messages = activeChat.messages.map(m => ({
    role: m.role,
    content: m.content
  }));
  let toolDepth = 0;

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

        for (const tc of message.tool_calls) {
          appendToolCallUI(tc);
          const result = await executeToolCall(tc);
          updateToolCallUI(tc, result);
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result)
          });
        }

        toolDepth++;
        continue;
      }

      const bubble = document.getElementById('temp-loading-bubble');
      if (bubble) bubble.remove();

      const content = message?.content || '';
      if (content) {
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

  return { error: `Unknown tool: ${name}` };
}

function appendToolCallUI(toolCall) {
  const { name, arguments: argsRaw } = toolCall.function;
  let url = '';
  try {
    url = JSON.parse(argsRaw).url || argsRaw;
  } catch { url = argsRaw; }

  const loadingBubble = document.getElementById('temp-loading-bubble');
  const row = document.createElement('div');
  row.className = 'message-row tool-call';
  row.id = `tool-call-${toolCall.id}`;
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

  if (result.error) {
    row.innerHTML = `
      <div class="message-bubble tool-call-bubble tool-call-error">
        <div class="msg-content">
          <i data-lucide="alert-circle" style="width: 14px; height: 14px; vertical-align: middle; color: hsl(var(--danger));"></i>
          <span class="tool-call-label">Fetch failed:</span>
          <code class="tool-call-url">${escapeHtml(result.error)}</code>
        </div>
      </div>
    `;
  } else {
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
  }

  scrollToBottom();
  lucide.createIcons();
}

function retryMessage(errorIndex) {
  const activeChat = getActiveChat();
  if (!activeChat) return;

  activeChat.messages = activeChat.messages.slice(0, errorIndex);
  saveChats();
  renderChatFeed();
  triggerSendAPI();
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

// Bind initialization
window.addEventListener('DOMContentLoaded', init);
