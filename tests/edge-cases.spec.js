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
