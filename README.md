# airgap — a personal AI agent in your browser

No server. No install. No signup. No tracking. One HTML file, an API key, and the LLM can fetch URLs, search the web, read RSS, remember facts, do math, and more. You can add a new tool in 30 seconds.

**[Try it →](https://hasit.in/)**

## Privacy

Your conversation goes directly to the LLM API (Mistral, OpenAI, or any provider you choose). Nothing passes through our server — because there is no server. All memory is stored on your device in `localStorage` and can be exported or cleared at any time. The entire codebase is open source for independent vetting.

## 60-second demo

1. Open `index.html` (or visit `hasit.in`)
2. Paste your Mistral/OpenAI API key
3. Type: *"summarize the last 5 stories from Hacker News"*
4. Watch the LLM fetch the RSS feed, parse it, and return a summary

That's it. No Docker, no npm, no `.env`, no server.

## How it works

airgap is a single-page app that connects to any OpenAI-compatible API. The LLM gets 15 tools it can call autonomously — fetch, search, persist memory, calculate, read RSS — and loops until it has a complete answer. Everything runs in your browser. Your data stays in localStorage.

Tools ship with the app. Want a new one? Add a function in `js/tools.js`.

## Tools

Fetch web pages · Search the web (4 engines) · Read RSS/Atom feeds · Per-chat memory · Cross-chat global memory · Math evaluation · Current time · Conversation compaction

## Requirements

- A browser (Chrome, Edge, Safari, Firefox)
- An API key from Mistral, OpenAI, or any OpenAI-compatible provider

## Project structure

```
├── index.html         # Main app
├── style.css          # Styles
├── js/                # 7 plain JS files (no build step)
│   ├── constants.js   # Config & tool definitions
│   ├── tools.js       # Tool execution
│   ├── sender.js      # API loop
│   ├── events.js      # Event wiring & init
│   ├── chat.js        # Chat rendering
│   ├── storage.js     # localStorage helpers
│   └── utils.js       # Markdown, sanitize, etc.
├── fetch_url.php      # CORS proxy (deploy anywhere)
├── manifest.json      # PWA
└── icon.svg           # App icon
```

## License

MIT
