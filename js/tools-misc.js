async function handleCompact(args) {
  const summary = args.summary;
  if (!summary) return { error: 'Summary is required' };
  const activeChat = getActiveChat();
  if (!activeChat) return { error: 'No active chat' };

  const systemMsg = activeChat.messages.find(m => m.role === 'system');
  const newMessages = [];
  if (systemMsg) newMessages.push({ ...systemMsg });
  newMessages.push({ role: 'assistant', content: '[Conversation compacted]\n\n' + summary });

  const userMessages = activeChat.messages.filter(m => m.role === 'user');
  if (userMessages.length > 0) {
    newMessages.push({ ...userMessages[userMessages.length - 1] });
  }

  activeChat.messages = newMessages;
  saveChats();
  return { success: true, message: 'Conversation compacted successfully' };
}

async function handleCalculate(args) {
  try {
    const result = Function('"use strict"; return (' + args.expression + ')')();
    return { expression: args.expression, result, type: typeof result };
  } catch (err) {
    return { error: 'Invalid expression: ' + err.message };
  }
}

async function handleGetCurrentTime() {
  const now = new Date();
  return {
    iso: now.toISOString(),
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekday: now.toLocaleDateString(undefined, { weekday: 'long' })
  };
}

async function handleSendNotification(args) {
  if (!('Notification' in window)) {
    return { error: 'Notifications not supported in this browser' };
  }
  if (Notification.permission === 'denied') {
    return { error: 'Notification permission was denied' };
  }
  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      return { error: 'Notification permission not granted' };
    }
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(args.title || 'Notification', { body: args.body || '' });
  } catch {
    new Notification(args.title || 'Notification', { body: args.body || '' });
  }
  return { success: true, title: args.title, body: args.body };
}

async function handleSetSetting(args) {
  const key = args.key;
  const value = args.value;
  if (key === 'proxyUrl') {
    settings.proxyUrl = value;
    elements.proxyUrlInput.value = value;
  } else if (key === 'modelName') {
    settings.modelName = value;
    elements.modelNameInput.value = value;
    // Select "custom" if the model name doesn't match a preset option
    var customFound = false;
    var opts = elements.modelSelect.options;
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].value === value) {
        elements.modelSelect.value = value;
        customFound = true;
        break;
      }
    }
    if (!customFound) {
      elements.modelSelect.value = 'custom';
      elements.modelNameInput.value = value;
      elements.modelNameInput.disabled = false;
    }
  } else if (key === 'persona') {
    if (PERSONAS[value]) {
      settings.currentPersona = value;
      elements.personaSelect.value = value;
      if (value === 'custom') {
        elements.systemPromptTextarea.value = settings.customSystemPrompt || '';
        elements.systemPromptTextarea.disabled = false;
      } else {
        elements.systemPromptTextarea.value = PERSONAS[value].system;
        elements.systemPromptTextarea.disabled = true;
      }
    }
  }
  saveSettings();
  return { success: true, key: key, value: value };
}

async function handleClipboardWrite(args, toolCallId) {
  const clipId = 'clip-' + toolCallId;
  pendingClipboard.push({ toolCallId: toolCallId, clipId, text: args.text || '' });
  return { success: true, length: (args.text || '').length };
}

async function handleGenerateChart(args, toolCallId) {
  const chartConfig = {
    type: args.type || 'bar',
    title: args.title || '',
    labels: args.labels || [],
    datasets: args.datasets || []
  };
  pendingCharts.push({ toolCallId: toolCallId, config: chartConfig });
  return { success: true, type: chartConfig.type, title: chartConfig.title, dataPoints: chartConfig.labels.length };
}

async function handleSaveFile(args, toolCallId) {
  const filename = args.filename || 'download.txt';
  const content = args.content || '';
  const fileId = 'file-' + toolCallId;
  pendingDownloads.push({ toolCallId: toolCallId, fileId, filename, content });

  const activeChat = getActiveChat();
  if (activeChat) {
    if (!activeChat.savedFiles) activeChat.savedFiles = [];
    activeChat.savedFiles.push({ fileId, filename, size: content.length, ts: Date.now() });
    saveChats();
  }

  return { success: true, filename, size: content.length };
}
