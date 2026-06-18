# OpenCode Chat - Developer LLM Interface

A gorgeous, developer-centric interface for talking to LLMs with **agentic tool calling**. Select a teaching persona or customize configuration in the sidebar settings to get started.

## Features

- **Agentic Tool Calling**: The LLM can fetch live data from the web using the `fetch_url` tool, behave as an agent, and use results to answer your questions
- **Multiple Teaching Personas**: General Assistant, Explain Like I'm 10, Deep Dive Expert, First Principles Thinker, Socratic Tutor, and Custom System Prompt
- **Configurable API Settings**: Proxy URL, Tool Fetch URL, API Key, Model Selection, and Turns Limit
- **Chat Management**: Create, rename, export, and clear conversations
- **Rich Text Editing**: Markdown support with syntax highlighting and LaTeX equations
- **Responsive Design**: Works seamlessly on desktop and mobile
- **File:// Protocol Support**: Opens directly from the filesystem — no web server required
- **Advanced UI**: Modern glassmorphism design with smooth animations

## Architecture

Single-page application with all logic in a self-contained `app.js` file and styling in `style.css`. No build tooling required — just open `index.html` in a browser. Tool fetch requests are proxied through `fetch_url.php` to bypass CORS (or any custom endpoint you configure).

## Installation

This project is a single-page application that doesn't require traditional installation. Simply open `index.html` in your web browser.

## Usage

1. **Open the application**: Open `index.html` in your browser
2. **Start a conversation**: Click "New Conversation" or select a persona from the welcome screen
3. **Configure settings**: Click the settings icon in the sidebar to adjust API and tool fetch settings
4. **Chat with AI**: Type your message and press Enter or click the send button
5. **Ask for live data**: Try "What's on Hacker News?" — the LLM will call the fetch tool automatically

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
- **LLM API Proxy URL**: The Mistral API proxy endpoint (default: quiz-ai-proxy.hasit-p-bhatt.workers.dev/)
- **Tool Fetch Proxy URL**: Endpoint for proxying fetch_url tool calls (default: fetch_url.php)
- **API Key**: Optional authentication token
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
├── app.js            # Application logic (single file)
├── fetch_url.php     # CORS proxy for tool fetch calls
├── README.md         # This file
└── LICENSE           # License
```

## Technical Details

### Agentic Tool Loop
- The LLM receives `AVAILABLE_TOOLS` definitions with each API call
- When the model responds with `tool_calls`, the app executes each tool (e.g., `fetch_url`) via the configured proxy
- Tool results are appended to the conversation and the API is called again
- The loop continues up to `MAX_TOOL_LOOP` (10) iterations until a final response is generated
- Tool calls are shown in real-time with dashed-border bubbles above the typing indicator

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