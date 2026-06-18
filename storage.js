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
