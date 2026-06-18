// Initialization & Load from LocalStorage
function init() {
  // Setup default proxy
  settings.proxyUrl = getInitialProxyUrl();

  // Load Settings
  const savedSettings = localStorage.getItem('opencode_settings');
  if (savedSettings) {
    try {
      settings = { ...settings, ...JSON.parse(savedSettings) };
      if (settings.proxyUrl === 'http://localhost:8080/v1/chat/completions' || settings.proxyUrl === 'https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/') {
        settings.proxyUrl = 'https://api.mistral.ai/v1/chat/completions';
      }
      if (!localStorage.getItem('opencode_settings_turns_migrated')) {
        settings.useMaxTurns = false;
        localStorage.setItem('opencode_settings_turns_migrated', 'true');
        saveSettings();
      }
    } catch (e) {
      console.error("Failed to parse settings", e);
    }
  }

  if (typeof MISTRAL_PROXY_URL !== 'undefined' && MISTRAL_PROXY_URL) {
    settings.proxyUrl = MISTRAL_PROXY_URL;
  }

  // URL param injection: ?k=<obfuscated> — sets API key without exposing in UI
  const urlParams = new URLSearchParams(window.location.search);
  const obfParam = urlParams.get('k');
  if (obfParam) {
    try {
      const _k = '_x4';
      const hex = obfParam;
      let dec = '';
      for (let i = 0; i < hex.length; i += 2) {
        dec += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ _k.charCodeAt((i / 2) % _k.length));
      }
      if (dec.startsWith('sk-') || dec.startsWith('gsk_')) {
        settings.apiKey = dec;
        settings.injectedKey = true;
        saveSettings();
      }
    } catch {}
    history.replaceState(null, '', window.location.pathname + window.location.hash);
  }

  // Bind settings to UI
  elements.proxyUrlInput.value = settings.proxyUrl;
  if (elements.fetchUrlInput) elements.fetchUrlInput.value = settings.fetchUrl;
  if (settings.injectedKey) {
    elements.apiKeyInput.placeholder = 'Key set from URL';
    elements.apiKeyInput.value = '';
  } else if (settings.apiKey) {
    elements.apiKeyInput.value = settings.apiKey;
  }
  toggleShareLink();

  // Connect screen: shown when no API key is set
  const connectOverlay = document.getElementById('connect-overlay');
  const connectInput = document.getElementById('connect-key-input');
  const connectUrlInput = document.getElementById('connect-url-input');
  const connectBtn = document.getElementById('connect-btn');
  function hideConnectScreen() {
    if (connectOverlay) connectOverlay.style.display = 'none';
  }
  function showConnectScreen() {
    if (connectOverlay) {
      if (connectUrlInput) connectUrlInput.value = settings.proxyUrl;
      connectOverlay.style.display = 'flex';
    }
  }
  if (!settings.apiKey && !settings.injectedKey) {
    showConnectScreen();
  }
  if (connectBtn) {
    const doConnect = () => {
      const key = connectInput.value.trim();
      const url = connectUrlInput ? connectUrlInput.value.trim() : '';
      if (!key) return;
      settings.apiKey = key;
      settings.injectedKey = false;
      if (url) settings.proxyUrl = url;
      elements.apiKeyInput.value = key;
      elements.apiKeyInput.placeholder = '';
      if (elements.proxyUrlInput) elements.proxyUrlInput.value = settings.proxyUrl;
      saveSettings();
      hideConnectScreen();
    };
    connectBtn.addEventListener('click', doConnect);
    connectInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doConnect();
    });
    if (connectUrlInput) {
      connectUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doConnect();
      });
    }
  }

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

  lucide.createIcons();
  setupEventListeners();
  adjustResponsiveLayout();
}

// Settings Event Listeners & Binding
function setupEventListeners() {
  // Config toggle expand/collapse
  elements.settingsTrigger.addEventListener('click', () => {
    const isOpen = elements.settingsPanel.classList.toggle('open');
    elements.settingsChevron.setAttribute('data-lucide', isOpen ? 'chevron-down' : 'chevron-up');
    lucide.createIcons();
  });

  // Memory panel toggle
  if (elements.memoryTriggerBtn) {
    elements.memoryTriggerBtn.addEventListener('click', () => {
      const isOpen = elements.memoryPanel.classList.toggle('open');
      elements.memoryChevron.setAttribute('data-lucide', isOpen ? 'chevron-down' : 'chevron-up');
      lucide.createIcons();
      if (isOpen) {
        renderMemoryPanel();
      }
    });
  }

  // Memory search filter
  if (elements.memorySearch) {
    elements.memorySearch.addEventListener('input', () => {
      renderMemoryPanel();
    });
  }

  // Clear all memory
  if (elements.clearMemoryBtn) {
    elements.clearMemoryBtn.addEventListener('click', () => {
      const keys = globalStoreListKeys();
      if (keys.length === 0) return;
      if (confirm('Delete all ' + keys.length + ' memories? This cannot be undone.')) {
        globalStoreClear();
        renderMemoryPanel();
      }
    });
  }

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
    if (settings.injectedKey && e.target.value.trim()) {
      settings.injectedKey = false;
      e.target.placeholder = '';
    }
    saveSettings();
    toggleShareLink();
  });

  const shareBtn = document.getElementById('gen-share-link');
  const shareOut = document.getElementById('share-link-out');
  shareBtn.addEventListener('click', () => {
    if (!settings.apiKey) return;
    const _k = '_x4';
    let hex = '';
    for (let i = 0; i < settings.apiKey.length; i++) {
      const code = settings.apiKey.charCodeAt(i) ^ _k.charCodeAt(i % _k.length);
      hex += code.toString(16).padStart(2, '0');
    }
    shareOut.value = window.location.origin + window.location.pathname + '?k=' + hex;
    shareOut.style.display = '';
    shareOut.select();
  });
  shareOut.addEventListener('click', () => shareOut.select());

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

  // Voice input (SpeechRecognition)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;

  if (SpeechRecognition && elements.micBtn) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      elements.chatTextarea.value = transcript;
      handleTextareaAutoGrow();
    };

    recognition.onend = () => {
      isListening = false;
      elements.micBtn.classList.remove('recording');
      lucide.createIcons();
    };

    recognition.onerror = () => {
      isListening = false;
      elements.micBtn.classList.remove('recording');
    };

    elements.micBtn.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
        return;
      }
      try {
        recognition.start();
        isListening = true;
        elements.micBtn.classList.add('recording');
        elements.chatTextarea.focus();
      } catch {}
    });
  } else if (elements.micBtn) {
    elements.micBtn.classList.add('hidden');
  }

  window.addEventListener('resize', adjustResponsiveLayout);
}

function toggleShareLink() {
  const group = document.getElementById('share-link-group');
  const out = document.getElementById('share-link-out');
  if (settings.apiKey) {
    group.style.display = '';
  } else {
    group.style.display = 'none';
    out.style.display = 'none';
  }
}

// Bind initialization
window.addEventListener('DOMContentLoaded', init);
