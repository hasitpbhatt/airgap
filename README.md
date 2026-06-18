# OpenCode Chat - Developer LLM Interface

A gorgeous, developer-centric interface for talking to LLMs. Select a teaching persona or customize configuration in the sidebar settings to get started.

## Features

- **Multiple Teaching Personas**: General Assistant, Explain Like I'm 10, Deep Dive Expert, First Principles Thinker, Socratic Tutor, and Custom System Prompt
- **Configurable API Settings**: Proxy URL, API Key, Model Selection, and Turns Limit
- **Chat Management**: Create, rename, export, and clear conversations
- **Rich Text Editing**: Markdown support with syntax highlighting and LaTeX equations
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Advanced UI**: Modern glassmorphism design with smooth animations

## Architecture

Single-page application with all logic in a self-contained `app.js` file and styling in `style.css`. No build tooling required — just open `index.html` in a browser.

## Installation

This project is a single-page application that doesn't require traditional installation. Simply open `index.html` in your web browser.

## Usage

1. **Open the application**: Open `index.html` in your browser
2. **Start a conversation**: Click "New Conversation" or select a persona from the welcome screen
3. **Configure settings**: Click the settings icon in the sidebar to adjust API settings
4. **Chat with AI**: Type your message and press Enter or click the send button

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
- **Proxy URL**: The LLM API endpoint (default: quiz-ai-proxy.hasit-p-bhatt.workers.dev/)
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
├── app.js            # Application logic
├── README.md         # This file
└── LICENSE           # License
```

## Technical Details

### State Management
- Centralized state store with reactive updates
- Automatic localStorage persistence
- Subscriber pattern for state changes

### API Communication
- Robust error handling with retry logic
- Abort controller support for request cancellation
- Type-safe API calls

### UI Architecture
- Modular event handling
- Component-based UI structure
- Responsive design with mobile support

## License

MIT License - See `LICENSE` file for details.

## Credits

- Built with modern web technologies (HTML5, CSS3, JavaScript/TypeScript)
- Uses external libraries: Marked.js, Prism.js, KaTeX, Lucide Icons
- Designed with accessibility and responsiveness in mind

## Refactoring

This project was recently refactored from a monolithic JavaScript architecture to a modular TypeScript-based system. The refactoring included:

- Splitting 1041-line `app.js` into focused modules
- Adding comprehensive TypeScript type definitions
- Implementing centralized state management
- Extracting API communication logic
- Creating unit tests and verification scripts
- Maintaining full backward compatibility

See `REFACTORING_SUMMARY.md` for detailed documentation of the refactoring process.

## Contributing

While this is primarily a demonstration project, contributions are welcome. Please follow the existing code patterns and ensure TypeScript type safety throughout any changes.

## Support

For issues or questions, please refer to the project documentation or create an issue in the repository.