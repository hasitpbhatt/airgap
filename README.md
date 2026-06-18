# airgap — the most personal AI agent ever created

Every AI agent you've used reports to a server. airgap reports to you.

One HTML file. One API key. A browser. That's all it takes to have an autonomous AI agent that can browse the web, search the internet, remember facts across conversations, read RSS feeds, do math, and call tools — all running locally. No Docker. No npm. No signup. No tracking. No server to phone home to.

**This is what an AI agent should have been from the beginning.**

**[Open airgap →](https://hasit.in/)**

## Sixty seconds

1. Open `index.html` (or visit `hasit.in`)
2. Paste a Mistral or OpenAI API key
3. Type: *"what did Hacker News publish in the last 24 hours?"*
4. Watch your agent fetch the RSS feed, parse every story, and hand you a summary

That's it. The entire internet just became your agent's knowledge base.

## Fifteen tools. One file.

airgap ships with 15 tools — fetch web pages, search across four search engines, read RSS and Atom feeds, store and recall per-chat memory, maintain cross-chat global memory, evaluate math, check the time, compact conversations. Every tool runs through your browser. Every tool calls your LLM directly. Nothing touches our infrastructure because we don't have any.

Adding a tool takes thirty seconds. Open `js/tools.js`. Write a function. That's it.

## Privacy

Your conversation goes straight to the LLM API you choose — Mistral, OpenAI, or any OpenAI-compatible provider. Nothing passes through our server. There is no server. All memory stays in your browser's `localStorage`, fully exportable and deletable. The entire codebase is open source for independent verification.

This is not a product. It's a standard. One file, one API key, no leash.

## License

MIT
