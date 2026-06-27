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

  // URL param injection: ?k=<obfuscated> — sets API key (+ optional proxyUrl, modelName)
  const urlParams = new URLSearchParams(window.location.search);
  const obfParam = urlParams.get('k');
  if (obfParam) {
    try {
      const dec = xorHexDecode(obfParam);
      let parsed = null;
      try { parsed = JSON.parse(dec); } catch {}
      if (parsed && parsed.k && (parsed.k.startsWith('sk-') || parsed.k.startsWith('gsk_'))) {
        settings.apiKey = parsed.k;
        settings.injectedKey = true;
        if (parsed.u) settings.proxyUrl = parsed.u;
        if (parsed.m) settings.modelName = parsed.m;
        saveSettings();
      } else if (dec.startsWith('sk-') || dec.startsWith('gsk_')) {
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
  if (elements.backupFetchUrlInput) elements.backupFetchUrlInput.value = settings.backupFetchUrl;
  if (settings.injectedKey) {
    elements.apiKeyInput.placeholder = 'Key set from URL';
  }
  if (settings.apiKey) {
    elements.apiKeyInput.value = settings.apiKey;
  }
  toggleShareLink();

  // GitHub token is session-only — always start empty
  githubToken = '';
  if (elements.githubTokenInput) elements.githubTokenInput.value = '';

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
  const connectLocalBtn = document.getElementById('connect-local-btn');
  if (connectLocalBtn) {
    connectLocalBtn.addEventListener('click', function() {
      settings.engine = 'local';
      saveSettings();
      hideConnectScreen();
      elements.engineSelect.value = 'local';
      updateLocalEngineUI('local');
      updateLocalStatusText();
    });
  }
  if (settings.engine !== 'local' && !settings.apiKey && !settings.injectedKey) {
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
  elements.enableToolLoopsLimitCheckbox.checked = settings.useMaxToolLoops;
  elements.maxToolLoopsInput.value = settings.maxToolLoops;
  elements.maxToolLoopsInput.disabled = !settings.useMaxToolLoops;
  elements.personaSelect.value = settings.currentPersona;

  if (settings.currentPersona === 'custom') {
    elements.systemPromptTextarea.value = settings.customSystemPrompt || '';
  } else {
    elements.systemPromptTextarea.value = PERSONAS[settings.currentPersona]?.system || '';
    elements.systemPromptTextarea.disabled = true;
  }

  // TTS settings
  elements.ttsEnabledCheckbox.checked = settings.ttsEnabled;
  elements.ttsModelInput.value = settings.ttsModelName || 'voxtral-mini-tts-2603';
  elements.ttsRateInput.value = settings.ttsRate || 1.0;
  elements.ttsRateValue.textContent = settings.ttsRate || 1.0;
  elements.ttsPitchInput.value = settings.ttsPitch || 1.0;
  elements.ttsPitchValue.textContent = settings.ttsPitch || 1.0;
  if (elements.ttsProxyUrlInput) elements.ttsProxyUrlInput.value = settings.ttsProxyUrl || '';
  elements.ttsVoiceInput.value = settings.ttsVoice || '';

  // Local Engine
  elements.engineSelect.value = settings.engine || 'remote';
  elements.localModelSelect.value = settings.localModelName || 'qwen2.5-0.5b';
  updateLocalEngineUI(settings.engine);

  // If local engine is set, hide connect overlay and show local settings
  if (settings.engine === 'local') {
    const connectOverlay = document.getElementById('connect-overlay');
    if (connectOverlay && connectOverlay.style.display !== 'none') {
      connectOverlay.style.display = 'none';
    }
  }

  // Listen for local engine auto-init events (dispatched by local-engine.js boot sequence)
  window.addEventListener('local-engine-loading', function() {
    updateLocalStatusText();
    elements.modelProgressContainer.style.display = 'block';
    elements.modelProgressBar.value = 0;
    elements.modelProgressText.textContent = 'Restoring model from cache...';
    elements.modelProgressPct.textContent = '0%';
    elements.downloadModelBtn.disabled = true;
  });

  window.addEventListener('local-engine-progress', function(e) {
    var report = e.detail;
    if (!report) return;
    if (report.progress !== undefined) {
      var pct = Math.round(report.progress * 100);
      elements.modelProgressBar.value = pct;
      elements.modelProgressPct.textContent = pct + '%';
    }
    if (report.text) {
      elements.modelProgressText.textContent = report.text;
    }
  });

  window.addEventListener('local-engine-ready', function() {
    elements.modelProgressContainer.style.display = 'none';
    elements.downloadModelBtn.disabled = false;
    updateLocalStatusText();
    showToast('Local model restored from cache', 'success');
  });

  window.addEventListener('local-engine-error', function(e) {
    elements.modelProgressContainer.style.display = 'none';
    elements.downloadModelBtn.disabled = false;
    updateLocalStatusText();
    showToast('Failed to restore local model: ' + ((e.detail && e.detail.message) || e.detail || 'Unknown error'), 'error');
  });

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
  renderCustomToolsList();
  setupAutoScroll();
  setupEventListeners();
  adjustResponsiveLayout();
}

// ── Local Engine UI Helpers ─────────────────────────────────────────────────
function updateLocalEngineUI(engine) {
  const isLocal = engine === 'local';
  if (isLocal && !window.__localEngine) {
    showToast('Local engine not available when loaded via file:// protocol. Use a local HTTP server (e.g., python3 -m http.server 8080) to test the local engine.', 'error');
  }
  elements.localSettingsGroup.style.display = isLocal ? 'block' : 'none';
  elements.remoteSettingsGroup.style.display = isLocal ? 'none' : 'block';
  elements.engineBadge.style.display = isLocal ? 'inline' : 'none';

  // Update model select in header
  if (isLocal) {
    elements.modelSelect.style.display = 'none';
    elements.customModelGroup.style.display = 'none';
  } else {
    elements.modelSelect.style.display = '';
    const isPreset = ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest', 'codestral-latest'].includes(settings.modelName);
    if (isPreset) {
      elements.modelSelect.value = settings.modelName;
      elements.customModelGroup.style.display = 'none';
    } else {
      elements.modelSelect.value = 'custom';
      elements.customModelGroup.style.display = 'inline-flex';
    }
  }

  // Hide connect overlay when local
  const connectOverlay = document.getElementById('connect-overlay');
  if (isLocal && connectOverlay && connectOverlay.style.display !== 'none') {
    connectOverlay.style.display = 'none';
  }
  // Show connect overlay when remote and no key
  if (!isLocal && connectOverlay && !settings.apiKey && !settings.injectedKey) {
    connectOverlay.style.display = 'flex';
  }

  updateInputUIState();
}

function updateLocalModelSizeDisplay() {
  const modelKey = elements.localModelSelect.value;
  const config = window.__localEngine?.LOCAL_MODELS_CONFIG?.[modelKey];
  if (config) {
    elements.localModelSize.textContent = config.size + ' RAM · ' + config.context.toLocaleString() + ' ctx';
  }
}

function updateLocalStatusText() {
  if (window.__localEngine?.isLoaded()) {
    elements.localStatusText.textContent = 'Model loaded: ' + (window.__localEngine.getLoadedModelKey() || 'unknown');
    elements.downloadModelBtn.style.display = 'none';
    elements.unloadModelBtn.style.display = 'block';
  } else if (window.__localEngine?.getIsModelLoading()) {
    elements.localStatusText.textContent = 'Loading model...';
    elements.downloadModelBtn.style.display = 'none';
    elements.unloadModelBtn.style.display = 'none';
  } else {
    elements.localStatusText.textContent = 'Model not loaded. Click "Download & Load" to start.';
    elements.downloadModelBtn.style.display = 'block';
    elements.unloadModelBtn.style.display = 'none';
  }
}

// Settings Event Listeners & Binding
function setupEventListeners() {
  // Config toggle expand/collapse
  elements.settingsTrigger.addEventListener('click', () => {
    const isOpen = elements.settingsPanel.classList.toggle('open');
    elements.settingsChevron.setAttribute('data-lucide', isOpen ? 'chevron-down' : 'chevron-up');
    lucide.createIcons();
    if (isOpen) renderCustomToolsList();
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
    elements.clearMemoryBtn.addEventListener('click', async () => {
      const keys = globalStoreListKeys();
      if (keys.length === 0) return;
      if (await showConfirm('Delete all ' + keys.length + ' memories? This cannot be undone.')) {
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
  if (elements.backupFetchUrlInput) {
    elements.backupFetchUrlInput.addEventListener('input', (e) => {
      settings.backupFetchUrl = e.target.value.trim();
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

  if (elements.githubTokenInput) {
    elements.githubTokenInput.addEventListener('input', (e) => {
      githubToken = e.target.value.trim();
    });
  }

  const shareBtn = document.getElementById('gen-share-link');
  const shareOut = document.getElementById('share-link-out');
  shareBtn.addEventListener('click', () => {
    if (!settings.apiKey) return;
    const payload = JSON.stringify({
      k: settings.apiKey,
      m: settings.modelName || 'mistral-small-latest',
      u: settings.proxyUrl
    });
    const hex = xorHexEncode(payload);
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
    settings.maxTurns = Math.max(1, parseInt(e.target.value) || 5);
    saveSettings();
    updateInputUIState();
  });
  elements.enableToolLoopsLimitCheckbox.addEventListener('change', (e) => {
    settings.useMaxToolLoops = e.target.checked;
    elements.maxToolLoopsInput.disabled = !settings.useMaxToolLoops;
    saveSettings();
  });
  elements.maxToolLoopsInput.addEventListener('input', (e) => {
    settings.maxToolLoops = Math.max(1, parseInt(e.target.value) || 5);
    saveSettings();
  });

  // Persona Selector binding
  elements.personaSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    settings.currentPersona = val;

    if (val === 'custom') {
      elements.systemPromptTextarea.value = settings.customSystemPrompt || '';
      elements.systemPromptTextarea.disabled = false;
    } else {
      elements.systemPromptTextarea.value = PERSONAS[val]?.system || '';
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

  // Export dropdown
  const exportDropdown = document.getElementById('export-dropdown');
  const exportDropBtn = document.getElementById('export-drop-btn');
  elements.exportChatBtn.addEventListener('click', () => exportCurrentChat('json'));
  exportDropBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdown.style.display = exportDropdown.style.display === 'block' ? 'none' : 'block';
  });
  document.addEventListener('click', () => { exportDropdown.style.display = 'none'; });
  exportDropdown.querySelectorAll('.export-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportCurrentChat(btn.dataset.format);
      exportDropdown.style.display = 'none';
    });
  });

  // Chat Input logic
  elements.chatTextarea.addEventListener('input', function () {
    handleTextareaAutoGrow();
    handleSlashInput();
  });
  elements.chatTextarea.addEventListener('keydown', function (e) {
    if (slashMenuVisible) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = document.querySelectorAll('.slash-item');
        if (!items.length) return;
        if (e.key === 'ArrowDown') slashHighlightIndex = (slashHighlightIndex + 1) % items.length;
        else slashHighlightIndex = (slashHighlightIndex - 1 + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle('highlighted', i === slashHighlightIndex));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const items = document.querySelectorAll('.slash-item');
        const highlighted = items[slashHighlightIndex];
        if (highlighted) {
          const command = highlighted.dataset.command;
          hideSlashMenu();
          elements.chatTextarea.value = '/' + command;
          triggerSend();
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        hideSlashMenu();
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      triggerSend();
    }
  });
  elements.sendBtn.addEventListener('click', triggerSend);
  elements.stopGenBtn.addEventListener('click', stopGenerating);
  elements.continueGenBtn.addEventListener('click', () => {
    triggerSendAPI();
  });

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

  // ── TTS Settings ───────────────────────────────────────────────────────
  elements.ttsEnabledCheckbox.addEventListener('change', function (e) {
    settings.ttsEnabled = e.target.checked;
    saveSettings();
  });

  elements.ttsModelInput.addEventListener('input', function (e) {
    settings.ttsModelName = e.target.value.trim();
    saveSettings();
  });

  if (elements.ttsProxyUrlInput) {
    elements.ttsProxyUrlInput.addEventListener('input', function (e) {
      settings.ttsProxyUrl = e.target.value.trim();
      saveSettings();
    });
  }

  elements.ttsRateInput.addEventListener('input', function (e) {
    var val = parseFloat(e.target.value);
    settings.ttsRate = val;
    elements.ttsRateValue.textContent = val.toFixed(1);
    saveSettings();
  });

  elements.ttsPitchInput.addEventListener('input', function (e) {
    var val = parseFloat(e.target.value);
    settings.ttsPitch = val;
    elements.ttsPitchValue.textContent = val.toFixed(1);
    saveSettings();
  });

  elements.ttsVoiceInput.addEventListener('input', function (e) {
    settings.ttsVoice = e.target.value;
    saveSettings();
  });

  // Populate voice datalist when settings panel opens
  elements.settingsTrigger.addEventListener('click', function populateVoices() {
    getAvailableVoices().then(function (voices) {
      var list = document.getElementById('tts-voice-list');
      list.innerHTML = voices.map(function (v) {
        return '<option value="' + v.name + '">' + v.name + ' (' + v.lang + ')</option>';
      }).join('');
    });
    elements.settingsTrigger.removeEventListener('click', populateVoices);
  });

  elements.engineSelect.addEventListener('change', function(e) {
    settings.engine = e.target.value;
    saveSettings();
    updateLocalEngineUI(settings.engine);
    updateLocalStatusText();
  });

  elements.localModelSelect.addEventListener('change', function(e) {
    settings.localModelName = e.target.value;
    saveSettings();
    updateLocalModelSizeDisplay();
  });

  elements.downloadModelBtn.addEventListener('click', async function() {
    if (!window.__localEngine) {
      showToast('Local engine not available. Open this page via HTTP (not file://) to enable the local engine.', 'error');
      return;
    }

    const modelKey = elements.localModelSelect.value;
    const config = window.__localEngine.LOCAL_MODELS_CONFIG[modelKey];
    if (!config) return;

    elements.downloadModelBtn.disabled = true;
    elements.modelProgressContainer.style.display = 'block';
    elements.modelProgressBar.value = 0;
    elements.modelProgressText.textContent = 'Starting download...';
    elements.modelProgressPct.textContent = '0%';

    settings.localModelName = modelKey;
    settings.localModelLoaded = false;
    settings.localModelLoading = true;
    saveSettings();
    updateLocalStatusText();

    try {
      await window.__localEngine.loadModel(modelKey, function(progress) {
        const pct = Math.round((progress.progress || 0) * 100);
        elements.modelProgressBar.value = pct;
        elements.modelProgressPct.textContent = pct + '%';
        elements.modelProgressText.textContent = progress.text || progress.phase || 'Downloading...';
      });

      settings.localModelLoaded = true;
      settings.localModelLoading = false;
      saveSettings();
      updateLocalStatusText();
      showToast('Model loaded successfully', 'success');
    } catch (err) {
      settings.localModelLoaded = false;
      settings.localModelLoading = false;
      saveSettings();
      updateLocalStatusText();
      showToast('Failed to load model: ' + err.message, 'error');
      console.error('Model load error:', err);
    } finally {
      elements.downloadModelBtn.disabled = false;
      elements.modelProgressContainer.style.display = 'none';
    }
  });

  elements.unloadModelBtn.addEventListener('click', async function() {
    if (!window.__localEngine) return;

    try {
      await window.__localEngine.unloadModel();
      settings.localModelLoaded = false;
      settings.localModelLoading = false;
      saveSettings();
      updateLocalStatusText();
      showToast('Model unloaded', 'success');
    } catch (err) {
      showToast('Failed to unload model: ' + err.message, 'error');
    }
  });

  // Initial UI state
  updateLocalModelSizeDisplay();
  updateLocalStatusText();

  // ── Custom Tools ───────────────────────────────────────────────────────
  elements.addCustomToolBtn.addEventListener('click', function() {
    showCustomToolEditor();
  });

  // ── Global Chat Search ──────────────────────────────────────────────────
  const globalSearchInput = elements.chatSearchGlobalInput;
  let globalSearchTimer = null;
  globalSearchInput.addEventListener('input', function() {
    clearTimeout(globalSearchTimer);
    globalSearchTimer = setTimeout(() => performGlobalChatSearch(this.value), 200);
  });
  globalSearchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      clearGlobalChatSearch();
      this.blur();
    }
  });
  elements.chatSearchGlobalClear.addEventListener('click', function() {
    clearGlobalChatSearch();
    globalSearchInput.focus();
  });

  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
      e.preventDefault();
      globalSearchInput.focus();
      globalSearchInput.select();
    }
    if (e.key === 'Escape' && document.activeElement === globalSearchInput) {
      clearGlobalChatSearch();
      globalSearchInput.blur();
    }
  });

  // ── File Attachment Events ──────────────────────────────────────────────
  elements.attachFileBtn.addEventListener('click', function() {
    elements.fileInput.click();
  });

  elements.fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) handleFileAttach(file);
    e.target.value = '';
  });

  elements.fileChipRemove.addEventListener('click', function() {
    clearPendingAttachmentUI();
  });

  elements.chatTextarea.addEventListener('paste', function(e) {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleFileAttach(file);
        }
        return;
      }
    }
  });

  // Drag-and-drop on the feed container
  const feedArea = elements.chatFeedContainer;
  let dragCounter = 0;

  feedArea.addEventListener('dragenter', function(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (dragCounter === 1) {
      elements.dropOverlay.style.display = 'flex';
    }
  });

  feedArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
  });

  feedArea.addEventListener('dragleave', function(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      elements.dropOverlay.style.display = 'none';
    }
  });

  feedArea.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    elements.dropOverlay.style.display = 'none';
    const file = e.dataTransfer.files[0];
    if (file) handleFileAttach(file);
  });

  document.addEventListener('click', (e) => {
    // Dismiss global search when clicking outside
    if (!e.target.closest('.chat-search-global')) {
      clearGlobalChatSearch();
    }

    // Slash menu item click
    const slashItem = e.target.closest('.slash-item');
    if (slashItem) {
      const command = slashItem.dataset.command;
      if (command) {
        hideSlashMenu();
        elements.chatTextarea.value = '/' + command;
        triggerSend();
      }
      return;
    }

    // Dismiss slash menu on outside click (don't return - let other handlers run)
    if (slashMenuVisible) {
      const menu = elements.slashMenu;
      const textarea = elements.chatTextarea;
      if (!menu.contains(e.target) && e.target !== textarea && !textarea.contains(e.target)) {
        hideSlashMenu();
      }
    }
    const clipBtn = e.target.closest('.btn-clipboard-copy');
    if (clipBtn) {
      const clipId = clipBtn.dataset.clipId;
      const entry = pendingClipboard.find(d => d.clipId === clipId);
      if (entry) {
        navigator.clipboard.writeText(entry.text).then(function () {
          clipBtn.innerHTML = '<i data-lucide="check" style="width: 12px; height: 12px;"></i> Copied!';
          lucide.createIcons();
        }).catch(function () {
          clipBtn.innerHTML = '<i data-lucide="x" style="width: 12px; height: 12px;"></i> Failed';
          lucide.createIcons();
        });
      }
      return;
    }

    const btn = e.target.closest('.btn-download-file');
    if (!btn) return;
    const fileId = btn.dataset.fileId;
    const entry = pendingDownloads.find(d => d.fileId === fileId);
    if (!entry) return;
    const blob = new Blob([entry.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = entry.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });

  // Keyboard Shortcuts Modal
  const shortcutsOverlay = document.getElementById('shortcuts-overlay');
  const shortcutsCloseBtn = document.getElementById('shortcuts-close-btn');

  function openShortcuts() { shortcutsOverlay.style.display = 'flex'; }
  function closeShortcuts() { shortcutsOverlay.style.display = 'none'; }
  window.openShortcuts = openShortcuts;
  window.closeShortcuts = closeShortcuts;

  shortcutsCloseBtn.addEventListener('click', closeShortcuts);
  shortcutsOverlay.addEventListener('click', (e) => {
    if (e.target === shortcutsOverlay) closeShortcuts();
  });

  // ── About Modal ─────────────────────────────────────────────────────
  const aboutOverlay = document.getElementById('about-overlay');
  const aboutCloseBtn = document.getElementById('about-close-btn');
  const aboutTrigger = document.getElementById('about-trigger');

  function openAbout() { aboutOverlay.style.display = 'flex'; }
  function closeAbout() { aboutOverlay.style.display = 'none'; }
  window.openAbout = openAbout;
  window.closeAbout = closeAbout;

  aboutTrigger.addEventListener('click', openAbout);
  aboutCloseBtn.addEventListener('click', closeAbout);
  aboutOverlay.addEventListener('click', (e) => {
    if (e.target === aboutOverlay) closeAbout();
  });

  // ── Keyboard Shortcuts Modal (continued) ────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && document.activeElement !== elements.chatTextarea) {
      e.preventDefault();
      shortcutsOverlay.style.display === 'flex' ? closeShortcuts() : openShortcuts();
    }
    if (e.key === 'Escape' && shortcutsOverlay.style.display === 'flex') {
      closeShortcuts();
    }
    if (e.key === 'Escape' && aboutOverlay.style.display === 'flex') {
      closeAbout();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      createNewChat();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      toggleSidebar();
    }
    // Ctrl+F / Cmd+F — toggle search bar
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      e.stopPropagation();
      toggleChatSearch();
    }
    // Escape — close search bar
    if (e.key === 'Escape' && chatSearchState.visible) {
      e.preventDefault();
      clearChatSearch();
      elements.chatTextarea.focus();
    }
  });

  // ── Chat Search Events ────────────────────────────────────────────────
  elements.searchChatBtn.addEventListener('click', toggleChatSearch);

  let searchDebounceTimer = null;
  elements.chatSearchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(performChatSearch, 200);
  });

  elements.chatSearchPrev.addEventListener('click', () => navigateChatSearch(-1));
  elements.chatSearchNext.addEventListener('click', () => navigateChatSearch(1));
  elements.chatSearchClose.addEventListener('click', () => {
    clearChatSearch();
    elements.chatTextarea.focus();
  });

  // Close on blur with delay to allow click on nav buttons
  elements.chatSearchInput.addEventListener('blur', () => {
    setTimeout(() => {
      if (chatSearchState.visible && !elements.chatSearchBar.contains(document.activeElement)) {
        // keep bar open, just let user click nav buttons
      }
    }, 150);
  });

  window.addEventListener('resize', adjustResponsiveLayout);
}

function toggleChatSearch() {
  if (chatSearchState.visible) {
    clearChatSearch();
    elements.chatTextarea.focus();
  } else {
    chatSearchState.visible = true;
    elements.chatSearchBar.style.display = 'flex';
    elements.chatSearchInput.value = '';
    elements.chatSearchCounter.textContent = '';
    elements.chatSearchInput.focus();
    performChatSearch();
  }
}

// Slash command menu state
const slashCommands = [
  { command: 'compact', icon: 'file-text', label: '/compact', desc: 'Compress conversation history' },
  { command: 'clear', icon: 'trash-2', label: '/clear', desc: 'Clear current conversation' },
  { command: 'new', icon: 'plus-square', label: '/new', desc: 'New conversation' },
  { command: 'export', icon: 'download', label: '/export', desc: 'Export conversation (json|md|txt)' },
  { command: 'persona', icon: 'user-check', label: '/persona', desc: 'Switch persona (general|child|deep|first-principles|socratic)' }
];
let slashMenuVisible = false;
let slashHighlightIndex = 0;

function handleSlashInput() {
  const text = elements.chatTextarea.value;
  if (text === '/') {
    showSlashMenu('');
  } else if (text.startsWith('/') && !text.includes(' ')) {
    showSlashMenu(text.slice(1));
  } else {
    hideSlashMenu();
  }
}

function showSlashMenu(filter) {
  if (isGenerating) return;
  slashMenuVisible = true;
  slashHighlightIndex = 0;
  renderSlashMenu(filter);
  elements.slashMenu.style.display = 'block';
}

function hideSlashMenu() {
  slashMenuVisible = false;
  elements.slashMenu.style.display = 'none';
}

function renderSlashMenu(filter) {
  const lower = filter.toLowerCase();
  const filtered = slashCommands.filter(c => c.command.startsWith(lower));
  if (!filtered.length) {
    hideSlashMenu();
    return;
  }
  elements.slashMenu.innerHTML = filtered.map((c, i) =>
    `<div class="slash-item${i === 0 ? ' highlighted' : ''}" data-command="${c.command}">
      <div class="slash-item-icon"><i data-lucide="${c.icon}" style="width:14px;height:14px;"></i></div>
      <span class="slash-item-label">${c.label}</span>
      <span class="slash-item-desc">${c.desc}</span>
    </div>`
  ).join('');
  lucide.createIcons();
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
