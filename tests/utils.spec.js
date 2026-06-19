const { test, expect } = require('@playwright/test');
const { INDEX, mockCdn, clearStorage, seedSettings } = require('./helpers');

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

  test('estimateTokens returns 0 for null/undefined/empty string', async ({ page }) => {
    const r = await page.evaluate(() => {
      return {
        fromNull: estimateTokens(null),
        fromUndefined: estimateTokens(undefined),
        fromEmpty: estimateTokens(''),
      };
    });
    expect(r.fromNull).toBe(0);
    expect(r.fromUndefined).toBe(0);
    expect(r.fromEmpty).toBe(0);
  });

  test('estimateTokens computes roughly 1 token per 4 characters', async ({ page }) => {
    const r = await page.evaluate(() => {
      return {
        fourChars: estimateTokens('abcd'),
        eightChars: estimateTokens('abcdefgh'),
        twelveChars: estimateTokens('abcdefghijkl'),
      };
    });
    expect(r.fourChars).toBe(1);
    expect(r.eightChars).toBe(2);
    expect(r.twelveChars).toBe(3);
  });

  test('estimateTokens handles long content', async ({ page }) => {
    const r = await page.evaluate(() => {
      const text = 'A'.repeat(4000);
      return estimateTokens(text);
    });
    expect(r).toBe(1000);
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

test.describe('Share link', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-share-test', proxyUrl: 'https://custom.example.com/v1', modelName: 'mistral-large-latest' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
    await page.locator('#settings-trigger').click();
    await expect(page.locator('#share-link-group')).toBeVisible();
  });

  test('generates link with encoded JSON payload', async ({ page }) => {
    await page.locator('#gen-share-link').click();
    const shareOut = page.locator('#share-link-out');
    await expect(shareOut).toBeVisible();
    const link = await shareOut.inputValue();
    expect(link).toContain('?k=');

    const hex = link.split('?k=')[1];
    const decoded = await page.evaluate((h) => xorHexDecode(h), hex);
    const parsed = JSON.parse(decoded);
    expect(parsed.k).toBe('sk-share-test');
    expect(parsed.m).toBe('mistral-large-latest');
    expect(parsed.u).toBe('https://custom.example.com/v1');
  });
});

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
