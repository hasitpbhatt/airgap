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
        body: 'window.katex = {};',
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
