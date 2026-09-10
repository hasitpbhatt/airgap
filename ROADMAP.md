# Roadmap

Prioritized from the live backlog. Check `gh issue list` — issue numbers
below were current when this was written and may have shifted.

## Principles (non-negotiable)

- Local by design: messages, keys, and context stay in the browser.
- No backend, no accounts, no telemetry. Every feature must preserve this.
- Bring your own key: any OpenAI-compatible endpoint, remote or local.

## Now

- **API key obfuscation at rest (#54)** — localStorage is plaintext today;
  raise the bar against casual extension scraping. Security-adjacent, so it
  goes first.
- **Online-enhancement rework** — parked on
  `wip/online-enhancement-cache-queue`. The prototype needs rewiring
  (element refs, classic-script-compatible modules, queue execution) before
  it can merge. See the branch commit message for the gap list.

## Next

- **Text-to-speech completion (#21)** — output plumbing exists (Web Speech
  + optional Voxtral endpoint); remaining work is polish and provider UX.
- **PWA notifications for long tasks (#14)** — build on the existing
  `send_notification` tool and service-worker path.
- **Conversation templates & prompt library (#44)** — complements the
  existing persona system.

## Later

- **Multi-model conversations (#11)** — side-by-side comparison; high
  effort, needs UI + sender-architecture work.
- **Advanced memory management (#42)** — categories, importance scoring,
  expiration; high effort, must stay exportable/deletable.
- **Themes & customization (#43)** — dark mode, accent colors, custom CSS.

## Out of scope

Server-side features, user accounts, analytics, or anything that routes
conversations through an intermediary. Use the issue tracker to challenge
this list — that is what it is for.
