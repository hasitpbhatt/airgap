const { test, expect } = require('@playwright/test');
const { INDEX, mockCdn, clearStorage, seedSettings } = require('./helpers');

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

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
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
