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
          url: { type: 'string', description: 'The complete URL (including protocol, e.g. https://) to fetch' },
          offset: { type: 'number', description: 'Optional character offset to start reading from. Use with limit to read large content in chunks.' },
          limit: { type: 'number', description: 'Optional max characters to return. Omit to get content from offset to end.' }
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
      description: 'Get the current date, time, and timezone. ALWAYS call this tool when a user asks about "today", "now", "last week", "tomorrow", or any relative date/time — your training data has a fixed cutoff and you cannot know the current date otherwise.',
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
      description: 'Search the web for a query and return a list of results (titles, URLs, snippets). Tries SearXNG (public instances, direct from browser) and DDG Instant Answer API (direct, no proxy) first, then falls back to proxy-based engines (DuckDuckGo Lite, Ecosia, Bing, Brave).',
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
      description: 'Create a file with the given content. The app automatically shows a Download button in the chat — the user can click it to save. STRICT RULES: (1) NEVER use the word "download" in your response. (2) NEVER mention any URL, link, or hosting service. (3) Just confirm the file was saved — e.g. "Saved as resume.txt". (4) Call this tool directly with the filename and content; do NOT fabricate download URLs.',
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
      name: 'github_get_contents',
      description: 'Read a file or directory from a GitHub repository. Returns the file content (decoded from base64), SHA (needed for updating), size, and type. Use the SHA from this tool when calling github_create_or_update_file on an existing file. The user has already configured a GitHub token in Settings — authentication is handled automatically.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner (user or org)' },
          repo: { type: 'string', description: 'Repository name' },
          path: { type: 'string', description: 'File path within the repository, e.g. "README.md" or "src/main.js"' },
          ref: { type: 'string', description: 'Optional branch name, commit SHA, or tag. Defaults to the repository\'s default branch.' },
          offset: { type: 'number', description: 'Optional character offset to start reading from. Use with limit to read large files in chunks.' },
          limit: { type: 'number', description: 'Optional max characters to return. Omit to get content from offset to end.' }
        },
        required: ['owner', 'repo', 'path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'github_create_or_update_file',
      description: 'Create a new file or update an existing file in a GitHub repository. When updating an existing file, pass the sha from github_get_contents to avoid overwrite conflicts. The content is plain text — the tool base64-encodes it automatically. The branch parameter is auto-created if it does not exist. The user has already configured a GitHub token in Settings. Use this together with github_get_contents and github_create_pr for a complete commit-and-PR workflow.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner (user or org)' },
          repo: { type: 'string', description: 'Repository name' },
          path: { type: 'string', description: 'File path within the repository' },
          content: { type: 'string', description: 'The new file content (plain text)' },
          message: { type: 'string', description: 'Commit message' },
          branch: { type: 'string', description: 'Branch to commit to. Auto-created from default branch if it does not exist.' },
          sha: { type: 'string', description: 'Required when updating an existing file — the SHA of the file\'s current blob (returned by github_get_contents). Omit when creating a new file.' }
        },
        required: ['owner', 'repo', 'path', 'content', 'message', 'branch']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'github_create_pr',
      description: 'Create a pull request in a GitHub repository. The user has already configured a GitHub token in Settings — authentication is handled automatically. Use after github_create_or_update_file to create a PR for your committed changes. Returns the PR URL, number, and state.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner (user or org)' },
          repo: { type: 'string', description: 'Repository name' },
          title: { type: 'string', description: 'PR title' },
          head: { type: 'string', description: 'Source branch (the branch with changes)' },
          base: { type: 'string', description: 'Target branch (usually "main" or "master")' },
          body: { type: 'string', description: 'Optional PR description / body text' },
          draft: { type: 'boolean', description: 'Create as a draft PR (default: false)' }
        },
        required: ['owner', 'repo', 'title', 'head', 'base']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'github_create_issue',
      description: 'Create an issue in a GitHub repository. The user has already configured a GitHub token in Settings — authentication is handled automatically. Returns the issue URL and number.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner (user or org)' },
          repo: { type: 'string', description: 'Repository name' },
          title: { type: 'string', description: 'Issue title' },
          body: { type: 'string', description: 'Optional issue body / description' },
          labels: { type: 'array', items: { type: 'string' }, description: 'Optional labels to apply' },
          assignees: { type: 'array', items: { type: 'string' }, description: 'Optional usernames to assign' }
        },
        required: ['owner', 'repo', 'title']
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

const CONTEXT_LIMITS = {
  'mistral-small-latest': 32768,
  'mistral-medium-latest': 32768,
  'mistral-large-latest': 32768,
  'codestral-latest': 32768,
  'ministral-14b-2512': 32768,
};

const MODEL_PRICING = {
  'mistral-small-latest':   { input: 0.001,  output: 0.003 },
  'mistral-medium-latest':  { input: 0.002,  output: 0.006 },
  'mistral-large-latest':   { input: 0.003,  output: 0.009 },
  'codestral-latest':       { input: 0.001,  output: 0.003 },
  'ministral-14b-2512':     { input: 0.0002, output: 0.0006 },
};

const MAX_TOOL_LOOP = 5;
const MAX_TOOL_LOOP_RESUME = 5;
const AUTO_COMPACT_THRESHOLD = 15;
const MAX_TOOL_RESULT_CHARS = 12000;
var CONTEXT_WINDOW_MARGIN = 0.85;

// State Variables
let chats = [];
let currentChatId = null;
let githubToken = '';
let settings = {
  proxyUrl: 'https://api.mistral.ai/v1/chat/completions',
  fetchUrl: 'https://airgap-fetch.gitub.workers.dev/',
  backupFetchUrl: '',
  apiKey: '',
  injectedKey: false,
  modelName: 'mistral-small-latest',
  useMaxTurns: false,
  maxTurns: 5,
  useMaxToolLoops: true,
  maxToolLoops: 5,
  currentPersona: 'general',
  customSystemPrompt: '',
  customTools: []
};
let abortController = null;
let isGenerating = false;
let pausedAgentState = null;
let continueResolve = null;
let pendingDownloads = [];
let pendingCharts = [];
let pendingClipboard = [];
let pendingAttachment = null; // { name, type, data, size }
let userScrolledAway = false;

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
  backupFetchUrlInput: document.getElementById('backup-fetch-url'),
  apiKeyInput: document.getElementById('api-key'),
  modelSelect: document.getElementById('model-select'),
  customModelGroup: document.getElementById('custom-model-group'),
  modelNameInput: document.getElementById('model-name'),
  enableTurnsLimitCheckbox: document.getElementById('enable-turns-limit'),
  maxTurnsInput: document.getElementById('max-turns'),
  enableToolLoopsLimitCheckbox: document.getElementById('enable-tool-loops-limit'),
  maxToolLoopsInput: document.getElementById('max-tool-loops'),
  personaSelect: document.getElementById('persona-select'),
  systemPromptTextarea: document.getElementById('system-prompt'),
  githubTokenInput: document.getElementById('github-token'),

  // Main Chat UI
  activeChatTitle: document.getElementById('active-chat-title'),
  editTitleBtn: document.getElementById('edit-title-btn'),
  searchChatBtn: document.getElementById('search-chat-btn'),
  clearChatBtn: document.getElementById('clear-chat-btn'),
  exportChatBtn: document.getElementById('export-chat-btn'),
  chatFeedContainer: document.getElementById('chat-feed-container'),
  chatFeed: document.getElementById('chat-feed'),

  // Search bar
  chatSearchBar: document.getElementById('chat-search-bar'),
  chatSearchInput: document.getElementById('chat-search-input'),
  chatSearchPrev: document.getElementById('chat-search-prev'),
  chatSearchNext: document.getElementById('chat-search-next'),
  chatSearchClose: document.getElementById('chat-search-close'),
  chatSearchCounter: document.getElementById('chat-search-counter'),

  // Footer Input
  limitReachedBanner: document.getElementById('limit-reached-banner'),
  slashMenu: document.getElementById('slash-menu'),
  chatTextarea: document.getElementById('chat-textarea'),
  inputInfo: document.getElementById('input-info'),
  micBtn: document.getElementById('mic-btn'),
  stopGenBtn: document.getElementById('stop-gen-btn'),
  continueGenBtn: document.getElementById('continue-gen-btn'),
  sendBtn: document.getElementById('send-btn'),

  // Memory panel
  memoryTriggerBtn: document.getElementById('memory-trigger'),
  memoryChevron: document.getElementById('memory-chevron'),
  memoryPanel: document.getElementById('memory-panel'),
  memoryList: document.getElementById('memory-list'),
  memorySearch: document.getElementById('memory-search'),
  clearMemoryBtn: document.getElementById('clear-memory-btn'),

  // Global chat search
  chatSearchGlobalInput: document.getElementById('chat-search-global-input'),
  chatSearchGlobalClear: document.getElementById('chat-search-global-clear'),
  chatSearchGlobalResults: document.getElementById('chat-search-global-results'),

  // Custom tools
  customToolsContainer: document.getElementById('custom-tools-container'),
  customToolsList: document.getElementById('custom-tools-list'),
  addCustomToolBtn: document.getElementById('add-custom-tool-btn'),

  // File attachment
  fileInput: document.getElementById('file-input'),
  attachFileBtn: document.getElementById('attach-file-btn'),
  fileChip: document.getElementById('file-chip'),
  fileChipName: document.getElementById('file-chip-name'),
  fileChipSize: document.getElementById('file-chip-size'),
  fileChipRemove: document.getElementById('file-chip-remove'),
  dropOverlay: document.getElementById('drop-overlay')
};

// Check if there is an environment/host injected proxy URL fallback
const getInitialProxyUrl = () => {
  if (typeof MISTRAL_PROXY_URL !== 'undefined' && MISTRAL_PROXY_URL) {
    return MISTRAL_PROXY_URL;
  }
  return 'https://api.mistral.ai/v1/chat/completions';
};
