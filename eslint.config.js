// Shared mutable state and cross-file API for the classic browser scripts.
// Every js/*.js file (except local-engine.js) shares one global scope via
// sequential <script> tags, so names defined in one file are visible in all.
const globals = require('globals');

const projectGlobals = {
  // shared mutable state (declared with let in their home file)
  settings: 'writable',
  chats: 'writable',
  currentChatId: 'writable',
  abortController: 'writable',
  isGenerating: 'writable',
  githubToken: 'writable',
  pendingAttachment: 'writable',
  pendingCharts: 'writable',
  pendingClipboard: 'writable',
  pendingDownloads: 'writable',
  chatSearchState: 'writable',
  pausedAgentState: 'writable',
  userScrolledAway: 'writable',
  // declarative tables and helpers (constants.js)
  PERSONAS: 'readonly',
  AVAILABLE_TOOLS: 'readonly',
  LOCAL_TOOLS: 'readonly',
  CONTEXT_LIMITS: 'readonly',
  MODEL_PRICING: 'readonly',
  AUTO_COMPACT_THRESHOLD: 'readonly',
  CONTEXT_WINDOW_MARGIN: 'readonly',
  MAX_TOOL_LOOP: 'readonly',
  MAX_TOOL_LOOP_RESUME: 'readonly',
  MAX_TOOL_RESULT_CHARS: 'readonly',
  elements: 'readonly',
  getInitialProxyUrl: 'readonly',
  getAllTools: 'readonly',
  getContextLimit: 'readonly',
  // storage.js
  migrateOpencodeKeys: 'readonly',
  llmStoreGet: 'readonly',
  llmStoreSet: 'readonly',
  llmStoreDelete: 'readonly',
  llmStoreListKeys: 'readonly',
  globalStoreGet: 'readonly',
  globalStoreSet: 'readonly',
  globalStoreDelete: 'readonly',
  globalStoreListKeys: 'readonly',
  globalStoreClear: 'readonly',
  noteStoreGet: 'readonly',
  noteStoreSet: 'readonly',
  noteStoreDelete: 'readonly',
  noteStoreListKeys: 'readonly',
  // utils.js (rendering, encoding, TTS)
  escapeHtml: 'readonly',
  stripHtml: 'readonly',
  mdToHtml: 'readonly',
  highlightCodeBlocks: 'readonly',
  drawChart: 'readonly',
  estimateTokens: 'readonly',
  xorHexEncode: 'readonly',
  xorHexDecode: 'readonly',
  obfuscateSecret: 'readonly',
  deobfuscateSecret: 'readonly',
  SECRET_PREFIX: 'readonly',
  getAvailableVoices: 'readonly',
  speakText: 'readonly',
  stopSpeaking: 'readonly',
  scrollToBottom: 'readonly',
  tryAutoScroll: 'readonly',
  setupAutoScroll: 'readonly',
  showToast: 'readonly',
  showConfirm: 'readonly',
  parseProxyResponse: 'readonly',
  // chat.js
  saveSettings: 'readonly',
  saveChats: 'readonly',
  getActiveChat: 'readonly',
  getMessageCountWithoutSystem: 'readonly',
  createNewChat: 'readonly',
  selectChat: 'readonly',
  clearCurrentChat: 'readonly',
  renderChatList: 'readonly',
  renderChatFeed: 'readonly',
  renderMemoryPanel: 'readonly',
  renderCustomToolsList: 'readonly',
  refreshMemoryPanelIfOpen: 'readonly',
  exportCurrentChat: 'readonly',
  triggerSend: 'readonly',
  handleTextareaAutoGrow: 'readonly',
  handleFileAttach: 'readonly',
  clearPendingAttachmentUI: 'readonly',
  startEditingTitle: 'readonly',
  showCustomToolEditor: 'readonly',
  toggleSidebar: 'readonly',
  adjustResponsiveLayout: 'readonly',
  updateInputUIState: 'readonly',
  // tools.js dispatch + UI (handlers live in js/tools-*.js)
  executeToolCall: 'readonly',
  appendToolCallUI: 'readonly',
  updateToolCallUI: 'readonly',
  handleFetchUrl: 'readonly',
  handleSearchWeb: 'readonly',
  handleReadRss: 'readonly',
  handleStoreValue: 'readonly',
  handleReadValue: 'readonly',
  handleListStoredKeys: 'readonly',
  handleDeleteValue: 'readonly',
  handleRemember: 'readonly',
  handleRecall: 'readonly',
  handleForget: 'readonly',
  handleForgetAll: 'readonly',
  handleNotesCreate: 'readonly',
  handleNotesRead: 'readonly',
  handleNotesList: 'readonly',
  handleNotesDelete: 'readonly',
  handleGitHubGetContents: 'readonly',
  handleGitHubCreateOrUpdateFile: 'readonly',
  handleGitHubCreatePr: 'readonly',
  handleGitHubCreateIssue: 'readonly',
  handleCompact: 'readonly',
  handleCalculate: 'readonly',
  handleGetCurrentTime: 'readonly',
  handleSendNotification: 'readonly',
  handleSetSetting: 'readonly',
  handleClipboardWrite: 'readonly',
  handleGenerateChart: 'readonly',
  handleSaveFile: 'readonly',
  // sender.js agent loop
  triggerSendAPI: 'readonly',
  triggerCompact: 'readonly',
  stopGenerating: 'readonly',
  // events.js search
  performChatSearch: 'readonly',
  performGlobalChatSearch: 'readonly',
  clearChatSearch: 'readonly',
  clearGlobalChatSearch: 'readonly',
  navigateChatSearch: 'readonly',
  // host-injected (see README environment injection)
  MISTRAL_PROXY_URL: 'readonly',
  // CDN libraries (index.html)
  lucide: 'readonly',
  marked: 'readonly',
  Prism: 'readonly',
  katex: 'readonly',
  renderMathInElement: 'readonly',
};

module.exports = [
  { ignores: ['node_modules/**', 'test-results/**', 'playwright-report/**'] },
  {
    // Classic app scripts: one shared global scope, no modules.
    files: ['js/*.js'],
    ignores: ['js/local-engine.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...projectGlobals },
    },
    rules: {
      'no-undef': 'error',
      // 'local' ignores the intentional cross-file top-level API surface
      // and only checks function-scoped variables. no-redeclare is off:
      // the shared global scope spans files, which per-file linting
      // cannot model (constants.js legitimately re-declares global names).
      'no-unused-vars': ['error', { vars: 'local', args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    // ES module loaded via importmap (served origins only).
    files: ['js/local-engine.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    // Cloudflare Worker entrypoint.
    files: ['worker.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    // Node-side: Playwright config, tests, and this file. Test callbacks
    // passed to page.evaluate/addInitScript run in the browser, so browser
    // and app globals are visible alongside node globals.
    files: ['tests/**/*.js', 'playwright.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser, ...projectGlobals },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    },
  },
];
