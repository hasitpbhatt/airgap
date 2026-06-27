const { test, expect } = require('@playwright/test');
const { INDEX, mockCdn, clearStorage } = require('./helpers');

const LOCAL_SETTINGS = {
  proxyUrl: 'https://api.mistral.ai/v1/chat/completions',
  apiKey: '',
  modelName: 'mistral-small-latest',
  engine: 'local',
  localModelName: 'qwen2.5-0.5b',
  localModelLoaded: false,
  localModelLoading: false,
  currentPersona: 'general',
  customSystemPrompt: '',
  useMaxTurns: false,
  maxTurns: 5,
};

test.describe('Local Engine', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await clearStorage(page);
    await page.addInitScript((data) => {
      localStorage.setItem('opencode_settings', JSON.stringify(data));
    }, LOCAL_SETTINGS);
  });

  test('__localEngine is exported to window', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const hasEngine = await page.evaluate(() => {
      return typeof window.__localEngine !== 'undefined';
    });
    expect(hasEngine).toBe(true);
  });

  test('__localEngine exports expected methods', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const methods = await page.evaluate(() => {
      const e = window.__localEngine;
      return {
        hasLoadModel: typeof e.loadModel === 'function',
        hasUnloadModel: typeof e.unloadModel === 'function',
        hasChatCompletion: typeof e.chatCompletion === 'function',
        hasChatCompletionStream: typeof e.chatCompletionStream === 'function',
        hasIsLoaded: typeof e.isLoaded === 'function',
        hasGetEngineType: typeof e.getEngineType === 'function',
        hasCheckWebGPU: typeof e.checkWebGPU === 'function',
        hasBuildLocalSystemPrompt: typeof e.buildLocalSystemPrompt === 'function',
        hasParseToolCalls: typeof e.parseToolCalls === 'function',
        hasLOCAL_MODELS_CONFIG: typeof e.LOCAL_MODELS_CONFIG === 'object',
      };
    });

    expect(methods.hasLoadModel).toBe(true);
    expect(methods.hasUnloadModel).toBe(true);
    expect(methods.hasChatCompletion).toBe(true);
    expect(methods.hasChatCompletionStream).toBe(true);
    expect(methods.hasIsLoaded).toBe(true);
    expect(methods.hasGetEngineType).toBe(true);
    expect(methods.hasCheckWebGPU).toBe(true);
    expect(methods.hasBuildLocalSystemPrompt).toBe(true);
    expect(methods.hasParseToolCalls).toBe(true);
    expect(methods.hasLOCAL_MODELS_CONFIG).toBe(true);
  });

  test('checkWebGPU returns false in headless Chromium', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const hasWebGPU = await page.evaluate(() => {
      return window.__localEngine.checkWebGPU();
    });
    expect(hasWebGPU).toBe(false);
  });

  test('LOCAL_MODELS_CONFIG has expected keys', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const keys = await page.evaluate(() => {
      return Object.keys(window.__localEngine.LOCAL_MODELS_CONFIG);
    });
    expect(keys).toContain('qwen2.5-0.5b');
    expect(keys).toContain('qwen2.5-1.5b');
  });

  test('buildLocalSystemPrompt adds tool descriptions', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const result = await page.evaluate(() => {
      const tools = [
        {
          function: {
            name: 'test_tool',
            description: 'A test tool',
            parameters: {
              type: 'object',
              properties: {
                arg1: { type: 'string', description: 'First argument' },
              },
              required: ['arg1'],
            },
          },
        },
      ];
      return window.__localEngine.buildLocalSystemPrompt('You are a test bot.', tools);
    });

    expect(result).toContain('You are a test bot.');
    expect(result).toContain('[TOOL_CALL:');
    expect(result).toContain('test_tool');
    expect(result).toContain('A test tool');
    expect(result).toContain('arg1');
  });

  test('buildLocalSystemPrompt handles empty tools array', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const result = await page.evaluate(() => {
      return window.__localEngine.buildLocalSystemPrompt('Base prompt.', []);
    });
    expect(result).toBe('Base prompt.');
  });

  test('parseToolCalls extracts tool calls from text', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const calls = await page.evaluate(() => {
      const text = 'Let me check.\n[TOOL_CALL: fetch_url(url="https://example.com")]\nDone.';
      return window.__localEngine.parseToolCalls(text);
    });

    expect(calls.length).toBe(1);
    expect(calls[0].name).toBe('fetch_url');
    const args = JSON.parse(calls[0].arguments);
    expect(args.url).toBe('https://example.com');
  });

  test('parseToolCalls handles multiple tool calls', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const calls = await page.evaluate(() => {
      const text = '[TOOL_CALL: calculate(expression="2+2")]\n[TOOL_CALL: get_current_time(timezone="UTC")]';
      return window.__localEngine.parseToolCalls(text);
    });

    expect(calls.length).toBe(2);
    expect(calls[0].name).toBe('calculate');
    expect(calls[1].name).toBe('get_current_time');
  });

  test('parseToolCalls returns empty array for no matches', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const calls = await page.evaluate(() => {
      return window.__localEngine.parseToolCalls('Hello, how can I help?');
    });

    expect(calls.length).toBe(0);
  });

  test('getContextLimit returns local limits when engine is local', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const limit = await page.evaluate(() => {
      settings.engine = 'local';
      settings.localModelName = 'qwen2.5-0.5b';
      return getContextLimit();
    });
    expect(limit).toBe(2048);
  });

  test('getContextLimit returns 4096 for 1.5B model', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const limit = await page.evaluate(() => {
      settings.engine = 'local';
      settings.localModelName = 'qwen2.5-1.5b';
      return getContextLimit();
    });
    expect(limit).toBe(4096);
  });

  test('LOCAL_TOOLS constant contains expected tools', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const tools = await page.evaluate(() => {
      return Array.from(LOCAL_TOOLS);
    });
    expect(tools).toContain('fetch_url');
    expect(tools).toContain('search_web');
    expect(tools).toContain('calculate');
    expect(tools).toContain('get_current_time');
    expect(tools).toContain('read_value');
    expect(tools).toContain('list_stored_keys');
    expect(tools).toContain('notes_read');
    expect(tools).toContain('notes_list');
    expect(tools.length).toBe(8);
  });

  test('engine badge is hidden when remote mode', async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('opencode_settings', JSON.stringify(data));
    }, { ...LOCAL_SETTINGS, engine: 'remote' });

    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const badgeDisplay = await page.evaluate(() => {
      const badge = document.getElementById('engine-badge');
      return badge ? badge.style.display : 'none';
    });
    expect(badgeDisplay).toBe('none');
  });

  test('local settings group is hidden when remote mode', async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('opencode_settings', JSON.stringify(data));
    }, { ...LOCAL_SETTINGS, engine: 'remote' });

    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const visible = await page.evaluate(() => {
      const group = document.getElementById('local-settings-group');
      return group ? group.style.display : 'none';
    });
    expect(visible).toBe('none');
  });

  test('engine select reflects saved setting', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const engineVal = await page.evaluate(() => {
      return document.getElementById('engine-select').value;
    });
    expect(engineVal).toBe('local');
  });

  test('model select shows local models', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const options = await page.evaluate(() => {
      const sel = document.getElementById('local-model-select');
      return Array.from(sel.options).map(o => o.value);
    });
    expect(options).toContain('qwen2.5-0.5b');
    expect(options).toContain('qwen2.5-1.5b');
  });

  test('download button exists and shows correct text', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const btnText = await page.evaluate(() => {
      return document.getElementById('download-model-btn').textContent.trim();
    });
    expect(btnText).toContain('Download');
  });

  test('unload button hidden by default', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const unloadDisplay = await page.evaluate(() => {
      return document.getElementById('unload-model-btn').style.display;
    });
    expect(unloadDisplay).toBe('none');
  });

  test('engine toggle switches display between local and remote settings', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const result = await page.evaluate(() => {
      const sel = document.getElementById('engine-select');
      sel.value = 'remote';
      sel.dispatchEvent(new Event('change'));
      return {
        localDisplay: document.getElementById('local-settings-group').style.display,
        remoteDisplay: document.getElementById('remote-settings-group').style.display,
        badgeDisplay: document.getElementById('engine-badge').style.display,
        engine: settings.engine,
      };
    });

    expect(result.localDisplay).toBe('none');
    expect(result.remoteDisplay).toBe('block');
    expect(result.badgeDisplay).toBe('none');
    expect(result.engine).toBe('remote');
  });

  test('engine toggle to local shows local settings', async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('opencode_settings', JSON.stringify(data));
    }, { ...LOCAL_SETTINGS, engine: 'remote' });

    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const result = await page.evaluate(() => {
      const sel = document.getElementById('engine-select');
      sel.value = 'local';
      sel.dispatchEvent(new Event('change'));
      return {
        localDisplay: document.getElementById('local-settings-group').style.display,
        remoteDisplay: document.getElementById('remote-settings-group').style.display,
        badgeDisplay: document.getElementById('engine-badge').style.display,
        engine: settings.engine,
      };
    });

    expect(result.localDisplay).toBe('block');
    expect(result.remoteDisplay).toBe('none');
    expect(result.badgeDisplay).toBe('inline');
    expect(result.engine).toBe('local');
  });

  test('CONTEXT_LIMITS includes local model entries', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const limits = await page.evaluate(() => {
      return {
        qwen05: CONTEXT_LIMITS['qwen2.5-0.5b'],
        qwen15: CONTEXT_LIMITS['qwen2.5-1.5b'],
      };
    });
    expect(limits.qwen05).toBe(2048);
    expect(limits.qwen15).toBe(4096);
  });

  test('isLoaded returns false before loading model', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const loaded = await page.evaluate(() => {
      return window.__localEngine.isLoaded();
    });
    expect(loaded).toBe(false);
  });

  test('getEngineType returns null before loading', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const engineType = await page.evaluate(() => {
      return window.__localEngine.getEngineType();
    });
    expect(engineType).toBe(null);
  });

  test('getLoadedModelKey returns null before loading', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const key = await page.evaluate(() => {
      return window.__localEngine.getLoadedModelKey();
    });
    expect(key).toBe(null);
  });

  test('unloadModel is safe when no model loaded', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const result = await page.evaluate(async () => {
      try {
        await window.__localEngine.unloadModel();
        return 'ok';
      } catch (e) {
        return 'error: ' + e.message;
      }
    });
    expect(result).toBe('ok');
  });

  test('loadModel with unknown key throws error', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const result = await page.evaluate(async () => {
      try {
        await window.__localEngine.loadModel('nonexistent-model');
        return 'no error';
      } catch (e) {
        return e.message;
      }
    });
    expect(result).toContain('Unknown model');
  });

  test('chatCompletion throws when no model loaded', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const result = await page.evaluate(async () => {
      try {
        const gen = window.__localEngine.chatCompletion([{ role: 'user', content: 'hi' }]);
        for await (const _ of gen) {} // eslint-disable-line no-unused-vars
        return 'no error';
      } catch (e) {
        return e.message;
      }
    });
    expect(result).toContain('No model loaded');
  });

  test('parseToolCalls handles escaped quotes in arguments', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const calls = await page.evaluate(() => {
      return window.__localEngine.parseToolCalls(
        '[TOOL_CALL: search_web(query="hello \\"world\\" test")]'
      );
    });

    expect(calls.length).toBe(1);
    expect(calls[0].name).toBe('search_web');
    const args = JSON.parse(calls[0].arguments);
    expect(args.query).toBe('hello "world" test');
  });
});
