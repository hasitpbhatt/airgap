// Per-conversation localStorage namespace for LLM storage tools
function getStoragePrefix() {
  return 'llm_store_' + (currentChatId || 'default') + '_';
}

function llmStoreGet(key) {
  return localStorage.getItem(getStoragePrefix() + key);
}

function llmStoreSet(key, value) {
  localStorage.setItem(getStoragePrefix() + key, value);
}

function llmStoreDelete(key) {
  localStorage.removeItem(getStoragePrefix() + key);
}

function llmStoreListKeys() {
  const prefix = getStoragePrefix();
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(prefix)) {
      keys.push(k.slice(prefix.length));
    }
  }
  return keys;
}

// Global (cross-conversation) storage helpers for the recall/remember tools
function globalStoreGet(key) {
  return localStorage.getItem('global_memory_' + key);
}

function globalStoreSet(key, value) {
  localStorage.setItem('global_memory_' + key, value);
}

function globalStoreDelete(key) {
  localStorage.removeItem('global_memory_' + key);
}

function globalStoreListKeys() {
  const prefix = 'global_memory_';
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(prefix)) {
      keys.push(k.slice(prefix.length));
    }
  }
  return keys;
}

function globalStoreClear() {
  const prefix = 'global_memory_';
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(prefix)) {
      toRemove.push(k);
    }
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}
