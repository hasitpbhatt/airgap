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

```bash
npm run lint    # ESLint (JS correctness) + Prettier (markdown/YAML/JSON)
npm run format  # auto-format markdown/YAML/JSON
```

JS, HTML, and CSS keep house style (see `.prettierignore`) — ESLint checks
correctness (`no-undef` against the documented cross-file globals in
`eslint.config.js`), not formatting. When adding shared globals, declare them
there.

Tests mock all network requests (CDN scripts, fonts, proxy) via `page.route()`. No real API server needed.

## Code conventions

- **Function declarations**, not arrow constants — ensures global scope via `<script>` tags
- All state lives in `settings`, `chats`, `currentChatId` globals in `constants.js`
- `localStorage` key prefixes: `airgap_`, `llm_store_`, `global_memory_`, `note_`, `_fetch_cache_`, `_fetched_`
- Minimal comments; code should be self-documenting

## File structure

```
index.html ──┬── style.css
             ├── manifest.json
             ├── icon.svg
             ├── worker.js          Cloudflare Worker source (deploy separately)
             └── js/ ──┬── constants.js    Tool definitions, state, DOM refs
                       ├── utils.js        Rendering, encoding, helpers, TTS
                       ├── storage.js      localStorage abstraction, key migration
                       ├── chat.js         Chat CRUD, feed rendering
                       ├── tools-core.js   Output tools (clipboard, file, chart, notify)
                       ├── tools-fetch.js  fetch_url, search_web, read_rss
                       ├── tools-github.js GitHub API tools
                       ├── tools-storage.js Memory, notes, per-chat storage tools
                       ├── tools-misc.js   Math, time, settings, compact tools
                       ├── tools.js        Dispatch (executeToolCall) + tool-call UI
                       ├── local-engine.js In-browser LLM via WebLLM (ES module)
                       ├── sender.js       API calls, agent loop, pruning
                       └── events.js       Init, event binding, ?k= param
```

Load order is sequential via `<script>` tags. All files share global scope, except `local-engine.js`, which is an ES module (importmap) and only loads from served origins — unavailable on `file://`.

## Adding a new tool

1. Add the tool definition to `AVAILABLE_TOOLS` in `js/constants.js` (and to `LOCAL_TOOLS` if the local engine should offer it)
2. Add the handler in the matching `js/tools-*.js` domain file
3. Add a `case` to the `switch` in `executeToolCall` in `js/tools.js`
4. Add tests in the matching spec under `tests/` (`tools.spec.js` for most tools)

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
4. Every PR must include tests covering the new behavior or fix
5. Every fix or feature must have a corresponding GitHub issue — reference it with `Fixes #N` in the commit body
6. Open a PR against `main`
7. CI runs the full test suite automatically

## Release process

Release Drafter maintains a draft release from merged PRs automatically —
review its notes as part of every release, but the version call stays manual.

1. Ensure `CHANGELOG.md` is up to date under the `[Unreleased]` section
2. Run `npx playwright test` — all tests must pass
3. Update the version in `package.json` (e.g. `1.1.0`)
4. Update `CHANGELOG.md`: change `[Unreleased]` to the new version and date (e.g. `[1.1.0] — 2026-07-01`)
5. Commit: `git commit -m "Release v1.1.0"`
6. Tag: `git tag v1.1.0`
7. Push: `git push origin main --tags`
8. Publish the draft release (check the auto-generated notes first, then publish)
