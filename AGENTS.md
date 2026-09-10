# Agent memory for airgap

## Commit conventions
- Use `Fixes #N` in commit body to auto-close GitHub issues on push.
- Keep commits focused — one logical change per commit.

## Code conventions
- `function` keyword declarations (not arrow constants) — global scope via `<script>` tags.
- All state in `settings`, `chats`, `currentChatId` globals in `constants.js`.
- Minimal comments; code should be self-documenting.

## Project structure
- 13 JS files in `js/`; load order: constants → utils → storage → chat → tools-core/fetch/github/storage/misc → tools → sender → events. `local-engine.js` is the sole ES module (importmap, served origins only).
- Tool implementations live in `js/tools-*.js` domain files; `js/tools.js` holds the dispatch (`executeToolCall`) + tool-call UI. 27 tools in `AVAILABLE_TOOLS`, 6 in the `LOCAL_TOOLS` subset.
- Tests: Playwright with `page.route()` mock. Run: `npx playwright test`. New spec per area (`tests/migration.spec.js` covers the `opencode_*` → `airgap_*` migration).
- WIP parked on `wip/online-enhancement-cache-queue` — broken prototype (missing element refs, ES-export syntax, bad queue wiring). Rework before merge, do not cherry-pick blindly.

## Issue priority (UX-first)
- Open backlog: #54 (API key obfuscation), #21 (TTS), #14 (PWA notifications), #11 (multi-model), #42 (memory), #43 (themes), #44 (templates).
- Everything else is landed; check `gh issue list` — do not trust remembered issue numbers.

## PR conventions
- Every fix or feature must have a corresponding GitHub issue — reference with `Fixes #N` in commit body.
- Every PR must include tests covering the change.

## Misc
- Prefer editing existing files over creating new ones.
- Verify with `npm test` before committing.
- Check `CONTRIBUTING.md` for project-specific conventions.
