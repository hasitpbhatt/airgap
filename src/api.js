// API communication layer with error handling and retry logic
import state from './state.js';

class APIService {
  constructor() {
    this.proxyUrl = state.getState().settings.proxyUrl;
    this.apiKey = state.getState().settings.apiKey;
    this.modelName = state.getState().settings.modelName;
    this.maxTurns = state.getState().settings.maxTurns;
    this.useMaxTurns = state.getState().settings.useMaxTurns;
    
    state.subscribe(this.updateFromState.bind(this));
  }

  updateFromState(newState) {
    this.proxyUrl = newState.settings.proxyUrl;
    this.apiKey = newState.settings.apiKey;
    this.modelName = newState.settings.modelName;
    this.maxTurns = newState.settings.maxTurns;
    this.useMaxTurns = newState.settings.useMaxTurns;
  }

  getInitialProxyUrl() {
    if (typeof MISTRAL_PROXY_URL !== 'undefined' && MISTRAL_PROXY_URL) {
      return MISTRAL_PROXY_URL;
    }
    return 'https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/';
  }

  async sendMessage(messages, abortController) {
    const activeChat = state.getActiveChat();
    
    if (!activeChat) {
      throw new Error('No active chat');
    }

    if (this.useMaxTurns && activeChat.turnCount >= this.maxTurns) {
      throw new Error('Turn limit reached');
    }

    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: this.modelName || 'mistral-small-latest',
        messages: messages
      }),
      signal: abortController.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || data.content || '';

    if (!content) {
      throw new Error('Received an empty response from the server.');
    }

    return content;
  }

  async retryMessage(messages, abortController) {
    return this.sendMessage(messages, abortController);
  }
}

export default new APIService();