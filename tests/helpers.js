const path = require('path');

const INDEX = 'file://' + path.resolve('index.html').replace(/\\/g, '/');

async function mockCdn(page) {
  await page.route('**/cdn.jsdelivr.net/**', async (route) => {
    const url = route.request().url();
    if (url.includes('marked')) {
      return route.fulfill({
        contentType: 'application/javascript',
        body: 'window.marked = { parse: (t) => t };',
      });
    }
    if (url.includes('katex')) {
      if (url.endsWith('.css')) {
        return route.fulfill({ contentType: 'text/css', body: '' });
      }
      return route.fulfill({
        contentType: 'application/javascript',
        body: 'window.katex = {}; window.renderMathInElement = () => {};',
      });
    }
    return route.fulfill({ contentType: 'application/javascript', body: '' });
  });

  await page.route('**/cdnjs.cloudflare.com/**', async (route) => {
    if (route.request().url().endsWith('.css')) {
      return route.fulfill({ contentType: 'text/css', body: '' });
    }
    return route.fulfill({
      contentType: 'application/javascript',
      body: 'window.Prism = { highlightAllUnder: () => {}, highlightElement: () => {} };',
    });
  });

  await page.route('**/unpkg.com/lucide**', async (route) => {
    return route.fulfill({
      contentType: 'application/javascript',
      body: 'window.lucide = { createIcons: () => {} };',
    });
  });

  await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
  await page.route('**/fonts.gstatic.com/**', (route) => route.abort());
  await page.route('**/googleapis.com/**', (route) => route.abort());
}

async function clearStorage(page) {
  await page.addInitScript(() => localStorage.clear());
}

async function seedSettings(page, overrides = {}) {
  const defaults = {
    proxyUrl: 'https://api.mistral.ai/v1/chat/completions',
    fetchUrl: '',
    apiKey: '',
    injectedKey: false,
    modelName: 'mistral-small-latest',
    useMaxTurns: false,
    maxTurns: 5,
    currentPersona: 'general',
    customSystemPrompt: '',
  };
  await page.addInitScript((data) => {
    localStorage.setItem('opencode_settings', JSON.stringify(data));
  }, { ...defaults, ...overrides });
}

async function seedChat(page, overrides = {}) {
  const chatId = 'chat_test_' + Date.now();
  const chat = {
    id: chatId,
    title: 'Test Chat',
    persona: 'general',
    systemPrompt: 'You are a helpful assistant.',
    messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
    turnCount: 0,
    ...overrides,
  };
  await page.addInitScript((d) => {
    localStorage.setItem('opencode_chats', JSON.stringify([d.chat]));
    localStorage.setItem('opencode_current_chat_id', d.chatId);
  }, { chat, chatId });
}

async function mockFetchProxy(page, responses = {}) {
  await page.route('**/airgap-fetch.gitub.workers.dev/**', async (route) => {
    const url = route.request().url();
    const target = new URL(url).searchParams.get('url') || '';
    const handler = responses[target];
    if (handler) return handler(route);
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 200, content: '<html>mock</html>', url: target }),
    });
  });
}

async function mockFetchProxyRaw(page, responses = {}) {
  await page.route('**/airgap-fetch.gitub.workers.dev/**', async (route) => {
    const url = route.request().url();
    const target = new URL(url).searchParams.get('url') || '';
    const handler = responses[target];
    if (handler) return handler(route);
    return route.fulfill({
      contentType: 'text/html',
      body: '<html>mock raw proxy</html>',
    });
  });
}

module.exports = { INDEX, mockCdn, clearStorage, seedSettings, seedChat, mockFetchProxy, mockFetchProxyRaw };
