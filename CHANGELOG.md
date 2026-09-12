# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Contributor gates: ESLint correctness config for the shared-global script
  architecture, Prettier for markdown/YAML/JSON, `npm run lint`/`format`,
  and a CI lint job; PR template now checks lint and changelog updates
- Discoverability: license/release/PR badges, package metadata, FAQ and
  troubleshooting section, repo topics
- Release Drafter maintains draft release notes from merged PRs
- Local browser engine (BETA): run Qwen2.5 0.5B/1.5B fully in-browser via WebLLM, with tool loop, offline model loading, and engine badge/settings UI
- GitHub integration tools: `github_get_contents`, `github_create_or_update_file`, `github_create_pr`, `github_create_issue` via direct API calls with a session-only token
- Text-to-speech output for assistant messages (Web Speech synthesis, optional Voxtral API endpoint)
- Slash commands: `/new`, `/export [format]`, `/persona <name>` (plus `/compact`, `/clear`) with a `/` autocomplete menu
- File attachments (images, PDFs, code, text) including drag-and-drop
- In-conversation search (`Ctrl+F`) and global search across all conversations
- Conversation branching, custom user-defined tools, token counter with context bar and cost breakdown
- About modal, GitHub Pages demo deploy, mobile responsive tweaks
- Resilient web search (SearXNG-first with proxy fallback chain), context-window guard for oversized fetch results
- Issue/PR templates and .editorconfig for consistent contributor experience
- CODE_OF_CONDUCT.md (Contributor Covenant v2.1) and SECURITY.md
- Screenshot of chat UI in README
- Dependabot config for weekly npm dependency checks
- Expanded .gitignore with OS/editor artifacts

### Changed

- API keys are obfuscated at rest in localStorage (prefixed `obf1:`). This raises
  the bar against casual extension scraping; it is not encryption. Plaintext keys
  written by earlier versions are read as-is and re-saved obfuscated, so no
  migration step is needed
- Overhauled README with comprehensive project documentation
- Renamed `opencode_*` localStorage keys and all user-visible strings to `airgap`; existing chats and settings migrate automatically on first load

## [1.0.0] — 2026-06-19

### Added

- Initial release of airgap — browser-based autonomous AI agent
- Chat interface with sidebar, conversation management, and message history
- 24 built-in tools: web browsing, search, RSS, memory, file creation, charts, notes, clipboard, notifications, math evaluation
- Multi-engine web search with automatic fallback (SearXNG, DuckDuckGo, Ecosia, Bing, Brave)
- Fetch proxy via Cloudflare Worker with caching and domain rate-limit handling
- Global cross-chat memory with sidebar management panel
- Conversation auto-pruning at 15 messages (/compact)
- Export conversations as JSON, Markdown, or Plain Text
- Voice input via Web Speech API
- PWA support with manifest.json and icon.svg
- Keyboard shortcuts (Ctrl+N, Ctrl+B, ?, Esc)
- URL parameter injection for API key, model, and proxy URL (?k=)
- Environment variable injection for static hosting
- Configurable system personas (6 templates + custom)
- Token-burn disclaimer on share links
- HTTPS-only features handled gracefully on file://

### Added (tools)

- fetch_url with caching and domain rate-limit handling
- search_web with parallel multi-engine fallback
- read_rss (RSS 2.0, Atom, RSS 1.0/RDF)
- save_file, generate_chart, clipboard_write, send_notification
- notes_create, notes_read, notes_list, notes_delete
- store_value, read_value, list_stored_keys, delete_value
- remember, recall, forget, forget_all (global memory)
- compact, get_current_time, calculate, set_setting

### Added (testing)

- 6 Playwright spec files with mocked network requests
- GitHub Actions CI workflow
- Tests covering chat CRUD, streaming, tools, edge cases, encoding

### Changed

- Split monolithic app.js into 7 modular JS files
- Default API URL set to api.mistral.ai
- XOR-encoded URL injection for API key privacy
- SearXNG requests made directly from browser to bypass proxy
- Fetch proxy default changed from PHP fallback to Cloudflare Worker

### Fixed

- Console errors for send_notification in PWA context
- Proxy parse errors for raw HTML responses
- Download button persistence and hallucinated file URLs
- Test failures from API changes (llmStoreListAll → llmStoreListKeys)
- Dark band CSS in memory and settings panels
- Smart auto-scroll: only scrolls when user is near bottom

[Unreleased]: https://github.com/hasitpbhatt/airgap/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/hasitpbhatt/airgap/releases/tag/v1.0.0
