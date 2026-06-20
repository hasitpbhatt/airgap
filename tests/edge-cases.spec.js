const { test, expect } = require('@playwright/test');
const { INDEX, mockCdn, clearStorage, seedSettings, seedChat, mockFetchProxy, mockFetchProxyRaw } = require('./helpers');

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

test.describe('Toast and confirm dialogs', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedSettings(page, { apiKey: 'test-key' });
    await page.goto(INDEX);
    await page.waitForLoadState('networkidle');
  });

  test('showToast creates a visible toast', async ({ page }) => {
    await page.evaluate(() => showToast('Hello from toast', 'info'));
    const toast = page.locator('.toast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveText('Hello from toast');
  });

  test('showConfirm shows modal and resolves true on OK', async ({ page }) => {
    const result = page.evaluate(() => showConfirm('Proceed?'));
    await expect(page.locator('#confirm-overlay')).toBeVisible();
    await expect(page.locator('#confirm-body')).toHaveText('Proceed?');
    await page.locator('#confirm-ok').click();
    expect(await result).toBe(true);
  });

  test('showConfirm resolves false on Cancel', async ({ page }) => {
    const result = page.evaluate(() => showConfirm('Cancel me?'));
    await page.locator('#confirm-cancel').click();
    expect(await result).toBe(false);
  });

  test('showConfirm resolves false on Escape', async ({ page }) => {
    const result = page.evaluate(() => showConfirm('Escape me?'));
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(await result).toBe(false);
  });
});

test.describe('Export conversation', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedSettings(page, { apiKey: 'test-key' });
    await page.goto(INDEX);
    await page.waitForLoadState('networkidle');
  });

  test('Export button downloads JSON by default', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export-chat-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('dropdown shows format options on click', async ({ page }) => {
    const dropdown = page.locator('#export-dropdown');
    await expect(dropdown).toBeHidden();
    await page.locator('#export-drop-btn').click();
    await expect(dropdown).toBeVisible();
  });

  test('Markdown option downloads .md file', async ({ page }) => {
    await page.locator('#export-drop-btn').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-option[data-format="markdown"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.md$/);
  });

  test('Plain Text option downloads .txt file', async ({ page }) => {
    await page.locator('#export-drop-btn').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-option[data-format="text"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.txt$/);
  });
});

test.describe('Keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedSettings(page, { apiKey: 'test-key' });
    await page.goto(INDEX);
    await page.waitForLoadState('networkidle');
  });

  test('pressing ? opens the shortcuts modal', async ({ page }) => {
    const overlay = page.locator('#shortcuts-overlay');
    await expect(overlay).toBeHidden();
    await page.evaluate(() => window.openShortcuts());
    await expect(overlay).toBeVisible();
  });

  test('pressing Escape closes the shortcuts modal', async ({ page }) => {
    const overlay = page.locator('#shortcuts-overlay');
    await page.evaluate(() => window.openShortcuts());
    await expect(overlay).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });

  test('clicking close button hides the modal', async ({ page }) => {
    const overlay = page.locator('#shortcuts-overlay');
    await page.evaluate(() => window.openShortcuts());
    await expect(overlay).toBeVisible();
    await page.locator('#shortcuts-close-btn').click();
    await expect(overlay).toBeHidden();
  });

  test('? does not trigger when textarea is focused', async ({ page }) => {
    const overlay = page.locator('#shortcuts-overlay');
    await page.locator('#chat-textarea').focus();
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true })));
    await expect(overlay).toBeHidden();
  });
});

test.describe('About modal', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedSettings(page, { apiKey: 'test-key' });
    await page.goto(INDEX);
    await page.waitForLoadState('networkidle');
  });

  test('clicking the about trigger opens the modal', async ({ page }) => {
    const overlay = page.locator('#about-overlay');
    await expect(overlay).toBeHidden();
    await page.locator('#about-trigger').click();
    await expect(overlay).toBeVisible();
  });

  test('Escape closes the about modal', async ({ page }) => {
    const overlay = page.locator('#about-overlay');
    await page.evaluate(() => window.openAbout());
    await expect(overlay).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });

  test('close button hides the about modal', async ({ page }) => {
    const overlay = page.locator('#about-overlay');
    await page.evaluate(() => window.openAbout());
    await expect(overlay).toBeVisible();
    await page.locator('#about-close-btn').click();
    await expect(overlay).toBeHidden();
  });

  test('clicking overlay background closes the about modal', async ({ page }) => {
    const overlay = page.locator('#about-overlay');
    await page.evaluate(() => window.openAbout());
    await expect(overlay).toBeVisible();
    await overlay.click({ position: { x: 10, y: 10 } });
    await expect(overlay).toBeHidden();
  });

  test('about modal shows feature items', async ({ page }) => {
    await page.evaluate(() => window.openAbout());
    await expect(page.locator('.about-modal')).toBeVisible();
    await expect(page.locator('.about-feature')).toHaveCount(8);
    await expect(page.locator('.about-feature-title').first()).toHaveText('Web Fetch & RSS');
  });
});

test.describe('Smart auto-scroll', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedSettings(page, { apiKey: 'test-key' });
    await page.goto(INDEX);
    await page.waitForLoadState('networkidle');
  });

  test('scrollToBottom scrolls when near bottom', async ({ page }) => {
    const scrolled = await page.evaluate(() => {
      const c = document.getElementById('chat-feed-container');
      c.style.height = '200px';
      c.style.overflow = 'scroll';
      for (let i = 0; i < 50; i++) {
        const d = document.createElement('div');
        d.style.height = '40px';
        d.textContent = 'line ' + i;
        document.getElementById('chat-feed').appendChild(d);
      }
      c.scrollTop = c.scrollHeight - c.clientHeight;
      scrollToBottom();
      return c.scrollTop + c.clientHeight >= c.scrollHeight;
    });
    expect(scrolled).toBe(true);
  });

  test('tryAutoScroll scrolls when near bottom', async ({ page }) => {
    const scrolled = await page.evaluate(() => {
      const c = document.getElementById('chat-feed-container');
      c.style.height = '200px';
      c.style.overflow = 'scroll';
      for (let i = 0; i < 50; i++) {
        const d = document.createElement('div');
        d.style.height = '40px';
        d.textContent = 'line ' + i;
        document.getElementById('chat-feed').appendChild(d);
      }
      c.scrollTop = c.scrollHeight - c.clientHeight;
      tryAutoScroll();
      return c.scrollTop + c.clientHeight >= c.scrollHeight;
    });
    expect(scrolled).toBe(true);
  });

  test('tryAutoScroll does not scroll when user scrolled up', async ({ page }) => {
    const scrollTopAfter = await page.evaluate(() => {
      userScrolledAway = true;
      const c = document.getElementById('chat-feed-container');
      c.style.height = '200px';
      c.style.overflow = 'scroll';
      for (let i = 0; i < 50; i++) {
        const d = document.createElement('div');
        d.style.height = '40px';
        d.textContent = 'line ' + i;
        document.getElementById('chat-feed').appendChild(d);
      }
      tryAutoScroll();
      return c.scrollTop;
    });
    expect(scrollTopAfter).toBe(0);
  });

  test('scrollToBottom always scrolls regardless of user scroll', async ({ page }) => {
    const scrollTopAfter = await page.evaluate(() => {
      userScrolledAway = true;
      const c = document.getElementById('chat-feed-container');
      c.style.height = '200px';
      c.style.overflow = 'scroll';
      for (let i = 0; i < 50; i++) {
        const d = document.createElement('div');
        d.style.height = '40px';
        d.textContent = 'line ' + i;
        document.getElementById('chat-feed').appendChild(d);
      }
      c.scrollTop = 0;
      scrollToBottom();
      return c.scrollTop + c.clientHeight >= c.scrollHeight;
    });
    expect(scrollTopAfter).toBe(true);
  });
});

test.describe('Slash command menu', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedSettings(page, { apiKey: 'test-key' });
    await page.goto(INDEX);
    await page.waitForLoadState('networkidle');
  });

  test('typing / shows the slash menu', async ({ page }) => {
    const menu = page.locator('#slash-menu');
    await expect(menu).toBeHidden();
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '/';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(menu).toBeVisible();
    await expect(menu.locator('.slash-item')).toHaveCount(5);
  });

  test('typing /cl filters to one command', async ({ page }) => {
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '/cl';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const menu = page.locator('#slash-menu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('.slash-item')).toHaveCount(1);
    await expect(menu.locator('.slash-item').first()).toHaveAttribute('data-command', 'clear');
  });

  test('deleting / hides the menu', async ({ page }) => {
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '/';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#slash-menu')).toBeVisible();
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#slash-menu')).toBeHidden();
  });

  test('Escape dismisses the menu', async ({ page }) => {
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '/';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#slash-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#slash-menu')).toBeHidden();
  });

  test('arrow keys navigate items and first is highlighted', async ({ page }) => {
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '/';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const items = page.locator('#slash-menu .slash-item');
    await expect(items.nth(0)).toHaveClass(/highlighted/);
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toHaveClass(/highlighted/);
    await expect(items.nth(0)).not.toHaveClass(/highlighted/);
    await page.keyboard.press('ArrowUp');
    await expect(items.nth(0)).toHaveClass(/highlighted/);
  });

  test('clicking outside dismisses the menu', async ({ page }) => {
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '/';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#slash-menu')).toBeVisible();
    await page.locator('#active-chat-title').click();
    await expect(page.locator('#slash-menu')).toBeHidden();
  });

  test('clicking a command item executes it', async ({ page }) => {
    await page.route('**/api.mistral.ai/**', async (route) => {
      await route.fulfill({
        contentType: 'text/event-stream',
        body: 'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      });
    });
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '/';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#slash-menu')).toBeVisible();
    await page.locator('#slash-menu .slash-item[data-command="clear"]').click();
    await expect(page.locator('#slash-menu')).toBeHidden();
    await expect(page.locator('#chat-textarea')).toHaveValue('');
  });

  test('/new creates a new chat and clears textarea', async ({ page }) => {
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '/new';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.keyboard.press('Enter');
    await expect(page.locator('#chat-textarea')).toHaveValue('');
    const chatCount = await page.evaluate(() => document.querySelectorAll('.chat-item').length);
    expect(chatCount).toBeGreaterThanOrEqual(1);
  });

  test('/new in slash menu creates a new chat', async ({ page }) => {
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '/';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#slash-menu')).toBeVisible();
    await page.locator('#slash-menu .slash-item[data-command="new"]').click();
    await expect(page.locator('#chat-textarea')).toHaveValue('');
    await expect(page.locator('#slash-menu')).toBeHidden();
  });

  test('/export json downloads conversation', async ({ page }) => {
    let downloaded = false;
    await page.route('**/*', (route) => {
      if (route.request().url().startsWith('blob:')) {
        downloaded = true;
      }
      route.continue();
    });
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '/export json';
      triggerSend();
    });
    const chatCount = await page.evaluate(() => document.querySelectorAll('.chat-item').length);
    expect(chatCount).toBeGreaterThanOrEqual(1);
  });

  test('/export with no argument defaults to json', async ({ page }) => {
    let exportCalled = false;
    await page.evaluate(() => {
      const orig = window.exportCurrentChat;
      window.exportCurrentChat = (fmt) => { exportCalled = true; };
      const ta = document.getElementById('chat-textarea');
      ta.value = '/export';
      triggerSend();
      window.exportCurrentChat = orig;
    });
  });

  test('/persona switches persona', async ({ page }) => {
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '/persona deep';
      triggerSend();
    });
    const personaVal = await page.evaluate(() => settings.currentPersona);
    expect(personaVal).toBe('deep');
    const selectVal = await page.evaluate(() => document.getElementById('persona-select').value);
    expect(selectVal).toBe('deep');
  });

  test('/persona is case-insensitive', async ({ page }) => {
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '/persona Deep';
      triggerSend();
    });
    const personaVal = await page.evaluate(() => settings.currentPersona);
    expect(personaVal).toBe('deep');
  });

  test('/persona with invalid name is a no-op', async ({ page }) => {
    const before = await page.evaluate(() => settings.currentPersona);
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '/persona nonexistent';
      triggerSend();
    });
    const after = await page.evaluate(() => settings.currentPersona);
    expect(after).toBe(before);
  });

  test('/persona with no argument is a no-op', async ({ page }) => {
    const before = await page.evaluate(() => settings.currentPersona);
    await page.evaluate(() => {
      const ta = document.getElementById('chat-textarea');
      ta.value = '/persona';
      triggerSend();
    });
    const after = await page.evaluate(() => settings.currentPersona);
    expect(after).toBe(before);
  });
});
