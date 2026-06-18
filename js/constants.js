// System Constants
const PERSONAS = {
  general: {
    label: 'General Assistant',
    icon: '🤖',
    system: 'You are a helpful, precise, and friendly AI assistant. Answer the user\'s questions thoroughly and accurately.'
  },
  child: {
    label: 'Like I\'m 10',
    icon: '🧒',
    system: 'You are explaining to a 10-year-old child. Use simple words, fun analogies, and everyday examples. No jargon. Keep it engaging and easy to understand.'
  },
  deep: {
    label: 'Deep Dive',
    icon: '🔬',
    system: 'You are a domain expert. Provide deep, nuanced insights and connect the concept to advanced research, industry practices, or expert-level perspectives. Assume the student has strong foundational knowledge.'
  },
  'first-principles': {
    label: 'First Principles',
    icon: '🧠',
    system: 'You are a first-principles thinker. Break the concept down to its most fundamental truths and derive the explanation from base principles. Use logical reasoning, and where applicable, mathematical or formal foundations. Assume the student is comfortable with abstract thinking.'
  },
  socratic: {
    label: 'Socratic Tutor',
    icon: '❓',
    system: 'You are a Socratic tutor. Do not give direct answers. Instead, ask guiding questions that lead the student to discover the concept themselves. Challenge their assumptions and help them reason step by step.'
  },
  custom: {
    label: 'Custom Persona',
    icon: '⚙️',
    system: ''
  }
};

// Tool Definitions for Agentic Behaviour
const AVAILABLE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'fetch_url',
      description: 'Fetch and read the content from any URL on the web. Content is also stored in conversation memory (key: _fetched_<encodedUrl>) for later re-reading via read_value without re-fetching. NOTE: Google blocks automated requests (HTTP 429). For web search, use the search_web tool.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The complete URL (including protocol, e.g. https://) to fetch' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'store_value',
      description: 'Store a value persistently in the conversation\'s local storage memory. Use this to remember facts, save fetched content for later reference, or maintain state across responses.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'A unique key to store the value under' },
          value: { type: 'string', description: 'The value to store' }
        },
        required: ['key', 'value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_value',
      description: 'Read a previously stored value from the conversation\'s local storage memory.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The key to retrieve' }
        },
        required: ['key']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_stored_keys',
      description: 'List all keys currently stored in this conversation\'s local storage memory.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_value',
      description: 'Delete a previously stored value from the conversation\'s local storage memory.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The key to delete' }
        },
        required: ['key']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'compact',
      description: 'Compress the conversation history by providing a concise summary of everything discussed so far. Call this when the conversation is getting long to save context space. Preserve all key facts, decisions, and context in the summary.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'A concise summary of the entire conversation so far, preserving all key facts, decisions, and context.' }
        },
        required: ['summary']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current date, time, and timezone. Use this when you need to know what time it is, what the date is, or what day of the week it is.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Evaluate a mathematical expression. Use this for reliable arithmetic, conversions, or any computation instead of guessing. Supports +, -, *, /, %, parentheses, Math.* functions, and basic trigonometry.',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'The mathematical expression to evaluate, e.g. "2 * (3 + 4)", "Math.sqrt(144)", "150 * 0.15" (for 15% tip)' }
        },
        required: ['expression']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the web for a query and return a list of results (titles, URLs, snippets). Queries multiple search engines in parallel (DuckDuckGo, Brave, Ecosia, Bing) and returns results from the first that responds. For fetching a specific URL, use fetch_url instead.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'remember',
      description: 'Store a value in your global long-term memory. Unlike store_value which is per-conversation, remember persists across all your conversations. Use this to remember user preferences, identity, past decisions, project context, or any information that should be available in future sessions.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'A unique key to store the value under, e.g. "user_name", "preferred_language", "project_foo_context"' },
          value: { type: 'string', description: 'The value to remember' }
        },
        required: ['key', 'value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'recall',
      description: 'Retrieve a value from your global long-term memory. Searches by exact key first, then returns all keys that contain the keyword. Use this to remember information across conversations.',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'The exact key or a search keyword to look up in memory' }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'forget',
      description: 'Delete a specific key from your global long-term memory.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The key to delete from memory' }
        },
        required: ['key']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'forget_all',
      description: 'Delete ALL keys from your global long-term memory. Use with caution — this permanently removes everything you remember across all conversations.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_notification',
      description: 'Send a system/desktop notification to the user. Use this to alert the user about long-running tasks, reminders, or important updates even when they are looking at other tabs.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Notification title' },
          body: { type: 'string', description: 'Optional notification body text' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'notes_create',
      description: 'Create or overwrite a note. Notes are saved globally and persist across conversations — use them for drafting ideas, saving information, or keeping a journal.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'A unique key/name for the note, e.g. "shopping_list", "meeting_notes_2024-01-01"' },
          content: { type: 'string', description: 'The content of the note' }
        },
        required: ['key', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'notes_read',
      description: 'Read a single note by its key.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The key of the note to read' }
        },
        required: ['key']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'notes_list',
      description: 'List all note keys, optionally filtered by a search query. Returns matching keys and their content previews.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional search term to filter note keys by (case-insensitive substring match)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'notes_delete',
      description: 'Delete a single note by its key.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The key of the note to delete' }
        },
        required: ['key']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_setting',
      description: 'Update a chat setting: proxyUrl (the LLM API endpoint), modelName (e.g. "mistral-small-latest", "gpt-4"), or persona (one of: "general", "child", "deep", "first-principles", "socratic", "custom").',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', enum: ['proxyUrl', 'modelName', 'persona'], description: 'The setting to change' },
          value: { type: 'string', description: 'The new value for the setting' }
        },
        required: ['key', 'value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'clipboard_write',
      description: 'Write text to the user\'s clipboard. The clipboard write requires a user click (shows a click-to-copy button in the chat).',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text content to copy to clipboard' }
        },
        required: ['text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_chart',
      description: 'Generate a chart (bar, line, or pie) and render it visually. Use this to visualize data, trends, comparisons, or distributions.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['bar', 'line', 'pie'], description: 'Chart type' },
          title: { type: 'string', description: 'Chart title' },
          labels: { type: 'array', items: { type: 'string' }, description: 'Labels for each data point or slice' },
          datasets: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, data: { type: 'array', items: { type: 'number' } }, color: { type: 'string' } } }, description: 'One or more data series. Each has a label, an array of numbers, and an optional hex color.' }
        },
        required: ['type', 'title', 'labels', 'datasets']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'save_file',
      description: 'Create a file with the given content and offer it as a download. Use this to generate scripts, documents, data exports, or any file the user wants to save locally.',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'The filename with extension, e.g. "script.py", "report.md", "data.json"' },
          content: { type: 'string', description: 'The full content of the file' }
        },
        required: ['filename', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_rss',
      description: 'Fetch and parse an RSS or Atom feed. Use this to read news feeds, blog updates, podcast episodes, or any syndicated content. Returns a list of recent items with title, link, publication date, and summary.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL of the RSS or Atom feed' },
          limit: { type: 'number', description: 'Maximum number of items to return (default 10, max 50)' }
        },
        required: ['url']
      }
    }
  }
];

const MAX_TOOL_LOOP = 10;
const AUTO_COMPACT_THRESHOLD = 15;

// State Variables
let chats = [];
let currentChatId = null;
let settings = {
  proxyUrl: 'https://api.mistral.ai/v1/chat/completions',
  fetchUrl: '',
  apiKey: '',
  injectedKey: false,
  modelName: 'mistral-small-latest',
  useMaxTurns: false,
  maxTurns: 5,
  currentPersona: 'general',
  customSystemPrompt: ''
};
let abortController = null;
let isGenerating = false;
let pendingDownloads = [];
let pendingCharts = [];
let pendingClipboard = [];

// DOM Elements Reference
const elements = {
  sidebar: document.getElementById('sidebar'),
  sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
  closeSidebarBtn: document.getElementById('close-sidebar-btn'),
  sidebarOverlay: document.getElementById('sidebar-overlay'),
  newChatBtn: document.getElementById('new-chat-btn'),
  chatList: document.getElementById('chat-list'),

  settingsTrigger: document.getElementById('settings-trigger'),
  settingsChevron: document.getElementById('settings-chevron'),
  settingsPanel: document.getElementById('settings-panel'),

  // Inputs
  proxyUrlInput: document.getElementById('proxy-url'),
  fetchUrlInput: document.getElementById('fetch-url'),
  apiKeyInput: document.getElementById('api-key'),
  modelSelect: document.getElementById('model-select'),
  customModelGroup: document.getElementById('custom-model-group'),
  modelNameInput: document.getElementById('model-name'),
  enableTurnsLimitCheckbox: document.getElementById('enable-turns-limit'),
  maxTurnsInput: document.getElementById('max-turns'),
  personaSelect: document.getElementById('persona-select'),
  systemPromptTextarea: document.getElementById('system-prompt'),

  // Main Chat UI
  activeChatTitle: document.getElementById('active-chat-title'),
  editTitleBtn: document.getElementById('edit-title-btn'),
  clearChatBtn: document.getElementById('clear-chat-btn'),
  exportChatBtn: document.getElementById('export-chat-btn'),
  chatFeedContainer: document.getElementById('chat-feed-container'),
  chatFeed: document.getElementById('chat-feed'),

  // Footer Input
  limitReachedBanner: document.getElementById('limit-reached-banner'),
  chatTextarea: document.getElementById('chat-textarea'),
  inputInfo: document.getElementById('input-info'),
  micBtn: document.getElementById('mic-btn'),
  stopGenBtn: document.getElementById('stop-gen-btn'),
  sendBtn: document.getElementById('send-btn'),

  // Memory panel
  memoryTriggerBtn: document.getElementById('memory-trigger'),
  memoryChevron: document.getElementById('memory-chevron'),
  memoryPanel: document.getElementById('memory-panel'),
  memoryList: document.getElementById('memory-list'),
  memorySearch: document.getElementById('memory-search'),
  clearMemoryBtn: document.getElementById('clear-memory-btn')
};

// Check if there is an environment/host injected proxy URL fallback
const getInitialProxyUrl = () => {
  if (typeof MISTRAL_PROXY_URL !== 'undefined' && MISTRAL_PROXY_URL) {
    return MISTRAL_PROXY_URL;
  }
  return 'https://api.mistral.ai/v1/chat/completions';
};
