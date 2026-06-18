// Simple test to verify the refactored functionality
import state from './state.js';
import api from './api.js';
import { PERSONAS, escapeHtml, generateId, isValidUrl } from './utils.js';

describe('State Management', () => {
  test('should initialize with default state', () => {
    const initialState = state.getState();
    expect(initialState.settings.proxyUrl).toBe('https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/');
    expect(initialState.chats).toEqual([]);
    expect(initialState.currentChatId).toBeNull();
  });

  test('should update state correctly', () => {
    state.updateState({ isGenerating: true });
    expect(state.getState().isGenerating).toBe(true);
  });
});

describe('Utils', () => {
  test('should escape HTML correctly', () => {
    const input = '<script>alert("xss")</script>';
    const escaped = escapeHtml(input);
    expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  test('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(id1).toContain('id_');
  });

  test('should validate URLs correctly', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:8080')).toBe(true);
    expect(isValidUrl('invalid-url')).toBe(false);
  });
});

describe('API Service', () => {
  test('should get initial proxy URL', () => {
    const proxyUrl = api.getInitialProxyUrl();
    expect(proxyUrl).toBe('https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/');
  });
});

describe('Personas', () => {
  test('should have all required personas', () => {
    expect(PERSONAS.general).toBeDefined();
    expect(PERSONAS.child).toBeDefined();
    expect(PERSONAS.deep).toBeDefined();
    expect(PERSONAS['first-principles']).toBeDefined();
    expect(PERSONAS.socratic).toBeDefined();
    expect(PERSONAS.custom).toBeDefined();
  });

  test('should have persona properties', () => {
    const persona = PERSONAS.general;
    expect(persona.label).toBe('General Assistant');
    expect(persona.icon).toBe('🤖');
    expect(persona.system).toBeDefined();
  });
});

// Mock DOM elements for testing
const mockElements = {
  sidebar: document.createElement('div'),
  sidebarToggleBtn: document.createElement('button'),
  closeSidebarBtn: document.createElement('button'),
  sidebarOverlay: document.createElement('div'),
  newChatBtn: document.createElement('button'),
  chatList: document.createElement('div'),
  settingsTrigger: document.createElement('button'),
  settingsChevron: document.createElement('i'),
  settingsPanel: document.createElement('div'),
  proxyUrlInput: document.createElement('input'),
  apiKeyInput: document.createElement('input'),
  modelSelect: document.createElement('select'),
  customModelGroup: document.createElement('div'),
  modelNameInput: document.createElement('input'),
  enableTurnsLimitCheckbox: document.createElement('input'),
  maxTurnsInput: document.createElement('input'),
  personaSelect: document.createElement('select'),
  systemPromptTextarea: document.createElement('textarea'),
  activeChatTitle: document.createElement('h1'),
  editTitleBtn: document.createElement('button'),
  clearChatBtn: document.createElement('button'),
  exportChatBtn: document.createElement('button'),
  chatFeedContainer: document.createElement('div'),
  chatFeed: document.createElement('div'),
  limitReachedBanner: document.createElement('div'),
  chatTextarea: document.createElement('textarea'),
  inputInfo: document.createElement('div'),
  stopGenBtn: document.createElement('button'),
  sendBtn: document.createElement('button')
};

// Mock the DOM elements in the UI module
Object.entries(mockElements).forEach(([key, element]) => {
  Object.defineProperty(mockElements, key, {
    get: () => element
  });
});

// Run tests if in a browser environment
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // Initialize tests
    console.log('Running tests...');
    
    // Simple test runner
    const runTests = async () => {
      const tests = [];
      
      // State management tests
      const initialState = state.getState();
      tests.push({
        name: 'State initialization',
        passed: initialState.settings.proxyUrl === 'https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/'
      });
      
      // Utils tests
      const htmlTest = escapeHtml('<script>test</script>') === '&lt;script&gt;test&lt;/script&gt;';
      tests.push({
        name: 'HTML escaping',
        passed: htmlTest
      });
      
      const idTest1 = generateId();
      const idTest2 = generateId();
      tests.push({
        name: 'Unique ID generation',
        passed: idTest1 !== idTest2 && idTest1.startsWith('id_')
      });
      
      const urlTest1 = isValidUrl('https://example.com');
      const urlTest2 = isValidUrl('invalid-url');
      tests.push({
        name: 'URL validation',
        passed: urlTest1 && !urlTest2
      });
      
      const personaTest = Object.keys(PERSONAS).length === 6;
      tests.push({
        name: 'Persona count',
        passed: personaTest
      });
      
      // API tests
      const apiTest = api.getInitialProxyUrl() === 'https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/';
      tests.push({
        name: 'API proxy URL',
        passed: apiTest
      });
      
      // Summary
      const passed = tests.filter(t => t.passed).length;
      const total = tests.length;
      
      console.log(`Tests passed: ${passed}/${total}`);
      tests.forEach(test => {
        console.log(`${test.passed ? '✓' : '✗'} ${test.name}`);
      });
      
      if (passed === total) {
        console.log('All tests passed!');
      } else {
        console.error('Some tests failed!');
      }
    };
    
    runTests();
  });
}