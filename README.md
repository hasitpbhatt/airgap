# OpenCode Chat - Developer LLM Interface

A gorgeous, developer-centric interface for talking to LLMs with **agentic tool calling**. Select a teaching persona or customize configuration in the sidebar settings to get started.

## Features

- **Agentic Tool Calling**: The LLM can behave as an agent — fetch live web data (`fetch_url`), search the web (`search_web`), persist facts to memory (`store_value`/`read_value`), compact conversation history (`compact`), perform math (`calculate`), and check the time (`get_current_time`)
- **Global Memory**: Cross-conversation persistent memory — `remember`/`recall`/`forget`/`forget_all` tools let the LLM store facts accessible from every chat
- **Memory Panel**: Sidebar panel to browse, search, edit, expand, and delete all stored global memories
- **Auto Context Pruning**: Conversations are automatically compacted via `/compact` when they exceed 15 messages — no manual housekeeping needed
- **Transparent Fetch Cache**: Repeated URL fetches return cached results (5-min TTL) — shown as *(cached Ns ago)* in the UI
- **Conversation Commands**: `/compact` to summarize & trim history (also an LLM tool), `/clear` to reset messages while keeping system prompt
- **Voice Input**: Built-in microphone button using the Web Speech Recognition API — works on Chrome, Edge, and Safari over HTTPS
- **PWA Ready**: Installable on mobile home screen via `manifest.json` — runs fullscreen with no browser chrome
- **Multiple Teaching Personas**: General Assistant, Explain Like I'm 10, Deep Dive Expert, First Principles Thinker, Socratic Tutor, and Custom System Prompt
- **Configurable API Settings**: API URL, Tool Fetch URL, API Key, Model Selection, and Turns Limit
- **Chat Management**: Create, rename, export, and clear conversations
- **Rich Text Editing**: Markdown support with syntax highlighting and LaTeX equations
- **Responsive Design**: Works seamlessly on desktop and mobile
- **File:// Protocol Support**: Opens directly from the filesystem — no web server required
- **Advanced UI**: Modern glassmorphism design with smooth animations

## Architecture

Single-page application split into focused JS modules loaded via plain `<script>` tags (no build tooling — works from `file://`). Tool fetch requests are proxied through `fetch_url.php` to bypass CORS (or any custom endpoint you configure).

## Installation

This project is a single-page application that doesn't require traditional installation. Simply open `index.html` in your web browser.

## Usage

1. **Open the application**: Open `index.html` in your browser
2. **Start a conversation**: Click "New Conversation" or select a persona from the welcome screen
3. **Configure settings**: Click the settings icon in the sidebar to adjust API URL (default: `api.mistral.ai`), tool fetch proxy, and API key
4. **Chat with AI**: Type your message and press Enter or click the send button
5. **Ask for live data**: Try "What's on Hacker News?" — the LLM will call the fetch tool automatically
6. **Use commands**: Type `/compact` to summarize history or `/clear` to reset the conversation
7. **Voice input**: Tap the mic button (HTTPS only) and speak — your words appear in the textarea automatically

## Personas

### 🤖 General AI Assistant
Helpful, general purpose coding and problem-solving assistant.

### 🧒 Explain Like I'm 10
Explains tough concepts using fun analogies and simple words.

### 🔬 Deep Dive Expert
Advanced technical breakdowns connecting concepts to state-of-the-art research.

### 🧠 First Principles Thinker
Deconstructs topics to fundamental truths using logical reasoning.

### ❓ Socratic Tutor
Guides you to discover concepts through questioning and critical thinking.

### ⚙️ Custom System Prompt
Create your own custom persona with personalized instructions.

## Configuration

### API Settings
- **LLM API URL**: The OpenAI-compatible chat completions endpoint (default: `https://api.mistral.ai/v1/chat/completions`)
- **Tool Fetch Proxy URL**: Endpoint for proxying `fetch_url` tool calls (default: `fetch_url.php` — relative path)
- **API Key**: Authentication token for the API provider
- **Model Selection**: Choose from Mistral Small, Medium, Large, Codestral, or Custom
- **Turns Limit**: Optional limit on conversation length

### Persona Customization
- Select from predefined personas or create custom system prompts
- Each persona has specialized instructions for different learning styles

## Project Structure

```
.
├── index.html        # Main application page
├── style.css         # Styling
├── js/               # JavaScript modules (see below)
│   ├── constants.js  # Personas, tool definitions, state vars, DOM refs
│   ├── utils.js      # Markdown rendering, sanitization, code highlighting
│   ├── storage.js    # Per-conversation localStorage helpers for LLM tools
│   ├── chat.js       # Chat CRUD, rendering, message actions, input UI state
│   ├── tools.js      # Tool execution (fetch, store/read, remember/recall/forget, compact, calc, time) + UI
│   ├── sender.js     # API sending, agent loop, /compact, /clear commands
│   └── events.js     # Event listeners, init, voice input SpeechRecognition
├── fetch_url.php     # CORS proxy for tool fetch calls
├── manifest.json     # PWA manifest (standalone display, purple theme)
├── icon.svg          # PWA app icon (terminal-themed)
├── README.md         # This file
└── LICENSE           # License
```

## Technical Details

### Agentic Tool Loop
- The LLM receives `AVAILABLE_TOOLS` definitions with each API call
- When the model responds with `tool_calls`, the app executes each tool via `executeToolCall()`
- **12 available tools**:
  - `fetch_url` — web fetch via PHP CORS proxy
  - `store_value` / `read_value` / `list_stored_keys` / `delete_value` — per-chat localStorage memory
  - `remember` / `recall` / `forget` / `forget_all` — cross-conversation global memory (shared across all chats)
  - `compact` — conversation summarization
  - `get_current_time` — returns current date/time in multiple formats
  - `search_web` — search the web across multiple engines (DuckDuckGo, Brave, Ecosia, Bing) with automatic fallback
  - `calculate` — evaluates math expressions (safe `eval` via `Function` constructor)
- Tool results are appended to the conversation and the API is called again
- The loop continues up to `MAX_TOOL_LOOP` (10) iterations until a final response is generated
- Tool calls are shown in real-time with dashed-border bubbles above the typing indicator; each tool type has a distinct icon (globe, database, file-text, brain, clock, calculator)
- The `compact` tool modifies `activeChat.messages` in place and the loop rebuilds the local messages array from the compacted history; `/compact` also shows a system notice in chat

### Global Memory
- Four tools (`remember`, `recall`, `forget`, `forget_all`) provide cross-conversation persistent storage
- All global memory entries use the `global_memory_` localStorage prefix (no chat-ID scoping) — facts are accessible across every conversation
- The `recall` tool searches by exact key first, then falls back to substring matching across all keys
- The memory panel in the sidebar shows all stored memories with search, expand/collapse, inline edit (key & value via prompt), and per-item delete
- Auto-refreshes when open after any LLM memory mutation
- Brain icon (🧠 `data-lucide="brain"`) for memory tool call bubbles; human-readable done labels ("Memory stored", "All memory cleared")

### Auto Context Pruning
- When a conversation exceeds `AUTO_COMPACT_THRESHOLD` (15 non-system messages), the next message triggers an automatic `/compact` before sending
- The user's latest message is preserved; all older history is summarized into a single compact notice
- Provides transparent token management — no manual `/compact` required for long sessions
- The compact system notice appears in the chat feed

### Fetch Cache
- `fetch_url` checks a per-chat localStorage cache before making HTTP requests
- Cache key: `_fetch_cache_{encodeURIComponent(url)}` inside the conversation's namespace
- Entries expire after 5 minutes (configurable TTL)
- Cached results display *(cached Ns ago)* in the tool bubble — zero LLM dependency
- Cache is automatically cleaned during `/compact` and `/clear`

### Voice Input
- A mic button (`🎤`) appears in the textarea toolbar when the browser supports `SpeechRecognition` or `webkitSpeechRecognition`
- Tapping the button starts recording with a pulsing red indicator
- Speech is transcribed in real-time and inserted into the message textarea
- Auto-stops after 3 seconds of silence
- Requires HTTPS (blocked on `file://` and insecure origins)
- Supported in Chrome, Edge, Safari (desktop & mobile)

### PWA Support
- `manifest.json` defines standalone display mode with a purple theme (`#7c3aed`)
- SVG icon scales cleanly to 192×192 and 512×512
- When served over HTTPS, users can "Add to Home Screen" for a native-like experience
- Fully offline capable once cached by the browser's service worker (future enhancement)

### State Management
- Centralized state store with reactive updates
- Automatic localStorage persistence
- Subscriber pattern for state changes

### API Communication
- Robust error handling with retry logic
- Abort controller support for request cancellation

### CORS Handling
- HTTP fetch tool calls are proxied server-side via `fetch_url.php` to bypass browser CORS restrictions
- The PHP script uses cURL to fetch the target URL and returns results with `Access-Control-Allow-Origin: *`
- Works from any origin including `file://` protocol

### UI Architecture
- Modular event handling
- Component-based UI structure
- Responsive design with mobile support

## License

MIT License - See `LICENSE` file for details.

## Credits

- Built with modern web technologies (HTML5, CSS3, JavaScript)
- Uses external libraries: Marked.js, Prism.js, KaTeX, Lucide Icons
- Designed with accessibility and responsiveness in mind

## Contributing

While this is primarily a demonstration project, contributions are welcome. Please follow the existing code patterns.

## Support

For issues or questions, please refer to the project documentation or create an issue in the repository.