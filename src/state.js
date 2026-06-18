// State management with centralized store and persistence
class StateStore {
  constructor() {
    this.state = {
      chats: [],
      currentChatId: null,
      settings: {
        proxyUrl: 'https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/',
        apiKey: '',
        modelName: 'mistral-small-latest',
        useMaxTurns: false,
        maxTurns: 5,
        currentPersona: 'general',
        customSystemPrompt: ''
      },
      isGenerating: false,
      abortController: null
    };
    this.listeners = [];
    this.loadFromStorage();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach(callback => callback(this.state));
  }

  getState() {
    return { ...this.state };
  }

  updateState(newState) {
    this.state = { ...this.state, ...newState };
    this.saveToStorage();
    this.notify();
  }

  loadFromStorage() {
    try {
      const savedSettings = localStorage.getItem('opencode_settings');
      const savedChats = localStorage.getItem('opencode_chats');
      const savedCurrentChatId = localStorage.getItem('opencode_current_chat_id');
      const savedTurnsMigrated = localStorage.getItem('opencode_settings_turns_migrated');

      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        this.state.settings = { ...this.state.settings, ...parsedSettings };
        
        if (this.state.settings.proxyUrl === 'http://localhost:8080/v1/chat/completions') {
          this.state.settings.proxyUrl = 'https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/';
        }
        
        if (!savedTurnsMigrated) {
          this.state.settings.useMaxTurns = false;
          localStorage.setItem('opencode_settings_turns_migrated', 'true');
          this.saveToStorage();
        }
      }

      if (savedChats) {
        this.state.chats = JSON.parse(savedChats);
      }

      if (savedCurrentChatId) {
        this.state.currentChatId = savedCurrentChatId;
      }
    } catch (e) {
      console.error("Failed to load state from storage", e);
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem('opencode_settings', JSON.stringify(this.state.settings));
      localStorage.setItem('opencode_chats', JSON.stringify(this.state.chats));
      if (this.state.currentChatId) {
        localStorage.setItem('opencode_current_chat_id', this.state.currentChatId);
      }
    } catch (e) {
      console.error("Failed to save state to storage", e);
    }
  }

  getActiveChat() {
    return this.state.chats.find(c => c.id === this.state.currentChatId);
  }

  getMessageCountWithoutSystem(chat) {
    if (!chat) return 0;
    return chat.messages.filter(m => m.role !== 'system').length;
  }
}

export default new StateStore();