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
      description: 'Fetch and read the content from any URL on the web. Use this to get the latest information, read documentation, access web pages, or retrieve data from APIs.',
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
  }
];

const MAX_TOOL_LOOP = 10;

// State Variables
let chats = [];
let currentChatId = null;
let settings = {
  proxyUrl: 'https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/',
  fetchUrl: '',
  apiKey: '',
  modelName: 'mistral-small-latest',
  useMaxTurns: false,
  maxTurns: 5,
  currentPersona: 'general',
  customSystemPrompt: ''
};
let abortController = null;
let isGenerating = false;

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
  sendBtn: document.getElementById('send-btn')
};

// Check if there is an environment/host injected proxy URL fallback
const getInitialProxyUrl = () => {
  if (typeof MISTRAL_PROXY_URL !== 'undefined' && MISTRAL_PROXY_URL) {
    return MISTRAL_PROXY_URL;
  }
  return 'https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/';
};
