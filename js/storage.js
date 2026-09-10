// One-time migration of pre-rename `opencode_*` localStorage keys to `airgap_*`.
// Runs at the top of init() before settings/chats load. Idempotent via flag.
function migrateOpencodeKeys() {
  try {
    if (localStorage.getItem('airgap_key_migration_done')) return;
    var pairs = [
      ['opencode_settings', 'airgap_settings'],
      ['opencode_chats', 'airgap_chats'],
      ['opencode_current_chat_id', 'airgap_current_chat_id'],
      ['opencode_settings_turns_migrated', 'airgap_settings_turns_migrated']
    ];
    for (var i = 0; i < pairs.length; i++) {
      var oldVal = localStorage.getItem(pairs[i][0]);
      if (oldVal !== null && localStorage.getItem(pairs[i][1]) === null) {
        localStorage.setItem(pairs[i][1], oldVal);
      }
      if (oldVal !== null) localStorage.removeItem(pairs[i][0]);
    }
    localStorage.setItem('airgap_key_migration_done', 'true');
  } catch (e) {
    console.error('Key migration failed', e);
  }
}

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

// Notes storage helpers (global, shared across conversations)
function noteStoreGet(key) {
  return localStorage.getItem('note_' + key);
}
function noteStoreSet(key, value) {
  localStorage.setItem('note_' + key, value);
}
function noteStoreDelete(key) {
  localStorage.removeItem('note_' + key);
}
function noteStoreListKeys() {
  const prefix = 'note_';
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(prefix)) {
      keys.push(k.slice(prefix.length));
    }
  }
  return keys;
}
function noteStoreClear() {
  const prefix = 'note_';
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(prefix)) {
      toRemove.push(k);
    }
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}
