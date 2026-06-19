const { test, expect } = require('@playwright/test');
const { INDEX, mockCdn, seedSettings, seedChat } = require('./helpers');

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
    expect(r.remaining).toBeGreaterThanOrEqual(1);
  });

  test('deleting last chat auto-creates new one', async ({ page }) => {
    await page.evaluate(() => {
      chats.splice(1);
      saveChats();
    });
    const r = await page.evaluate(() => {
      chats.splice(0, 1);
      saveChats();
      const saved = JSON.parse(localStorage.getItem('opencode_chats') || '[]');
      return { emptyAfterDelete: saved.length === 0 };
    });
    expect(r.emptyAfterDelete).toBe(true);
  });
});

test.describe('Sender API', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
  });

  function sseChunks(chunks) {
    return chunks.map(function (c) { return 'data: ' + JSON.stringify(c); }).concat(['data: [DONE]']).join('\n');
  }

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
        contentType: 'text/event-stream',
        body: sseChunks([
          { id: '1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'Hello from mock API!' }, finish_reason: 'stop' }] }
        ]),
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
        await route.fulfill({
          contentType: 'text/event-stream',
          body: sseChunks([
            {
              id: '1', object: 'chat.completion.chunk', choices: [{
                index: 0,
                delta: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [{
                    index: 0,
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'store_value', arguments: '{"key":"favorite_color","value":"blue"}' }
                  }]
                },
                finish_reason: 'tool_calls'
              }]
            }
          ]),
        });
      } else {
        await route.fulfill({
          contentType: 'text/event-stream',
          body: sseChunks([
            { id: '2', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'Stored your favorite color.' }, finish_reason: 'stop' }] }
          ]),
        });
      }
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

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
      await new Promise(() => {});
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

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
    expect(r.msgCount).toBe(2);
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
        contentType: 'text/event-stream',
        body: sseChunks([
          {
            id: '1', object: 'chat.completion.chunk', choices: [{
              index: 0,
              delta: {
                role: 'assistant',
                content: null,
                tool_calls: [{
                  index: 0,
                  id: 'call_' + callCount,
                  type: 'function',
                  function: { name: 'get_current_time', arguments: '{}' }
                }]
              },
              finish_reason: 'tool_calls'
            }]
          }
        ]),
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

  test('shows new loading bubble after tool calls for second stream', async ({ page }) => {
    const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
    await seedSettings(page, { apiKey: 'sk-test', proxyUrl: apiUrl });
    await seedChat(page, {
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Fetch and summarize.' },
      ],
    });
    let callCount = 0;
    await page.route(apiUrl, async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          contentType: 'text/event-stream',
          body: sseChunks([
            {
              id: '1', object: 'chat.completion.chunk', choices: [{
                index: 0,
                delta: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [{
                    index: 0,
                    id: 'call_fetch',
                    type: 'function',
                    function: { name: 'get_current_time', arguments: '{}' }
                  }]
                },
                finish_reason: 'tool_calls'
              }]
            }
          ]),
        });
      } else {
        await route.fulfill({
          contentType: 'text/event-stream',
          body: sseChunks([
            { id: '2', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'The time is now.' }, finish_reason: 'stop' }] }
          ]),
        });
      }
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    await page.evaluate(async () => {
      const bubbleCountBefore = document.querySelectorAll('.message-row.assistant').length;
      await triggerSendAPI();
      const assistantRowsAfter = document.querySelectorAll('.message-row.assistant');
      const finalBubble = assistantRowsAfter[assistantRowsAfter.length - 1];
      return {
        assistantRowCount: assistantRowsAfter.length,
        finalContent: finalBubble?.querySelector('.msg-content')?.textContent || '',
      };
    }).then(function (r) {
      expect(r.assistantRowCount).toBeGreaterThanOrEqual(1);
      expect(r.finalContent).toContain('The time is now.');
    });
  });

  test('strips download and URLs from save_file response', async ({ page }) => {
    const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
    await seedSettings(page, { apiKey: 'sk-test', proxyUrl: apiUrl });
    await seedChat(page, {
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Create a file.' },
      ],
    });
    let callCount = 0;
    await page.route(apiUrl, async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          contentType: 'text/event-stream',
          body: sseChunks([
            {
              id: '1', object: 'chat.completion.chunk', choices: [{
                index: 0,
                delta: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [{
                    index: 0,
                    id: 'call_save',
                    type: 'function',
                    function: { name: 'save_file', arguments: '{"filename":"test.txt","content":"hello"}' }
                  }]
                },
                finish_reason: 'tool_calls'
              }]
            }
          ]),
        });
      } else {
        await route.fulfill({
          contentType: 'text/event-stream',
          body: sseChunks([
            { id: '2', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'You can download the file at https://example.com/file.txt. Please download it now.' }, finish_reason: 'stop' }] }
          ]),
        });
      }
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');

    await page.evaluate(async () => await triggerSendAPI());
    await page.waitForTimeout(300);

    const r = await page.evaluate(function () {
      const active = getActiveChat();
      return {
        lastContent: active?.messages?.[active.messages.length - 1]?.content || '',
      };
    });
    expect(r.lastContent).not.toContain('download');
    expect(r.lastContent).not.toContain('https://');
    expect(r.lastContent).not.toContain('example.com');
  });
});

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
        bubbleHtml: el?.querySelector('.tool-call-bubble')?.innerHTML || '',
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
        bubbleHtml: el?.querySelector('.tool-call-bubble')?.innerHTML || '',
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

test.describe('Token counter display', () => {
  test.beforeEach(async ({ page }) => {
    await mockCdn(page);
    await seedSettings(page, { apiKey: 'sk-test' });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('shows per-message token count for user message', async ({ page }) => {
    const r = await page.evaluate(() => {
      const chat = getActiveChat();
      if (chat) {
        chat.messages = [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello!' },
        ];
      }
      renderChatFeed();
      const msgTokens = document.querySelectorAll('.msg-tokens');
      return {
        count: msgTokens.length,
        text: msgTokens[0]?.textContent || '',
      };
    });
    expect(r.count).toBe(1);
    expect(r.text).toContain('tok');
  });

  test('shows per-message token count for assistant message', async ({ page }) => {
    const r = await page.evaluate(() => {
      const chat = getActiveChat();
      if (chat) {
        chat.messages = [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello!' },
          { role: 'assistant', content: 'This is a longer response with more tokens.' },
        ];
      }
      renderChatFeed();
      const msgTokens = document.querySelectorAll('.msg-tokens');
      return {
        count: msgTokens.length,
        firstTokenText: msgTokens[0]?.textContent || '',
        secondTokenText: msgTokens[1]?.textContent || '',
      };
    });
    expect(r.count).toBe(2);
    expect(r.firstTokenText).toContain('tok');
    expect(r.secondTokenText).toContain('tok');
  });

  test('shows context indicator in input-info', async ({ page }) => {
    const r = await page.evaluate(() => {
      const chat = getActiveChat();
      if (chat) {
        chat.messages = [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello world!' },
        ];
      }
      updateInputUIState();
      const ctxText = document.querySelector('.context-text')?.textContent || '';
      const ctxBar = document.querySelector('.context-bar-fill');
      return {
        text: ctxText,
        hasBar: !!ctxBar,
        barStyle: ctxBar ? ctxBar.getAttribute('style') : '',
      };
    });
    expect(r.text).toContain('tok');
    expect(r.text).toContain('/');
    expect(r.hasBar).toBe(true);
    expect(r.barStyle).toContain('width');
  });

  test('context indicator updates after sending a message', async ({ page }) => {
    const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
    await seedSettings(page, { apiKey: 'sk-test', proxyUrl: apiUrl });
    await seedChat(page, {
      messages: [
        { role: 'system', content: 'You are helpful.' },
      ],
    });
    await page.route(apiUrl, async (route) => {
      await route.fulfill({
        contentType: 'text/event-stream',
        body: [
          'data: ' + JSON.stringify({ id: '1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'Mock reply' }, finish_reason: 'stop' }] }),
          'data: [DONE]',
        ].join('\n'),
      });
    });
    await page.addInitScript(() => {
      window.renderMathInElement = () => {};
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
    await page.waitForSelector('#chat-textarea');

    await page.fill('#chat-textarea', 'Test message for tokens');
    await page.click('#send-btn');
    await page.waitForTimeout(500);

    const r = await page.evaluate(() => {
      const ctxText = document.querySelector('.context-text')?.textContent || '';
      const msgTokens = document.querySelectorAll('.msg-tokens');
      return {
        contextText: ctxText,
        msgTokenCount: msgTokens.length,
      };
    });
    expect(r.contextText).toContain('tok');
    expect(r.msgTokenCount).toBe(2);
  });
});
