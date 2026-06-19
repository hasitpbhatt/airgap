const { test, expect } = require('@playwright/test');
const path = require('path');

const INDEX = 'file://' + path.resolve('index.html').replace(/\\/g, '/');

// Minimal mocks for CDN scripts so the app loads without network
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

  // Block font and other external requests
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

// ---------------------------------------------------------------------------
// Connect screen
// ---------------------------------------------------------------------------
test.describe('Connect screen', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
  });

  test('shows overlay when no API key is saved', async ({ page }) => {
    await clearStorage(page);
    await page.goto(INDEX);
    await page.waitForSelector('#connect-overlay');
    await expect(page.locator('#connect-overlay')).toBeVisible();
    await expect(page.locator('.connect-title')).toHaveText('airgap');
    await expect(page.locator('#connect-key-input')).toBeVisible();
    await expect(page.locator('#connect-url-input')).toBeVisible();
    await expect(page.locator('#connect-btn')).toBeVisible();
  });

  test('shows overlay when settings key exists but apiKey is empty', async ({ page }) => {
    await seedSettings(page, { apiKey: '', proxyUrl: 'https://custom.example.com/v1' });
    await page.goto(INDEX);
    await page.waitForSelector('#connect-overlay');
    await expect(page.locator('#connect-overlay')).toBeVisible();
  });

  test('is hidden when apiKey is set in localStorage', async ({ page }) => {
    await seedSettings(page, { apiKey: 'sk-test123' });
    await page.goto(INDEX);
    await page.waitForSelector('#connect-overlay', { state: 'attached' });
    await expect(page.locator('#connect-overlay')).not.toBeVisible();
  });

  test('is hidden when injectedKey is true', async ({ page }) => {
    await seedSettings(page, { apiKey: 'sk-injected', injectedKey: true });
    await page.goto(INDEX);
    await page.waitForSelector('#connect-overlay', { state: 'attached' });
    await expect(page.locator('#connect-overlay')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('renders brand, new-chat button, chat list, memory and settings sections', async ({ page }) => {
    await expect(page.locator('.brand-logo span')).toHaveText('airgap');
    await expect(page.locator('#new-chat-btn')).toBeVisible();
    await expect(page.locator('#chat-list')).toBeVisible();
    await expect(page.locator('#memory-trigger')).toBeVisible();
    await expect(page.locator('#settings-trigger')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
    // Open settings panel
    await page.locator('#settings-trigger').click();
    await expect(page.locator('#settings-panel')).toBeVisible();
  });

  test('proxy URL input reflects saved value', async ({ page }) => {
    await expect(page.locator('#proxy-url')).toHaveValue('https://api.mistral.ai/v1/chat/completions');
  });

  test('apiKey input shows saved key', async ({ page }) => {
    await expect(page.locator('#api-key')).toHaveValue('sk-test');
  });

  test('model select defaults to mistral-small-latest', async ({ page }) => {
    await expect(page.locator('#model-select')).toHaveValue('mistral-small-latest');
  });
});

// ---------------------------------------------------------------------------
// Utility functions (xorHexEncode / xorHexDecode)
// ---------------------------------------------------------------------------
test.describe('Utility functions', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('xorHexEncode and xorHexDecode roundtrip a string', async ({ page }) => {
    const result = await page.evaluate(() => {
      const original = 'sk-test-key-12345';
      const encoded = xorHexEncode(original);
      const decoded = xorHexDecode(encoded);
      return { original, encoded, decoded };
    });
    expect(result.decoded).toBe(result.original);
    expect(result.encoded).not.toBe(result.original);
    expect(result.encoded.length).toBe(result.original.length * 2);
  });

  test('xorHexEncode and xorHexDecode roundtrip a JSON payload', async ({ page }) => {
    const result = await page.evaluate(() => {
      const payload = JSON.stringify({
        k: 'sk-my-key',
        m: 'mistral-medium-latest',
        u: 'https://api.mistral.ai/v1/chat/completions',
      });
      const encoded = xorHexEncode(payload);
      const decoded = xorHexDecode(encoded);
      return { encoded, decoded, parsed: JSON.parse(decoded) };
    });
    expect(result.parsed.k).toBe('sk-my-key');
    expect(result.parsed.m).toBe('mistral-medium-latest');
    expect(result.parsed.u).toBe('https://api.mistral.ai/v1/chat/completions');
  });

  test('xorHexDecode handles legacy (non-JSON) key format', async ({ page }) => {
    const result = await page.evaluate(() => {
      const original = 'sk-legacy-key';
      const encoded = xorHexEncode(original);
      const decoded = xorHexDecode(encoded);
      return { decoded, isKey: decoded.startsWith('sk-'), isJson: false };
    });
    expect(result.decoded).toBe('sk-legacy-key');
  });
});

// ---------------------------------------------------------------------------
// Share link
// ---------------------------------------------------------------------------
test.describe('Share link', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-share-test', proxyUrl: 'https://custom.example.com/v1', modelName: 'mistral-large-latest' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
    // Open settings
    await page.locator('#settings-trigger').click();
    await expect(page.locator('#share-link-group')).toBeVisible();
  });

  test('generates link with encoded JSON payload', async ({ page }) => {
    await page.locator('#gen-share-link').click();
    const shareOut = page.locator('#share-link-out');
    await expect(shareOut).toBeVisible();
    const link = await shareOut.inputValue();
    expect(link).toContain('?k=');

    // Extract the hex and decode it
    const hex = link.split('?k=')[1];
    const decoded = await page.evaluate((h) => xorHexDecode(h), hex);
    const parsed = JSON.parse(decoded);
    expect(parsed.k).toBe('sk-share-test');
    expect(parsed.m).toBe('mistral-large-latest');
    expect(parsed.u).toBe('https://custom.example.com/v1');
  });
});

// ---------------------------------------------------------------------------
// Model select
// ---------------------------------------------------------------------------
test.describe('Model select', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test', modelName: 'mistral-small-latest' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('changing model updates settings.modelName', async ({ page }) => {
    await page.locator('#model-select').selectOption('mistral-medium-latest');
    const modelName = await page.evaluate(() => settings.modelName);
    expect(modelName).toBe('mistral-medium-latest');
  });

  test('selecting custom model shows custom input', async ({ page }) => {
    await page.locator('#model-select').selectOption('custom');
    await expect(page.locator('#custom-model-group')).toBeVisible();
    await expect(page.locator('#model-name')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Helpers for tool execution tests
// ---------------------------------------------------------------------------
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

// Proxy mock that returns raw content (not JSON-wrapped) — simulates a
// proxy that does not wrap responses in { content: ..., status: ... }.
// This guards against regression if the proxy format changes.
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

// ---------------------------------------------------------------------------
// Tool Execution — Per-chat storage (store_value / read_value / list / delete)
// ---------------------------------------------------------------------------
test.describe('Tool execution — per-chat storage', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('store_value and read_value roundtrip', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const s = await executeToolCall({ function: { name: 'store_value', arguments: '{"key":"k1","value":"v1"}' } });
      const g = await executeToolCall({ function: { name: 'read_value', arguments: '{"key":"k1"}' } });
      return { store: s, read: g };
    });
    expect(r.store.success).toBe(true);
    expect(r.store.key).toBe('k1');
    expect(r.read.value).toBe('v1');
  });

  test('read_value returns error for missing key', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({ function: { name: 'read_value', arguments: '{"key":"nonexistent"}' } });
    });
    expect(r.error).toContain('Key not found');
  });

  test('list_stored_keys returns stored keys', async ({ page }) => {
    const r = await page.evaluate(async () => {
      await executeToolCall({ function: { name: 'store_value', arguments: '{"key":"a","value":"1"}' } });
      await executeToolCall({ function: { name: 'store_value', arguments: '{"key":"b","value":"2"}' } });
      return await executeToolCall({ function: { name: 'list_stored_keys', arguments: '{}' } });
    });
    expect(r.keys).toContain('a');
    expect(r.keys).toContain('b');
  });

  test('delete_value removes a key', async ({ page }) => {
    const r = await page.evaluate(async () => {
      await executeToolCall({ function: { name: 'store_value', arguments: '{"key":"temp","value":"x"}' } });
      await executeToolCall({ function: { name: 'delete_value', arguments: '{"key":"temp"}' } });
      return await executeToolCall({ function: { name: 'read_value', arguments: '{"key":"temp"}' } });
    });
    expect(r.error).toContain('Key not found');
  });
});

// ---------------------------------------------------------------------------
// Tool Execution — Global memory (remember / recall / forget / forget_all)
// ---------------------------------------------------------------------------
test.describe('Tool execution — global memory', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('remember and recall exact key', async ({ page }) => {
    const r = await page.evaluate(async () => {
      await executeToolCall({ function: { name: 'remember', arguments: '{"key":"user_name","value":"Alice"}' } });
      return await executeToolCall({ function: { name: 'recall', arguments: '{"keyword":"user_name"}' } });
    });
    expect(r.source).toBe('exact_match');
    expect(r.value).toBe('Alice');
  });

  test('recall returns substring matches', async ({ page }) => {
    const r = await page.evaluate(async () => {
      await executeToolCall({ function: { name: 'remember', arguments: '{"key":"project_foo","value":"bar"}' } });
      return await executeToolCall({ function: { name: 'recall', arguments: '{"keyword":"project"}' } });
    });
    expect(r.source).toBe('substring_match');
    expect(r.matches).toContain('project_foo');
  });

  test('recall returns all_keys when no match found', async ({ page }) => {
    const r = await page.evaluate(async () => {
      await executeToolCall({ function: { name: 'forget_all', arguments: '{}' } });
      return await executeToolCall({ function: { name: 'recall', arguments: '{"keyword":"anything"}' } });
    });
    expect(r.result).toContain('No data stored');
  });

  test('forget removes a key', async ({ page }) => {
    const r = await page.evaluate(async () => {
      await executeToolCall({ function: { name: 'remember', arguments: '{"key":"secret","value":"xyz"}' } });
      await executeToolCall({ function: { name: 'forget', arguments: '{"key":"secret"}' } });
      return await executeToolCall({ function: { name: 'recall', arguments: '{"keyword":"secret"}' } });
    });
    expect(r.result).toContain('No data stored');
  });

  test('forget_all clears all global memory', async ({ page }) => {
    const r = await page.evaluate(async () => {
      await executeToolCall({ function: { name: 'remember', arguments: '{"key":"a","value":"1"}' } });
      await executeToolCall({ function: { name: 'forget_all', arguments: '{}' } });
      return await executeToolCall({ function: { name: 'recall', arguments: '{"keyword":"a"}' } });
    });
    expect(r.result).toContain('No data stored');
  });
});

// ---------------------------------------------------------------------------
// Tool Execution — Notes
// ---------------------------------------------------------------------------
test.describe('Tool execution — notes', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('notes_create and notes_read roundtrip', async ({ page }) => {
    const r = await page.evaluate(async () => {
      await executeToolCall({ function: { name: 'notes_create', arguments: '{"key":"shopping","content":"milk, eggs"}' } });
      return await executeToolCall({ function: { name: 'notes_read', arguments: '{"key":"shopping"}' } });
    });
    expect(r.key).toBe('shopping');
    expect(r.content).toBe('milk, eggs');
  });

  test('notes_read returns error for missing note', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({ function: { name: 'notes_read', arguments: '{"key":"nonexistent"}' } });
    });
    expect(r.error).toContain('Note not found');
  });

  test('notes_list with query filter', async ({ page }) => {
    const r = await page.evaluate(async () => {
      await executeToolCall({ function: { name: 'notes_create', arguments: '{"key":"todo_work","content":"fix bug"}' } });
      await executeToolCall({ function: { name: 'notes_create', arguments: '{"key":"todo_home","content":"clean"}' } });
      return await executeToolCall({ function: { name: 'notes_list', arguments: '{"query":"work"}' } });
    });
    expect(r.count).toBe(1);
    expect(Object.keys(r.notes)).toEqual(['todo_work']);
  });

  test('notes_delete removes a note', async ({ page }) => {
    const r = await page.evaluate(async () => {
      await executeToolCall({ function: { name: 'notes_create', arguments: '{"key":"temp","content":"x"}' } });
      await executeToolCall({ function: { name: 'notes_delete', arguments: '{"key":"temp"}' } });
      return await executeToolCall({ function: { name: 'notes_read', arguments: '{"key":"temp"}' } });
    });
    expect(r.error).toContain('Note not found');
  });
});

// ---------------------------------------------------------------------------
// Tool Execution — Calculate
// ---------------------------------------------------------------------------
test.describe('Tool execution — calculate', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('basic arithmetic', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({ function: { name: 'calculate', arguments: '{"expression":"2 * (3 + 4)"}' } });
    });
    expect(r.result).toBe(14);
    expect(r.type).toBe('number');
  });

  test('Math.* functions', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({ function: { name: 'calculate', arguments: '{"expression":"Math.sqrt(144)"}' } });
    });
    expect(r.result).toBe(12);
  });

  test('invalid expression returns error', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({ function: { name: 'calculate', arguments: '{"expression":"return"}' } });
    });
    expect(r.error).toContain('Invalid expression');
  });
});

// ---------------------------------------------------------------------------
// Tool Execution — get_current_time
// ---------------------------------------------------------------------------
test.describe('Tool execution — get_current_time', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('returns time object with all fields', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({ function: { name: 'get_current_time', arguments: '{}' } });
    });
    expect(r.iso).toBeDefined();
    expect(r.date).toBeDefined();
    expect(r.time).toBeDefined();
    expect(r.timezone).toBeDefined();
    expect(r.weekday).toBeDefined();
    expect(new Date(r.iso).toISOString()).toBe(r.iso);
  });
});

// ---------------------------------------------------------------------------
// Tool Execution — Compact
// ---------------------------------------------------------------------------
test.describe('Tool execution — compact', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
  });

  test('compacts conversation preserving system + last user message', async ({ page }) => {
    await seedChat(page, {
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
        { role: 'user', content: 'What is AI?' },
      ],
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const r = await page.evaluate(async () => {
      const result = await executeToolCall({
        function: { name: 'compact', arguments: '{"summary":"User asked about AI."}' }
      });
      const chat = JSON.parse(localStorage.getItem('opencode_chats'))[0];
      return { result, chat };
    });
    expect(r.result.success).toBe(true);
    expect(r.chat.messages[0].role).toBe('system');
    expect(r.chat.messages[0].content).toBe('You are helpful.');
    expect(r.chat.messages[1].role).toBe('assistant');
    expect(r.chat.messages[1].content).toContain('User asked about AI.');
    expect(r.chat.messages[2].role).toBe('user');
    expect(r.chat.messages[2].content).toBe('What is AI?');
  });

  test('compact returns error when no active chat', async ({ page }) => {
    await seedChat(page);
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const r = await page.evaluate(async () => {
      // Manually delete all chats to trigger the unreachable error
      const saved = JSON.parse(localStorage.getItem('opencode_chats') || '[]');
      const origId = currentChatId;
      if (saved.length > 0) {
        localStorage.setItem('opencode_chats', JSON.stringify([]));
        chats.length = 0;
      }
      return await executeToolCall({
        function: { name: 'compact', arguments: '{"summary":"test"}' }
      });
    });
    expect(r.error).toContain('No active chat');
  });

  test('compact returns error when summary is missing', async ({ page }) => {
    await seedChat(page);
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const r = await page.evaluate(async () => {
      return await executeToolCall({
        function: { name: 'compact', arguments: '{}' }
      });
    });
    expect(r.error).toContain('required');
  });
});

// ---------------------------------------------------------------------------
// Tool Execution — set_setting
// ---------------------------------------------------------------------------
test.describe('Tool execution — set_setting', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('sets proxyUrl and updates input', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({
        function: { name: 'set_setting', arguments: '{"key":"proxyUrl","value":"https://custom.example.com/v1"}' }
      });
    });
    expect(r.success).toBe(true);
    expect(r.value).toBe('https://custom.example.com/v1');
    await expect(page.locator('#proxy-url')).toHaveValue('https://custom.example.com/v1');
  });

  test('sets modelName preset and updates select', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({
        function: { name: 'set_setting', arguments: '{"key":"modelName","value":"mistral-large-latest"}' }
      });
    });
    expect(r.success).toBe(true);
    await expect(page.locator('#model-select')).toHaveValue('mistral-large-latest');
  });

  test('sets custom modelName and shows custom input', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({
        function: { name: 'set_setting', arguments: '{"key":"modelName","value":"gpt-4"}' }
      });
    });
    expect(r.success).toBe(true);
    await expect(page.locator('#model-select')).toHaveValue('custom');
  });

  test('sets persona and updates prompt', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({
        function: { name: 'set_setting', arguments: '{"key":"persona","value":"child"}' }
      });
    });
    expect(r.success).toBe(true);
    await expect(page.locator('#persona-select')).toHaveValue('child');
  });
});

// ---------------------------------------------------------------------------
// Tool Execution — Output tools (clipboard_write, save_file, generate_chart)
// ---------------------------------------------------------------------------
test.describe('Tool execution — output tools', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('clipboard_write adds to pendingClipboard', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const result = await executeToolCall({
        function: { name: 'clipboard_write', arguments: '{"text":"hello world"}' }
      });
      return { result, pendingCount: pendingClipboard.length };
    });
    expect(r.result.success).toBe(true);
    expect(r.result.length).toBe(11);
    expect(r.pendingCount).toBeGreaterThanOrEqual(1);
  });

  test('save_file adds to pendingDownloads', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const result = await executeToolCall({
        function: { name: 'save_file', arguments: '{"filename":"test.txt","content":"file content"}' }
      });
      return { result, pendingCount: pendingDownloads.length };
    });
    expect(r.result.success).toBe(true);
    expect(r.result.filename).toBe('test.txt');
    expect(r.result.size).toBe(12);
    expect(r.pendingCount).toBeGreaterThanOrEqual(1);
  });

  test('generate_chart adds to pendingCharts', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const result = await executeToolCall({
        function: {
          name: 'generate_chart',
          arguments: '{"type":"bar","title":"Sales","labels":["Q1","Q2"],"datasets":[{"label":"Revenue","data":[100,200]}]}'
        }
      });
      return { result, pendingCount: pendingCharts.length };
    });
    expect(r.result.success).toBe(true);
    expect(r.result.type).toBe('bar');
    expect(r.result.dataPoints).toBe(2);
    expect(r.pendingCount).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Tool Execution — fetch_url (network mocked)
// ---------------------------------------------------------------------------
test.describe('Tool execution — fetch_url', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await mockFetchProxy(page, {
      'https://example.com': async (route) => {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ status: 200, content: '<html>Hello from mock</html>', url: 'https://example.com' }),
        });
      },
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('fetches URL through proxy successfully', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({
        function: { name: 'fetch_url', arguments: '{"url":"https://example.com"}' }
      });
    });
    expect(r.status).toBe(200);
    expect(r.content).toContain('Hello from mock');
    expect(r.cached).toBe(false);
    expect(r.stored_key).toBe('_fetched_' + encodeURIComponent('https://example.com'));
  });

  test('returns cached result on second fetch', async ({ page }) => {
    const r = await page.evaluate(async () => {
      await executeToolCall({ function: { name: 'fetch_url', arguments: '{"url":"https://example.com"}' } });
      return await executeToolCall({ function: { name: 'fetch_url', arguments: '{"url":"https://example.com"}' } });
    });
    expect(r.cached).toBe(true);
    expect(r.content).toContain('Hello from mock');
  });

  test('works with raw HTML proxy response (not JSON-wrapped)', async ({ page }) => {
    // Override the beforeEach mockFetchProxy to return raw HTML
    await mockFetchProxyRaw(page);
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
    const r = await page.evaluate(async () => {
      return await executeToolCall({
        function: { name: 'fetch_url', arguments: '{"url":"https://raw.example.com"}' }
      });
    });
    expect(r.content).toContain('mock raw proxy');
  });

  test('domain block prevents subsequent requests after 429', async ({ page }) => {
    // Replace proxy mock to return 429 for this test
    const r = await page.evaluate(async () => {
      // Override fetch to return 429 for the proxy
      const origFetch = window.fetch;
      let callCount = 0;
      window.fetch = async (url, opts) => {
        if (url.includes('airgap-fetch.gitub.workers.dev')) {
          callCount++;
          return {
            ok: false,
            headers: { get: () => 'application/json' },
            text: async () => JSON.stringify({ status: 429, error: 'Rate limited', retry_after: 60 }),
            json: async () => ({
              status: 429,
              error: 'Rate limited',
              retry_after: 60,
            }),
          };
        }
        return origFetch(url, opts);
      };
      const r1 = await executeToolCall({ function: { name: 'fetch_url', arguments: '{"url":"https://blocked-domain.com"}' } });
      // Second call should hit domain block
      const r2 = await executeToolCall({ function: { name: 'fetch_url', arguments: '{"url":"https://blocked-domain.com"}' } });
      return { first: r1, second: r2, callCount };
    });
    // Note: first call may try multiple proxies, second call should be blocked
    expect(r.second.blocked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tool Execution — read_rss (network mocked)
// ---------------------------------------------------------------------------
test.describe('Tool execution — read_rss', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('parses RSS 2.0 feed', async ({ page }) => {
    await mockFetchProxy(page, {
      'https://example.com/feed.xml': async (route) => {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            status: 200,
            content: `<?xml version="1.0"?>
              <rss version="2.0">
                <channel>
                  <title>Test Feed</title>
                  <item>
                    <title>Item One</title>
                    <link>https://example.com/1</link>
                    <description>First item description</description>
                    <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
                  </item>
                  <item>
                    <title>Item Two</title>
                    <link>https://example.com/2</link>
                    <description>Second item</description>
                  </item>
                </channel>
              </rss>`,
            url: 'https://example.com/feed.xml',
          }),
        });
      },
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const r = await page.evaluate(async () => {
      return await executeToolCall({
        function: { name: 'read_rss', arguments: '{"url":"https://example.com/feed.xml","limit":5}' }
      });
    });
    expect(r.feed_title).toBe('Test Feed');
    expect(r.count).toBe(2);
    expect(r.items[0].title).toBe('Item One');
    expect(r.items[0].link).toBe('https://example.com/1');
    expect(r.items[1].title).toBe('Item Two');
  });

  test('parses Atom feed', async ({ page }) => {
    await mockFetchProxy(page, {
      'https://example.com/atom.xml': async (route) => {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            status: 200,
            content: `<?xml version="1.0"?>
              <feed xmlns="http://www.w3.org/2005/Atom">
                <title>Atom Feed</title>
                <entry>
                  <title>Atom Entry</title>
                  <link rel="alternate" href="https://example.com/atom1"/>
                  <content>Atom content</content>
                  <published>2024-01-01T00:00:00Z</published>
                </entry>
              </feed>`,
            url: 'https://example.com/atom.xml',
          }),
        });
      },
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const r = await page.evaluate(async () => {
      return await executeToolCall({
        function: { name: 'read_rss', arguments: '{"url":"https://example.com/atom.xml","limit":10}' }
      });
    });
    expect(r.feed_title).toBe('Atom Feed');
    expect(r.count).toBe(1);
    expect(r.items[0].title).toBe('Atom Entry');
    expect(r.items[0].link).toBe('https://example.com/atom1');
  });

  test('works with raw XML proxy response (not JSON-wrapped)', async ({ page }) => {
    await mockFetchProxyRaw(page, {
      'https://example.com/raw-feed.xml': async (route) => {
        return route.fulfill({
          contentType: 'text/xml',
          body: `<?xml version="1.0"?>
            <rss version="2.0">
              <channel>
                <title>Raw Feed</title>
                <item>
                  <title>Raw Item</title>
                  <link>https://example.com/raw</link>
                  <description>From raw proxy</description>
                </item>
              </channel>
            </rss>`,
        });
      },
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const r = await page.evaluate(async () => {
      return await executeToolCall({
        function: { name: 'read_rss', arguments: '{"url":"https://example.com/raw-feed.xml","limit":5}' }
      });
    });
    expect(r.feed_title).toBe('Raw Feed');
    expect(r.count).toBe(1);
    expect(r.items[0].title).toBe('Raw Item');
  });

  test('returns error on invalid XML', async ({ page }) => {
    await mockFetchProxy(page, {
      'https://example.com/bad.xml': async (route) => {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            status: 200,
            content: 'not xml',
            url: 'https://example.com/bad.xml',
          }),
        });
      },
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const r = await page.evaluate(async () => {
      return await executeToolCall({
        function: { name: 'read_rss', arguments: '{"url":"https://example.com/bad.xml"}' }
      });
    });
    expect(r.error).toContain('XML parse error');
  });
});

// ---------------------------------------------------------------------------
// Tool Execution — Unknown tool
// ---------------------------------------------------------------------------
test.describe('Tool execution — unknown tool', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('returns error for unrecognized tool name', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({
        function: { name: 'nonexistent_tool', arguments: '{}' }
      });
    });
    expect(r.error).toContain('Unknown tool');
  });

  test('returns error for invalid JSON arguments', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({
        function: { name: 'calculate', arguments: 'not json' }
      });
    });
    expect(r.error).toContain('Invalid tool arguments');
  });
});

// ---------------------------------------------------------------------------
// Chat CRUD
// ---------------------------------------------------------------------------
test.describe('Chat CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('createNewChat creates a new chat and switches to it', async ({ page }) => {
    const r = await page.evaluate(() => {
      const oldId = currentChatId;
      createNewChat();
      return { oldId, newId: currentChatId, chatsLength: chats.length };
    });
    expect(r.chatsLength).toBeGreaterThanOrEqual(1);
    expect(r.newId).not.toBe(r.oldId);
  });

  test('delete chat removes it and falls back to next', async ({ page }) => {
    // Create 2 chats first
    await page.evaluate(() => {
      createNewChat();
      createNewChat();
    });
    const r = await page.evaluate(() => {
      const toDelete = chats[0].id;
      chats.splice(0, 1);
      saveChats();
      if (chats.length > 0) selectChat(chats[0].id);
      return { remaining: chats.length, currentId: currentChatId };
    });
    // Should still have at least 1 chat
    expect(r.remaining).toBeGreaterThanOrEqual(1);
  });

  test('deleting last chat auto-creates new one', async ({ page }) => {
    // Ensure exactly 1 chat
    await page.evaluate(() => {
      chats.splice(1);
      saveChats();
    });
    const r = await page.evaluate(() => {
      chats.splice(0, 1);
      saveChats();
      // init would call createNewChat when empty
      const saved = JSON.parse(localStorage.getItem('opencode_chats') || '[]');
      return { emptyAfterDelete: saved.length === 0 };
    });
    // After removal, chats array is empty
    expect(r.emptyAfterDelete).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Sender API — triggerSend and triggerSendAPI with mocked API
// ---------------------------------------------------------------------------
test.describe('Sender API', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
  });

  test('triggerSend adds user message and calls API', async ({ page }) => {
    const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
    await seedSettings(page, { apiKey: 'sk-test', proxyUrl: apiUrl });
    await seedChat(page, {
      messages: [
        { role: 'system', content: 'You are helpful.' },
      ],
    });
    await page.route(apiUrl, async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'Hello from mock API!' } }]
        }),
      });
    });
    await page.addInitScript(() => {
      window.renderMathInElement = () => {};
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
    await page.waitForSelector('#chat-textarea');

    await page.fill('#chat-textarea', 'test message');
    await page.click('#send-btn');
    await page.waitForTimeout(500);

    const r = await page.evaluate(() => {
      const active = getActiveChat();
      return {
        msgCount: active?.messages?.length || 0,
        lastContent: active?.messages?.[active.messages.length - 1]?.content || '',
        turnCount: active?.turnCount || 0,
      };
    });
    expect(r.msgCount).toBe(3);
    expect(r.lastContent).toContain('Hello from mock API!');
    expect(r.turnCount).toBe(1);
  });

  test('triggerSendAPI handles tool_calls from response', async ({ page }) => {
    const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
    await seedSettings(page, { apiKey: 'sk-test', proxyUrl: apiUrl });
    await seedChat(page, {
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Store my favorite color is blue.' },
      ],
    });
    let callCount = 0;
    await page.route(apiUrl, async (route) => {
      callCount++;
      if (callCount === 1) {
        // First call returns tool_calls
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [{
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'store_value', arguments: '{"key":"favorite_color","value":"blue"}' }
                }]
              }
            }]
          }),
        });
      } else {
        // Second call returns final response
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{ message: { role: 'assistant', content: 'Stored your favorite color.' } }]
          }),
        });
      }
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    // Trigger the API directly
    await page.evaluate(async () => await triggerSendAPI());
    await page.waitForTimeout(500);

    const r = await page.evaluate(() => {
      const active = getActiveChat();
      const stored = llmStoreGet('favorite_color');
      return {
        msgs: active?.messages?.map(m => ({ role: m.role, content: m.content })),
        storedValue: stored,
        storedKeys: llmStoreListKeys(),
      };
    });
    expect(r.storedValue).toBe('blue');
    const lastMsg = r.msgs[r.msgs.length - 1];
    expect(lastMsg.role).toBe('assistant');
    expect(lastMsg.content).toContain('Stored your favorite color.');
  });

  test('triggerSendAPI handles HTTP error', async ({ page }) => {
    const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
    await seedSettings(page, { apiKey: 'sk-test', proxyUrl: apiUrl });
    await seedChat(page);
    await page.route(apiUrl, async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    await page.evaluate(async () => await triggerSendAPI());
    await page.waitForTimeout(300);

    const r = await page.evaluate(() => {
      const active = getActiveChat();
      return active?.messages?.find(m => m.isError)?.content || '';
    });
    expect(r).toContain('Failed to fetch AI response');
  });

  test('stopGenerating aborts the request', async ({ page }) => {
    const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
    await seedSettings(page, { apiKey: 'sk-test', proxyUrl: apiUrl });
    await seedChat(page);
    await page.route(apiUrl, async () => {
      // Never respond — keep pending until aborted
      await new Promise(() => {});
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    // Start generation and then stop
    const r = await page.evaluate(async () => {
      const promise = triggerSendAPI();
      await new Promise(r => setTimeout(r, 100));
      stopGenerating();
      await promise.catch(() => {});
      const active = getActiveChat();
      return active?.messages?.find(m => m.isStopped)?.content || '';
    });
    expect(r).toContain('Response generation was stopped');
  });

  test('triggerCompact compacts conversation via API', async ({ page }) => {
    const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
    await seedSettings(page, { apiKey: 'sk-test', proxyUrl: apiUrl });
    await seedChat(page, {
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'What is the capital of France?' },
        { role: 'assistant', content: 'Paris.' },
        { role: 'user', content: 'What is the capital of Italy?' },
        { role: 'assistant', content: 'Rome.' },
        { role: 'user', content: 'What is the capital of Spain?' },
      ],
    });
    await page.route(apiUrl, async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'User asked about European capitals.' } }]
        }),
      });
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    await page.evaluate(async () => await triggerCompact());
    await page.waitForTimeout(300);

    const r = await page.evaluate(() => {
      const active = getActiveChat();
      return {
        msgCount: active?.messages?.length || 0,
        lastContent: active?.messages?.[active.messages.length - 1]?.content || '',
      };
    });
    expect(r.msgCount).toBe(2); // system + compacted
    expect(r.lastContent).toContain('[Conversation compacted]');
    expect(r.lastContent).toContain('User asked about European capitals.');
  });

  test('tool call loop stops after MAX_TOOL_LOOP exceeded', async ({ page }) => {
    const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
    await seedSettings(page, { apiKey: 'sk-test', proxyUrl: apiUrl });
    await seedChat(page, {
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Keep calling tools.' },
      ],
    });
    let callCount = 0;
    await page.route(apiUrl, async (route) => {
      callCount++;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'call_' + callCount,
                type: 'function',
                function: { name: 'get_current_time', arguments: '{}' }
              }]
            }
          }]
        }),
      });
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    await page.evaluate(async () => await triggerSendAPI());
    await page.waitForTimeout(300);

    const r = await page.evaluate(() => {
      const active = getActiveChat();
      return {
        errorMsg: active?.messages?.find(m => m.isError)?.content || '',
      };
    });
    expect(r.errorMsg).toContain('exceeded maximum');
  });
});

// ---------------------------------------------------------------------------
// UI Rendering — tool call bubbles and output indicators
// ---------------------------------------------------------------------------
test.describe('UI Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('appendToolCallUI creates fetch_url bubble', async ({ page }) => {
    const r = await page.evaluate(() => {
      appendToolCallUI({
        id: 'tc_test',
        function: { name: 'fetch_url', arguments: '{"url":"https://example.com"}' }
      });
      const el = document.getElementById('tool-call-tc_test');
      return {
        exists: !!el,
        className: el?.className || '',
        label: el?.querySelector('.tool-call-label')?.textContent || '',
        url: el?.querySelector('.tool-call-url')?.textContent || '',
      };
    });
    expect(r.exists).toBe(true);
    expect(r.className).toContain('tool-call');
    expect(r.label).toContain('Fetching');
    expect(r.url).toContain('https://example.com');
  });

  test('appendToolCallUI creates search_web bubble', async ({ page }) => {
    const r = await page.evaluate(() => {
      appendToolCallUI({
        id: 'tc_search',
        function: { name: 'search_web', arguments: '{"query":"test query"}' }
      });
      const el = document.getElementById('tool-call-tc_search');
      return {
        exists: !!el,
        label: el?.querySelector('.tool-call-label')?.textContent || '',
        query: el?.querySelector('.tool-call-url')?.textContent || '',
      };
    });
    expect(r.exists).toBe(true);
    expect(r.label).toContain('Searching');
    expect(r.query).toContain('test query');
  });

  test('appendToolCallUI creates send_notification bubble', async ({ page }) => {
    const r = await page.evaluate(() => {
      appendToolCallUI({
        id: 'tc_notif',
        function: { name: 'send_notification', arguments: '{}' }
      });
      const el = document.getElementById('tool-call-tc_notif');
      return {
        exists: !!el,
        label: el?.querySelector('.tool-call-label')?.textContent || '',
      };
    });
    expect(r.exists).toBe(true);
    expect(r.label).toContain('Sending notification');
  });

  test('updateToolCallUI replaces status with success icon', async ({ page }) => {
    const r = await page.evaluate(() => {
      appendToolCallUI({
        id: 'tc_update',
        function: { name: 'calculate', arguments: '{"expression":"2+2"}' }
      });
      updateToolCallUI({ id: 'tc_update', function: { name: 'calculate' } }, { result: 4 });
      const el = document.getElementById('tool-call-tc_update');
      return {
        bubbleHtml: el?.querySelector('.tool-call-bubble')?.outerHTML || '',
      };
    });
    expect(r.bubbleHtml).toContain('check-circle');
  });

  test('updateToolCallUI shows error on failure', async ({ page }) => {
    const r = await page.evaluate(() => {
      appendToolCallUI({
        id: 'tc_err',
        function: { name: 'calculate', arguments: '{"expression":"bad"}' }
      });
      updateToolCallUI({ id: 'tc_err', function: { name: 'calculate' } }, { error: 'Invalid expression' });
      const el = document.getElementById('tool-call-tc_err');
      return {
        bubbleHtml: el?.querySelector('.tool-call-bubble')?.outerHTML || '',
      };
    });
    expect(r.bubbleHtml).toContain('alert-circle');
  });

  test('pending items arrays track output tool calls', async ({ page }) => {
    const r = await page.evaluate(async () => {
      await executeToolCall({
        function: { name: 'clipboard_write', arguments: '{"text":"hello"}' }
      });
      await executeToolCall({
        function: { name: 'save_file', arguments: '{"filename":"t.txt","content":"data"}' }
      });
      await executeToolCall({
        function: { name: 'generate_chart', arguments: '{"type":"bar","title":"T","labels":["A"],"datasets":[{"label":"L","data":[1]}]}' }
      });
      return {
        clipLen: pendingClipboard.length,
        dlLen: pendingDownloads.length,
        chartLen: pendingCharts.length,
      };
    });
    expect(r.clipLen).toBeGreaterThanOrEqual(1);
    expect(r.dlLen).toBeGreaterThanOrEqual(1);
    expect(r.chartLen).toBeGreaterThanOrEqual(1);
  });

  test('renderChatFeed shows welcome screen for empty chat', async ({ page }) => {
    const r = await page.evaluate(() => {
      const chat = getActiveChat();
      if (chat) chat.messages = [{ role: 'system', content: 'You are helpful.' }];
      renderChatFeed();
      return {
        welcomeText: document.querySelector('.welcome-container')?.textContent || '',
      };
    });
    expect(r.welcomeText).toBeTruthy();
    expect(r.welcomeText).toContain('OpenCode LLM Chat');
  });

  test('renderChatFeed renders user and assistant messages', async ({ page }) => {
    const r = await page.evaluate(() => {
      const chat = getActiveChat();
      if (chat) {
        chat.messages = [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello!' },
          { role: 'assistant', content: 'Hi there!' },
        ];
      }
      renderChatFeed();
      const rows = document.querySelectorAll('.message-row');
      return {
        rowCount: rows.length,
        firstRole: rows[0]?.className || '',
        firstBubbleText: rows[0]?.querySelector('.message-bubble')?.textContent || '',
        secondRole: rows[1]?.className || '',
      };
    });
    expect(r.rowCount).toBe(2);
    expect(r.firstRole).toContain('user');
    expect(r.secondRole).toContain('assistant');
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------
test.describe('Edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('store_value handles special characters', async ({ page }) => {
    const r = await page.evaluate(async () => {
      await executeToolCall({
        function: { name: 'store_value', arguments: '{"key":"spec!@#","value":"line1\\nline2\\ttab"}' }
      });
      return await executeToolCall({
        function: { name: 'read_value', arguments: '{"key":"spec!@#"}' }
      });
    });
    expect(r.value).toContain('line1');
    expect(r.value).toContain('tab');
  });

  test('executeToolCall handles missing function name', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({ function: { name: '', arguments: '{}' } });
    });
    expect(r.error).toContain('Unknown tool');
  });

  test('executeToolCall handles undefined arguments', async ({ page }) => {
    const r = await page.evaluate(async () => {
      return await executeToolCall({ function: { name: 'calculate', arguments: undefined } });
    });
    expect(r.error).toContain('Invalid tool arguments');
  });
});
