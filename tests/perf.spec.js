const { test, expect } = require('@playwright/test');
const { INDEX, mockCdn, seedSettings, seedChat } = require('./helpers');

// Time to first magic (roadmap M1.2). These budgets cover the app's own
// overhead only — CDN fetches are mocked and the provider round trip is
// replaced by an instant SSE stream, so a failure here means the app got
// slower, not that Mistral did.
const API_URL = 'https://api.mistral.ai/v1/chat/completions';
const INIT_BUDGET_MS = 3000;
const RESPONSE_BUDGET_MS = 3000;

function sseChunks(chunks) {
  return chunks
    .map((c) => 'data: ' + JSON.stringify(c))
    .concat(['data: [DONE]'])
    .join('\n');
}

function enablePerf(page) {
  return page.addInitScript(() => localStorage.setItem('airgap_perf', '1'));
}

test.describe('Time to first magic', () => {
  test('perf marks stay off unless explicitly enabled', async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
    const enabled = await page.evaluate(() => perfEnabled());
    const marks = await page.evaluate(() => window.__airgapPerf || null);
    expect(enabled).toBe(false);
    expect(marks).toBeNull();
  });

  test('UI is ready within budget after init', async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await enablePerf(page);
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    const elapsed = await page.evaluate(() => {
      const m = window.__airgapPerf || {};
      return Math.round((m['ui-ready'] || 0) - (m['init-start'] || 0));
    });
    expect(elapsed).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(INIT_BUDGET_MS);
  });

  test('first response completes within budget after send', async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test', proxyUrl: API_URL });
    await seedChat(page, { messages: [{ role: 'system', content: 'You are helpful.' }] });
    await enablePerf(page);
    await page.route(API_URL, (route) =>
      route.fulfill({
        contentType: 'text/event-stream',
        body: sseChunks([
          {
            id: '1',
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { content: 'Hello from mock API!' }, finish_reason: 'stop' }]
          }
        ])
      })
    );
    await page.goto(INDEX);
    await page.waitForSelector('#chat-textarea');

    await page.fill('#chat-textarea', 'test message');
    await page.click('#send-btn');
    await page.waitForFunction(() => window.__airgapPerf && window.__airgapPerf['response-complete']);

    const elapsed = await page.evaluate(() => {
      const m = window.__airgapPerf;
      return Math.round(m['response-complete'] - m['send']);
    });
    expect(elapsed).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(RESPONSE_BUDGET_MS);
  });

  test('perfReport summarises the funnel without writing anywhere', async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test', proxyUrl: API_URL });
    await seedChat(page, { messages: [{ role: 'system', content: 'You are helpful.' }] });
    await enablePerf(page);
    await page.route(API_URL, (route) =>
      route.fulfill({
        contentType: 'text/event-stream',
        body: sseChunks([
          {
            id: '1',
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { content: 'Hi!' }, finish_reason: 'stop' }]
          }
        ])
      })
    );
    await page.goto(INDEX);
    await page.waitForSelector('#chat-textarea');
    await page.fill('#chat-textarea', 'test message');
    await page.click('#send-btn');
    await page.waitForFunction(() => window.__airgapPerf && window.__airgapPerf['response-complete']);

    const summary = await page.evaluate(() => perfReport());
    expect(summary['init to UI ready (ms)']).toBeGreaterThan(0);
    expect(summary['send to first response (ms)']).toBeGreaterThan(0);
    expect(summary['page load to first response (ms)']).toBeGreaterThan(0);
  });
});
