# Agent memory for airgap

## Commit conventions
- Use `Fixes #N` in commit body to auto-close GitHub issues on push.
- Keep commits focused — one logical change per commit.

## Code conventions
- `function` keyword declarations (not arrow constants) — global scope via `<script>` tags.
- All state in `settings`, `chats`, `currentChatId` globals in `constants.js`.
- Minimal comments; code should be self-documenting.

## Project structure
- 7 JS files; load order: constants → utils → storage → chat → tools → sender → events.
- No ES modules — `file://` blocks them. All files share global scope.
- Tests: Playwright with `page.route()` mock. Run: `npx playwright test`.

## Issue priority (UX-first)
- Remaining high-impact: #3 (streaming SSE), #2 (slash command menu).
- Everything else in backlog: #7 (drag-drop), #9 (token counter), #8 (search), #1 (in-chat search), #13 (branching), #14 (PWA), #11 (multi-model), #12 (custom tools).

## PR conventions
- Every fix or feature must have a corresponding GitHub issue — reference with `Fixes #N` in commit body.
- Every PR must include tests covering the change.

## Misc
- Prefer editing existing files over creating new ones.
- Verify with `npm test` before committing.
- Check `CONTRIBUTING.md` for project-specific conventions.
