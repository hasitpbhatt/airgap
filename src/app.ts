// Main application entry point with TypeScript
import state from './state.js';
import api from './api.js';
import ui from './ui.js';
import { PERSONAS, escapeHtml } from './utils.js';

// Initialize the application
function init(): void {
  // Setup default proxy
  state.updateState({
    settings: { ...state.getState().settings, proxyUrl: api.getInitialProxyUrl() }
  });

  // Bind settings to UI
  ui.elements.proxyUrlInput.value = state.getState().settings.proxyUrl;
  ui.elements.apiKeyInput.value = state.getState().settings.apiKey;

  // Bind Model Selection presets
  const MODEL_PRESETS = ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest', 'codestral-latest'];
  const isPreset = MODEL_PRESETS.includes(state.getState().settings.modelName);
  if (isPreset) {
    ui.elements.modelSelect.value = state.getState().settings.modelName;
    ui.elements.customModelGroup.style.display = 'none';
    ui.elements.modelNameInput.value = state.getState().settings.modelName;
  } else {
    ui.elements.modelSelect.value = 'custom';
    ui.elements.customModelGroup.style.display = 'inline-flex';
    ui.elements.modelNameInput.value = state.getState().settings.modelName || '';
  }

  ui.elements.enableTurnsLimitCheckbox.checked = state.getState().settings.useMaxTurns;
  ui.elements.maxTurnsInput.value = state.getState().settings.maxTurns;
  ui.elements.maxTurnsInput.disabled = !state.getState().settings.useMaxTurns;
  ui.elements.personaSelect.value = state.getState().settings.currentPersona;

  if (state.getState().settings.currentPersona === 'custom') {
    ui.elements.systemPromptTextarea.value = state.getState().settings.customSystemPrompt || '';
  } else {
    ui.elements.systemPromptTextarea.value = PERSONAS[state.getState().settings.currentPersona as keyof typeof PERSONAS].system;
    ui.elements.systemPromptTextarea.disabled = true;
  }

  // Load chats
  const savedChats = localStorage.getItem('opencode_chats');
  if (savedChats) {
    try {
      state.updateState({ chats: JSON.parse(savedChats) });
    } catch (e) {
      console.error("Failed to load chats", e);
      state.updateState({ chats: [] });
    }
  }

  const currentChatId = localStorage.getItem('opencode_current_chat_id');
  if (state.getState().chats.length === 0) {
    ui.createNewChat();
  } else {
    const chatExists = state.getState().chats.find(c => c.id === currentChatId);
    if (!chatExists) {
      state.updateState({ currentChatId: state.getState().chats[0].id });
    }
    ui.selectChat(state.getState().currentChatId);
  }

  // Initialize icons
  lucide.createIcons();

  // Override saved proxyUrl if dynamic MISTRAL_PROXY_URL is injected by host/environment
  if (typeof MISTRAL_PROXY_URL !== 'undefined' && MISTRAL_PROXY_URL) {
    state.updateState({
      settings: { ...state.getState().settings, proxyUrl: MISTRAL_PROXY_URL }
    });
  }

  // Bind initialization
  window.addEventListener('DOMContentLoaded', () => {
    init();
  });
}

// Global functions for backward compatibility
window.selectPersonaForNewChat = (personaName: string) => {
  ui.selectPersonaForNewChat(personaName);
};

window.retryMessage = (errorIndex: number) => {
  ui.retryMessage(errorIndex);
};

window.copyMessageText = (button: HTMLElement, index: number) => {
  ui.copyMessageText(button, index);
};

window.editUserMessage = (index: number) => {
  ui.editUserMessage(index);
};

window.deleteMessage = (index: number) => {
  ui.deleteMessage(index);
};

window.copyCodeSnippet = (button: HTMLElement) => {
  ui.copyCodeSnippet(button);
};

export { init };