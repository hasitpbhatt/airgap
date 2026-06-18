// Simple verification script for the refactored code
import state from './state.js';
import api from './api.js';
import ui from './ui.js';
import { PERSONAS, escapeHtml, generateId, isValidUrl } from './utils.js';

function runVerification() {
  console.log('=== Verification of Refactored Code ===\n');

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: State Management
  totalTests++;
  try {
    const initialState = state.getState();
    if (initialState.settings.proxyUrl === 'https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/' &&
        initialState.chats.length === 0 &&
        initialState.currentChatId === null) {
      console.log('✓ State Management: Initialization correct');
      passedTests++;
    } else {
      console.log('✗ State Management: Initialization failed');
    }
  } catch (error) {
    console.log('✗ State Management: Error -', error.message);
  }

  // Test 2: Utils
  totalTests++;
  try {
    const htmlTest = escapeHtml('<script>alert("xss")</script>') === '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
    const idTest1 = generateId();
    const idTest2 = generateId();
    const uniqueIds = idTest1 !== idTest2 && idTest1.startsWith('id_');
    const urlTest = isValidUrl('https://example.com') && !isValidUrl('invalid-url');
    
    if (htmlTest && uniqueIds && urlTest) {
      console.log('✓ Utils: All utility functions working correctly');
      passedTests++;
    } else {
      console.log('✗ Utils: Some utility functions failed');
    }
  } catch (error) {
    console.log('✗ Utils: Error -', error.message);
  }

  // Test 3: API Service
  totalTests++;
  try {
    const proxyUrl = api.getInitialProxyUrl();
    if (proxyUrl === 'https://quiz-ai-proxy.hasit-p-bhatt.workers.dev/') {
      console.log('✓ API Service: Proxy URL correct');
      passedTests++;
    } else {
      console.log('✗ API Service: Proxy URL incorrect');
    }
  } catch (error) {
    console.log('✗ API Service: Error -', error.message);
  }

  // Test 4: Personas
  totalTests++;
  try {
    const personaKeys = Object.keys(PERSONAS);
    const hasAllPersonas = personaKeys.length === 6 &&
      personaKeys.includes('general') &&
      personaKeys.includes('child') &&
      personaKeys.includes('deep') &&
      personaKeys.includes('first-principles') &&
      personaKeys.includes('socratic') &&
      personaKeys.includes('custom');
    
    if (hasAllPersonas) {
      console.log('✓ Personas: All personas defined correctly');
      passedTests++;
    } else {
      console.log('✗ Personas: Missing some personas');
    }
  } catch (error) {
    console.log('✗ Personas: Error -', error.message);
  }

  // Test 5: State Updates
  totalTests++;
  try {
    state.updateState({ isGenerating: true });
    if (state.getState().isGenerating === true) {
      console.log('✓ State Updates: State updates working correctly');
      passedTests++;
    } else {
      console.log('✗ State Updates: State updates failed');
    }
  } catch (error) {
    console.log('✗ State Updates: Error -', error.message);
  }

  // Test 6: LocalStorage Persistence
  totalTests++;
  try {
    const testChat = {
      id: generateId(),
      title: 'Test Chat',
      persona: 'general',
      systemPrompt: PERSONAS.general.system,
      messages: [],
      turnCount: 0
    };
    
    state.updateState({ chats: [testChat] });
    const savedChats = localStorage.getItem('opencode_chats');
    
    if (savedChats) {
      const parsedChats = JSON.parse(savedChats);
      if (parsedChats.some(chat => chat.id === testChat.id)) {
        console.log('✓ LocalStorage: Persistence working correctly');
        passedTests++;
      } else {
        console.log('✗ LocalStorage: Persistence failed');
      }
    } else {
      console.log('✗ LocalStorage: No data saved');
    }
  } catch (error) {
    console.log('✗ LocalStorage: Error -', error.message);
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Tests passed: ${passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All verification tests passed! The refactored code is working correctly.');
    return true;
  } else {
    console.log('\n❌ Some verification tests failed. Please review the issues above.');
    return false;
  }
}

// Run verification if in browser environment
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    runVerification();
  });
}

export { runVerification };