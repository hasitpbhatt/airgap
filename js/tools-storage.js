async function handleStoreValue(args) {
  try {
    llmStoreSet(args.key, args.value);
    return { success: true, key: args.key };
  } catch (err) {
    return { error: err.message };
  }
}

async function handleReadValue(args) {
  try {
    const value = llmStoreGet(args.key);
    if (value === null) return { error: 'Key not found: ' + args.key };
    return { key: args.key, value };
  } catch (err) {
    return { error: err.message };
  }
}

async function handleListStoredKeys() {
  try {
    return { keys: llmStoreListKeys() };
  } catch (err) {
    return { error: err.message };
  }
}

async function handleDeleteValue(args) {
  try {
    llmStoreDelete(args.key);
    return { success: true, key: args.key };
  } catch (err) {
    return { error: err.message };
  }
}

async function handleRemember(args) {
  try {
    globalStoreSet(args.key, args.value);
    refreshMemoryPanelIfOpen();
    return { success: true, key: args.key };
  } catch (err) {
    return { error: err.message };
  }
}

async function handleRecall(args) {
  try {
    const keyword = args.keyword;
    const allKeys = globalStoreListKeys();
    if (allKeys.length === 0) {
      return { result: 'No data stored in global memory yet.' };
    }

    const exact = globalStoreGet(keyword);
    if (exact !== null) {
      return { key: keyword, value: exact, source: 'exact_match' };
    }

    const matches = allKeys.filter(k => k.toLowerCase().includes(keyword.toLowerCase()));
    if (matches.length === 0) {
      return { result: 'No matching keys found in global memory for: ' + keyword, all_keys: allKeys };
    }

    const values = {};
    matches.forEach(k => { values[k] = globalStoreGet(k); });
    return { matches, values, count: matches.length, source: 'substring_match' };
  } catch (err) {
    return { error: err.message };
  }
}

async function handleForget(args) {
  try {
    globalStoreDelete(args.key);
    refreshMemoryPanelIfOpen();
    return { success: true, key: args.key };
  } catch (err) {
    return { error: err.message };
  }
}

async function handleForgetAll() {
  try {
    globalStoreClear();
    refreshMemoryPanelIfOpen();
    return { success: true, message: 'All global memory cleared.' };
  } catch (err) {
    return { error: err.message };
  }
}

async function handleNotesCreate(args) {
  try {
    noteStoreSet(args.key, args.content);
    return { success: true, key: args.key };
  } catch (err) { return { error: err.message }; }
}

async function handleNotesRead(args) {
  try {
    const val = noteStoreGet(args.key);
    if (val === null) return { error: 'Note not found: ' + args.key };
    return { key: args.key, content: val };
  } catch (err) { return { error: err.message }; }
}

async function handleNotesList(args) {
  try {
    const allKeys = noteStoreListKeys();
    if (allKeys.length === 0) return { result: 'No notes yet.' };
    const query = (args.query || '').toLowerCase();
    const matches = query ? allKeys.filter(k => k.toLowerCase().includes(query)) : allKeys;
    if (matches.length === 0) return { result: 'No notes matching: ' + args.query, all_keys: allKeys };
    const notes = {};
    matches.forEach(k => { notes[k] = (noteStoreGet(k) || '').substring(0, 200); });
    return { notes: notes, count: matches.length };
  } catch (err) { return { error: err.message }; }
}

async function handleNotesDelete(args) {
  try {
    noteStoreDelete(args.key);
    return { success: true, key: args.key };
  } catch (err) { return { error: err.message }; }
}
