# Contributing

## Setup

```bash
git clone https://github.com/hasitpbhatt/airgap.git
cd airgap
```

Open `index.html` in a browser. Paste an API key. Send a message.

## Development

```bash
npm install
npx playwright install chromium
npm test
```

Tests mock all network requests (CDN scripts, fonts, proxy) via `page.route()`. No real API server needed.

## Code conventions

- **Function declarations**, not arrow constants — ensures global scope via `<script>` tags
- All state lives in `settings`, `chats`, `currentChatId` globals in `constants.js`
- `localStorage` key prefixes: `opencode_`, `llm_store_`, `global_memory_`, `_fetch_cache_`, `_fetched_`
- Minimal comments; code should be self-documenting

## File structure

```
index.html ──┬── style.css
             ├── manifest.json
             ├── icon.svg
             ├── worker.js          Cloudflare Worker source (deploy separately)
             └── js/ ──┬── constants.js    Tool definitions, state, DOM refs
                       ├── utils.js        Rendering, encoding, helpers
                       ├── storage.js      localStorage abstraction
                       ├── chat.js         Chat CRUD, feed rendering
                       ├── tools.js        15 tool implementations
                       ├── sender.js       API calls, agent loop, pruning
                       └── events.js       Init, event binding, ?k= param
```

Load order is sequential via `<script>` tags (no ES modules — `file://` blocks them). All files share global scope.

## Adding a new tool

1. Add the tool definition to `AVAILABLE_TOOLS` in `js/constants.js`
2. Add a `case` to the `switch` in `executeToolCall` in `js/tools.js`
3. Add tests in `tests/airgap.spec.js`

## Testing proxy responses

The proxy (`worker.js`) can return responses in two formats:

- **JSON-wrapped** (ideal): `{ content: "...", status: 200 }` — use `mockFetchProxy(page, responses)` in tests
- **Raw content** (fallback): the proxy passes through the response body as-is — use `mockFetchProxyRaw(page, responses)` in tests

Always add a `mockFetchProxyRaw` test when modifying proxy-handling code to guard against format regressions.

## Commit conventions

- Use `Fixes #N` in the commit message to auto-close issues on push
- Keep commits focused on a single logical change

## Pull request workflow

1. Branch from `main`
2. Make changes
3. Run `npm test` — all tests must pass
4. Open a PR against `main`
5. CI runs the full test suite automatically
