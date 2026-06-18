# airgap

Every AI agent you've used reports to a server. airgap reports to you.

An autonomous AI agent that runs entirely in your browser. Browse the web, search the internet, read RSS feeds, remember facts across conversations, evaluate math — all through a single HTML file and an API key. No Docker, no npm, no signup, no server.

## Quick start

```
git clone https://github.com/hasitpbhatt/airgap.git
cd airgap
```

Open `index.html` in a browser. Paste an API key. Send a message.

Web access uses a default Cloudflare Worker (`https://airgap-fetch.gitub.workers.dev/`). Self-host option: deploy `fetch_url.php` to any PHP host via `cp fetch_url.php /var/www/html/` and set the URL in settings.

**Test:** `npx playwright test` (requires Chromium, install via `npx playwright install chromium`)

## Architecture

```
index.html ──┬── style.css
             ├── manifest.json
             ├── icon.svg
             └── js/ ──┬── constants.js    Tool definitions, state, DOM refs
                       ├── utils.js        Rendering, encoding, helpers
                       ├── storage.js      localStorage abstraction
                       ├── chat.js         Chat CRUD, feed rendering
                       ├── tools.js        15 tool implementations
                       ├── sender.js       API calls, agent loop, pruning
                       └── events.js       Init, event binding, ?k= param
```

Load order is sequential via `<script>` tags (no ES modules — `file://` blocks them). All files share global scope.

```
                  ┌─────────────────┐
                  │   index.html    │
                  │  (entry point)  │
                  └────────┬────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
     ┌──────────┐   ┌──────────┐   ┌──────────┐
     │ Browser  │   │   LLM    │   │   Web    │
     │  UI &    │   │   API    │   │  Fetch   │
     │ Memory   │   │(Mistral, │   │  Proxy   │
     │(localS.) │   │ OpenAI)  │   │(fetch_   │
     └──────────┘   └──────────┘   │ url.php) │
                                   └──────────┘
```

- **Browser** renders the chat UI, manages localStorage, runs tools
- **LLM API** receives messages + tool definitions, returns text or `tool_calls`
- **Fetch proxy** defaults to a Cloudflare Worker (`https://airgap-fetch.gitub.workers.dev/`). A PHP fallback (`fetch_url.php`) is provided for self-hosting — trivial cURL script with `Access-Control-Allow-Origin: *`.

## Configuration

### Settings panel

| Field | Default | Description |
|-------|---------|-------------|
| LLM API Proxy URL | `https://api.mistral.ai/v1/chat/completions` | Any OpenAI-compatible API |
| Tool Fetch Proxy URL | `https://airgap-fetch.gitub.workers.dev/` (or self-hosted PHP) | Web fetch endpoint |
| API Key | — | Stored in localStorage only |
| Model | `mistral-small-latest` | Preset or custom |
| System Persona | General | 6 templates or custom prompt |

### URL injection

`?k=<hex>` obfuscates and injects API key + model + proxy URL:

```
?k=2c13190a12016c2a573e3041072258674161663a...
```

The hex is XOR-encoded (key `_x4`) JSON: `{"k":"sk-...","m":"mistral-small-latest","u":"https://..."}`. Legacy raw-key format is also accepted.

Use the **Share link with credential** button in settings to generate one.

### Auto-pruning

When a conversation reaches 15 non-system messages, the agent automatically summarizes and compacts history via `/compact`. Transparent to the user — happens before the next message is sent.

## 24 tools

| Tool | Description |
|------|-------------|
| `fetch_url` | Fetch any URL via proxy |
| `search_web` | Parallel search across DuckDuckGo, SearXNG, Ecosia, Bing, Brave |
| `read_rss` | Parse RSS 2.0 / Atom / RSS 1.0 feeds |
| `save_file` | Create a file and offer it as a browser download |
| `generate_chart` | Render a bar, line, or pie chart from data |
| `clipboard_write` | Write text to the clipboard (triggers on user click) |
| `send_notification` | Send a system/desktop notification |
| `set_setting` | Update a chat setting (proxyUrl, modelName, persona) |
| `notes_create` | Create or overwrite a global note |
| `notes_read` | Read a single note by key |
| `notes_list` | List all notes, optionally filtered by query |
| `notes_delete` | Delete a single note by key |
| `store_value` | Per-chat persistent key-value storage |
| `read_value` | Retrieve per-chat stored value |
| `list_stored_keys` | List all keys in current chat |
| `delete_value` | Remove a per-chat stored value |
| `compact` | Summarize and compress conversation history |
| `get_current_time` | Current date, time, timezone |
| `calculate` | Evaluate math expressions (Math.* supported) |
| `remember` | Global cross-chat memory: store |
| `recall` | Global cross-chat memory: retrieve (exact + substring) |
| `forget` | Global cross-chat memory: delete single key |
| `forget_all` | Global cross-chat memory: delete all |

Tools are defined in `js/constants.js` and implemented in `js/tools.js`. Adding a new tool takes one entry in `AVAILABLE_TOOLS` and one `case` in the dispatch.

## Transparent fetch cache

`fetch_url` caches responses per-chat in localStorage with a 5-minute TTL. Keyed by URL hash. Automatically serves cached content on repeat requests, transparent to the LLM. Content is also stored permanently under `_fetched_<encodedUrl>` in conversation memory — the LLM can re-read it via `read_value` without re-fetching.

## User commands

| Command | Action |
|---------|--------|
| `/compact` | Summarize and trim history |
| `/clear` | Reset messages, keep system prompt |

## Development

```bash
# Install dependencies
npm install

# Run tests (requires Playwright Chromium)
npx playwright install chromium
npm test
```

Tests mock all network requests (CDN scripts, fonts) via `page.route()`. No real API server needed. 14 tests across 6 suites.

### File conventions

- Functions use `function` keyword declarations (not arrow constants) — ensures global scope via `<script>` tags
- All state lives in `settings`, `chats`, `currentChatId` globals in `constants.js`
- localStorage keys: `opencode_settings`, `opencode_chats`, `opencode_current_chat_id`, `llm_store_<chatId>_*`, `global_memory_*`, `_fetch_cache_*`

## Deployment

### Static host (Netlify, Vercel, GitHub Pages)

Serves the chat UI. Fetch proxy defaults to a Cloudflare Worker; `fetch_url.php` can be self-hosted.

### PHP host

```bash
# Self-host fetch proxy (optional, for those without Cloudflare Workers)
cp fetch_url.php /var/www/html/
```

Requires PHP with `curl` extension. Set the **Tool Fetch Proxy URL** in settings to point to your instance.

### PWA

`manifest.json` and `icon.svg` enable "Add to Home Screen" on supported browsers. Voice input (Web Speech API) requires HTTPS — only works from served origins, not `file://`.

## Limitations

- Voice input requires HTTPS (Web Speech API restriction)
- `file://` blocks ES modules — app uses global-scope scripts
- Google blocks automated requests (HTTP 429) — use `search_web` tool instead
- All state is localStorage — clearing browser data loses chats and memory

## Privacy

Conversations go directly to the LLM API you configure. No data passes through a middleman. Memory stays in `localStorage` — fully exportable and deletable. The entire codebase is open source.

## License

MIT
