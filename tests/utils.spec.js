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
    expect(r.fourChars).toBe(2);
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

test.describe('TTS', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      var realVoices = [];
      try {
        if (window.speechSynthesis && window.speechSynthesis.getVoices) {
          realVoices = window.speechSynthesis.getVoices();
        }
      } catch (e) {}
      window.__ttsVoices = realVoices.length ? realVoices : [
        { name: 'Voice A', lang: 'en-US' },
        { name: 'Voice B', lang: 'en-GB' },
      ];
      if (window.speechSynthesis) {
        window.speechSynthesis.getVoices = function () { return window.__ttsVoices; };
        window.speechSynthesis.speak = function () {};
        window.speechSynthesis.cancel = function () {};
      }
    });
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test', ttsEnabled: true, ttsModelName: 'voxtral-mini-tts-2603', ttsRate: 1.5, ttsPitch: 1.2, ttsVoice: 'Google US English' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('tts settings panel reflects saved settings', async ({ page }) => {
    const enabled = await page.locator('#tts-enabled').isChecked();
    expect(enabled).toBe(true);

    const modelVal = await page.locator('#tts-model').inputValue();
    expect(modelVal).toBe('voxtral-mini-tts-2603');

    const rateVal = await page.locator('#tts-rate').inputValue();
    expect(rateVal).toBe('1.5');

    const pitchVal = await page.locator('#tts-pitch').inputValue();
    expect(pitchVal).toBe('1.2');
  });

  test('tts toggle saves to settings', async ({ page }) => {
    await page.evaluate(() => {
      elements.ttsEnabledCheckbox.checked = false;
      elements.ttsEnabledCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const ttsEnabled = await page.evaluate(() => settings.ttsEnabled);
    expect(ttsEnabled).toBe(false);

    await page.evaluate(() => {
      elements.ttsEnabledCheckbox.checked = true;
      elements.ttsEnabledCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const ttsEnabled2 = await page.evaluate(() => settings.ttsEnabled);
    expect(ttsEnabled2).toBe(true);
  });

  test('tts model input saves to settings', async ({ page }) => {
    await page.locator('#tts-model').fill('custom-tts-model');
    const modelName = await page.evaluate(() => settings.ttsModelName);
    expect(modelName).toBe('custom-tts-model');
  });

  test('tts rate slider saves to settings', async ({ page }) => {
    await page.locator('#tts-rate').fill('0.8');
    const rate = await page.evaluate(() => settings.ttsRate);
    expect(rate).toBe(0.8);
  });

  test('tts pitch slider saves to settings', async ({ page }) => {
    await page.locator('#tts-pitch').fill('1.8');
    const pitch = await page.evaluate(() => settings.ttsPitch);
    expect(pitch).toBe(1.8);
  });

  test('tts button appears on assistant messages', async ({ page }) => {
    await page.evaluate(() => {
      const chat = getActiveChat();
      if (chat) {
        chat.messages = [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello!' },
          { role: 'assistant', content: 'Hi there!' },
        ];
      }
      renderChatFeed();
    });
    await expect(page.locator('.msg-tts-btn')).toBeVisible();
    const count = await page.locator('.msg-tts-btn').count();
    expect(count).toBe(1);
  });

  test('tts button not shown on error messages', async ({ page }) => {
    await page.evaluate(() => {
      const chat = getActiveChat();
      if (chat) {
        chat.messages = [
          { role: 'system', content: 'You are helpful.' },
          { role: 'assistant', content: 'Something broke', isError: true },
        ];
      }
      renderChatFeed();
    });
    const count = await page.locator('.msg-tts-btn').count();
    expect(count).toBe(0);
  });

  test('getAvailableVoices returns mock voices set via initScript', async ({ page }) => {
    const result = await page.evaluate(async () => {
      window.__ttsVoices = [
        { name: 'Voice A', lang: 'en-US' },
        { name: 'Voice B', lang: 'en-GB' },
      ];
      const voices = await getAvailableVoices();
      return voices.map(function (v) { return v.name; });
    });
    expect(result).toEqual(['Voice A', 'Voice B']);
  });

  test('speakText calls speechSynthesis.speak with correct rate and pitch', async ({ page }) => {
    let spokenArgs = null;
    await page.evaluate(() => {
      window.speechSynthesis.speak = function (utterance) {
        spokenArgs = { text: utterance.text, rate: utterance.rate, pitch: utterance.pitch };
      };
    });
    await page.evaluate(() => {
      settings.ttsRate = 1.2;
      settings.ttsPitch = 0.9;
      speakText('Hello world', 0);
    });
    const args = await page.evaluate(() => spokenArgs);
    expect(args.text).toBe('Hello world');
    expect(args.rate).toBeCloseTo(1.2, 5);
    expect(args.pitch).toBeCloseTo(0.9, 5);
  });

  test('stopSpeaking calls speechSynthesis.cancel', async ({ page }) => {
    let cancelCalled = false;
    await page.evaluate(() => {
      window.speechSynthesis.cancel = function () { cancelCalled = true; };
    });
    await page.evaluate(() => stopSpeaking());
    const called = await page.evaluate(() => cancelCalled);
    expect(called).toBe(true);
  });
});
