const { test, expect } = require('@playwright/test');
const { INDEX, mockCdn, seedSettings, seedChat, mockFetchProxy, mockFetchProxyRaw } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await mockCdn(page);
  await seedSettings(page, { apiKey: 'sk-test' });
  await page.goto(INDEX);
  await page.waitForSelector('#sidebar');
});

test.describe('Tool execution — per-chat storage', () => {
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

test.describe('Tool execution — global memory', () => {
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

test.describe('Tool execution — notes', () => {
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

test.describe('Tool execution — calculate', () => {
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

test.describe('Tool execution — get_current_time', () => {
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

test.describe('Tool execution — compact', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test('compacts conversation preserving system + last user message', async ({ page }) => {
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
    const r = await page.evaluate(async () => {
      const saved = JSON.parse(localStorage.getItem('opencode_chats') || '[]');
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
    const r = await page.evaluate(async () => {
      return await executeToolCall({
        function: { name: 'compact', arguments: '{}' }
      });
    });
    expect(r.error).toContain('required');
  });
});

test.describe('Tool execution — set_setting', () => {
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

test.describe('Tool execution — output tools', () => {
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

test.describe('Tool execution — fetch_url', () => {
  test.beforeEach(async ({ page }) => {
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
    const r = await page.evaluate(async () => {
      const origFetch = window.fetch;
      window.fetch = async (url, opts) => {
        if (url.includes('airgap-fetch.gitub.workers.dev')) {
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
      const r2 = await executeToolCall({ function: { name: 'fetch_url', arguments: '{"url":"https://blocked-domain.com"}' } });
      return { first: r1, second: r2 };
    });
    expect(r.second.blocked).toBe(true);
  });
});

test.describe('Tool execution — read_rss', () => {
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

test.describe('Tool execution — unknown tool', () => {
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

test.describe('Tool execution — github tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api.github.com/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      const owner = 'testuser';
      const repo = 'testrepo';

      if (url.includes('/contents/') && method === 'GET') {
        if (url.includes('README.md')) {
          return route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              name: 'README.md',
              path: 'README.md',
              sha: 'abc123def456',
              size: 42,
              encoding: 'base64',
              type: 'file',
              content: Buffer.from('# Hello World').toString('base64'),
              html_url: 'https://github.com/testuser/testrepo/blob/main/README.md'
            }),
          });
        }
        if (url.includes('nonexistent.md')) {
          return route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Not Found' }),
          });
        }
      }

      if (url.includes('/contents/') && method === 'PUT') {
        const body = JSON.parse(route.request().postData() || '{}');
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            content: {
              html_url: 'https://github.com/testuser/testrepo/blob/main/newfile.md'
            },
            commit: {
              sha: 'newcommit123',
              html_url: 'https://github.com/testuser/testrepo/commit/newcommit123'
            }
          }),
        });
      }

      if (url.includes('/pulls') && method === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            html_url: 'https://github.com/testuser/testrepo/pull/1',
            number: 1,
            state: 'open',
            title: body.title || 'Test PR'
          }),
        });
      }

      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Not Found' }),
      });
    });
    await page.goto(INDEX);
    await page.waitForSelector('#sidebar');
  });

  test('github_get_contents reads a file successfully', async ({ page }) => {
    const r = await page.evaluate(async () => {
      githubToken = 'test-token';
      return await executeToolCall({
        function: { name: 'github_get_contents', arguments: '{"owner":"testuser","repo":"testrepo","path":"README.md"}' }
      });
    });
    expect(r.sha).toBe('abc123def456');
    expect(r.content).toBe('# Hello World');
    expect(r.type).toBe('file');
    expect(r.path).toBe('README.md');
  });

  test('github_get_contents returns error for missing file', async ({ page }) => {
    const r = await page.evaluate(async () => {
      githubToken = 'test-token';
      return await executeToolCall({
        function: { name: 'github_get_contents', arguments: '{"owner":"testuser","repo":"testrepo","path":"nonexistent.md"}' }
      });
    });
    expect(r.error).toContain('Not Found');
  });

  test('github_get_contents returns error when token is missing', async ({ page }) => {
    const r = await page.evaluate(async () => {
      githubToken = '';
      return await executeToolCall({
        function: { name: 'github_get_contents', arguments: '{"owner":"testuser","repo":"testrepo","path":"README.md"}' }
      });
    });
    expect(r.error).toContain('GitHub token not configured');
  });

  test('github_create_or_update_file creates a new file', async ({ page }) => {
    const r = await page.evaluate(async () => {
      githubToken = 'test-token';
      return await executeToolCall({
        function: { name: 'github_create_or_update_file', arguments: '{"owner":"testuser","repo":"testrepo","path":"newfile.md","content":"# New File","message":"Add newfile","branch":"main"}' }
      });
    });
    expect(r.commit.sha).toBe('newcommit123');
    expect(r.content.html_url).toContain('github.com');
  });

  test('github_create_or_update_file updates existing file with sha', async ({ page }) => {
    const r = await page.evaluate(async () => {
      githubToken = 'test-token';
      return await executeToolCall({
        function: { name: 'github_create_or_update_file', arguments: '{"owner":"testuser","repo":"testrepo","path":"README.md","content":"# Updated","message":"Update README","branch":"main","sha":"abc123def456"}' }
      });
    });
    expect(r.commit.sha).toBe('newcommit123');
  });

  test('github_create_pr creates a pull request', async ({ page }) => {
    const r = await page.evaluate(async () => {
      githubToken = 'test-token';
      return await executeToolCall({
        function: { name: 'github_create_pr', arguments: '{"owner":"testuser","repo":"testrepo","title":"My PR","head":"feature","base":"main"}' }
      });
    });
    expect(r.number).toBe(1);
    expect(r.state).toBe('open');
    expect(r.html_url).toContain('github.com');
  });

  test('github_create_pr creates a draft PR', async ({ page }) => {
    const r = await page.evaluate(async () => {
      githubToken = 'test-token';
      return await executeToolCall({
        function: { name: 'github_create_pr', arguments: '{"owner":"testuser","repo":"testrepo","title":"Draft PR","head":"feature","base":"main","draft":true}' }
      });
    });
    expect(r.number).toBe(1);
    expect(r.state).toBe('open');
  });

  test('github_create_pr returns error when token is missing', async ({ page }) => {
    const r = await page.evaluate(async () => {
      githubToken = '';
      return await executeToolCall({
        function: { name: 'github_create_pr', arguments: '{"owner":"testuser","repo":"testrepo","title":"No Token","head":"feature","base":"main"}' }
      });
    });
    expect(r.error).toContain('GitHub token not configured');
  });
});
