// TypeScript type definitions for state management
export interface Chat {
  id: string;
  title: string;
  persona: string;
  systemPrompt: string;
  messages: Message[];
  turnCount: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  isError?: boolean;
  isStopped?: boolean;
}

export interface Settings {
  proxyUrl: string;
  apiKey: string;
  modelName: string;
  useMaxTurns: boolean;
  maxTurns: number;
  currentPersona: string;
  customSystemPrompt: string;
}

export interface State {
  chats: Chat[];
  currentChatId: string | null;
  settings: Settings;
  isGenerating: boolean;
  abortController: AbortController | null;
}

export interface UIActions {
  createNewChat(initialPersona?: string): void;
  selectChat(id: string): void;
  renderChatList(): void;
  renderChatFeed(): void;
  updateInputUIState(): void;
  handleTextareaAutoGrow(): void;
  startEditingTitle(): void;
  clearCurrentChat(): void;
  exportCurrentChat(): void;
  copyMessageText(button: HTMLElement, index: number): void;
  deleteMessage(index: number): void;
  editUserMessage(index: number): void;
  retryMessage(errorIndex: number): void;
  selectPersonaForNewChat(personaName: string): void;
  copyCodeSnippet(button: HTMLElement): void;
  highlightCodeBlocks(): void;
  scrollToBottom(): void;
  toggleSidebar(forceState?: boolean): void;
  adjustResponsiveLayout(): void;
  triggerSend(): Promise<void>;
  triggerSendAPI(): Promise<void>;
  stopGenerating(): void;
  setGeneratingState(generating: boolean): void;
}

export interface APIService {
  sendMessage(messages: Message[], abortController: AbortController): Promise<string>;
  retryMessage(messages: Message[], abortController: AbortController): Promise<string>;
  getInitialProxyUrl(): string;
}

export interface Utils {
  escapeHtml(text: string): string;
  debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void;
  throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void;
  generateId(): string;
  isValidUrl(string: string): boolean;
  formatTimeAgo(date: Date): string;
}

export interface Persona {
  label: string;
  icon: string;
  system: string;
}

export interface DOMElements {
  sidebar: HTMLElement;
  sidebarToggleBtn: HTMLElement;
  closeSidebarBtn: HTMLElement;
  sidebarOverlay: HTMLElement;
  newChatBtn: HTMLElement;
  chatList: HTMLElement;
  settingsTrigger: HTMLElement;
  settingsChevron: HTMLElement;
  settingsPanel: HTMLElement;
  proxyUrlInput: HTMLInputElement;
  apiKeyInput: HTMLInputElement;
  modelSelect: HTMLSelectElement;
  customModelGroup: HTMLElement;
  modelNameInput: HTMLInputElement;
  enableTurnsLimitCheckbox: HTMLInputElement;
  maxTurnsInput: HTMLInputElement;
  personaSelect: HTMLSelectElement;
  systemPromptTextarea: HTMLTextAreaElement;
  activeChatTitle: HTMLElement;
  editTitleBtn: HTMLElement;
  clearChatBtn: HTMLElement;
  exportChatBtn: HTMLElement;
  chatFeedContainer: HTMLElement;
  chatFeed: HTMLElement;
  limitReachedBanner: HTMLElement;
  chatTextarea: HTMLTextAreaElement;
  inputInfo: HTMLElement;
  stopGenBtn: HTMLElement;
  sendBtn: HTMLElement;
}