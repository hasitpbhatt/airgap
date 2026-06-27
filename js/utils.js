// Markdown rendering
function mdToHtml(text) {
  if (typeof marked !== 'undefined' && marked.parse) {
    try {
      return sanitizeHtml(marked.parse(text, { breaks: true }));
    } catch (e) {
      console.error("Markdown parsing failed", e);
    }
  }
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function sanitizeHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  doc.querySelectorAll('script, iframe, object, embed, style').forEach(el => el.remove());
  doc.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on') ||
          (attr.name === 'href' && /^\s*javascript\s*:/i.test(attr.value)) ||
          (attr.name === 'src' && /^\s*javascript\s*:/i.test(attr.value))) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// XOR+hex encode/decode for ?k= param
function xorHexEncode(str) {
  const _k = '_x4';
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) ^ _k.charCodeAt(i % _k.length);
    hex += code.toString(16).padStart(2, '0');
  }
  return hex;
}

function xorHexDecode(hex) {
  const _k = '_x4';
  let dec = '';
  for (let i = 0; i < hex.length; i += 2) {
    dec += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ _k.charCodeAt((i / 2) % _k.length));
  }
  return dec;
}

function estimateTokens(str) {
  if (!str) return 0;
  const words = str.split(/\s+/).filter(Boolean).length;
  const avgWordLen = str.length / Math.max(1, words);
  if (avgWordLen > 8) {
    return Math.ceil(str.length / 4);
  }
  const specialChars = (str.match(/[^\w\s]/g) || []).length;
  return Math.max(1, Math.ceil(words * 1.3 + specialChars * 0.25));
}

function scrollToBottom() {
  userScrolledAway = false;
  elements.chatFeedContainer.scrollTop = elements.chatFeedContainer.scrollHeight;
}

function tryAutoScroll() {
  if (userScrolledAway) return;
  scrollToBottom();
}

function setupAutoScroll() {
  var c = elements.chatFeedContainer;
  c.addEventListener('scroll', function () {
    var threshold = 32;
    userScrolledAway = c.scrollTop + c.clientHeight < c.scrollHeight - threshold;
  });
}

// Textarea autogrow logic
function handleTextareaAutoGrow() {
  elements.chatTextarea.style.height = 'auto';
  elements.chatTextarea.style.height = elements.chatTextarea.scrollHeight + 'px';
  elements.sendBtn.disabled = elements.chatTextarea.value.trim().length === 0 || isGenerating;
}

// UI helpers for Sidebar & Responsiveness
function toggleSidebar(forceState) {
  const isCollapsed = elements.sidebar.classList.contains('collapsed');
  const shouldCollapse = forceState !== undefined ? !forceState : !isCollapsed;

  elements.sidebar.classList.toggle('collapsed', shouldCollapse);
  elements.sidebarOverlay.classList.toggle('active', !shouldCollapse && window.innerWidth <= 768);
}

function adjustResponsiveLayout() {
  const isMobile = window.innerWidth <= 768;
  elements.closeSidebarBtn.style.display = isMobile ? 'flex' : 'none';
  if (!isMobile) {
    elements.sidebarOverlay.classList.remove('active');
  } else {
    elements.sidebar.classList.add('collapsed');
  }
}

// Code rendering helpers
function highlightCodeBlocks() {
  const preElements = elements.chatFeed.querySelectorAll('pre');
  preElements.forEach(pre => {
    const codeElement = pre.querySelector('code');
    if (!codeElement) return;

    let lang = 'code';
    const classes = codeElement.className.split(' ');
    const langClass = classes.find(c => c.startsWith('language-'));
    if (langClass) {
      lang = langClass.replace('language-', '');
    }

    if (pre.previousElementSibling && pre.previousElementSibling.classList.contains('code-block-header')) return;

    const container = document.createElement('div');
    container.className = 'code-container';
    pre.parentNode.insertBefore(container, pre);

    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `
      <span>${lang.toUpperCase()}</span>
      <button class="btn-copy-code" onclick="copyCodeSnippet(this)">
        <i data-lucide="copy" style="width: 10px; height: 10px;"></i>
        <span>Copy</span>
      </button>
    `;

    container.appendChild(header);
    container.appendChild(pre);

    pre.className = 'code-block-body';
  });

  Prism.highlightAllUnder(elements.chatFeed);
}

function copyCodeSnippet(button) {
  const container = button.closest('.code-container');
  const codeBlock = container.querySelector('code');
  const textToCopy = codeBlock.textContent;

  navigator.clipboard.writeText(textToCopy).then(() => {
    const textSpan = button.querySelector('span');
    button.style.borderColor = 'hsl(var(--success))';
    button.style.color = 'hsl(var(--success))';
    textSpan.textContent = 'Copied!';

    setTimeout(() => {
      button.style.borderColor = '';
      button.style.color = '';
      textSpan.textContent = 'Copy';
    }, 2000);
  });
}

// Toast notifications
function showToast(msg, type) {
  type = type || 'info';
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(function () {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(function () { el.remove(); }, 300);
  }, 3000);
}

// Promise-based confirm dialog
function showConfirm(msg) {
  return new Promise(function (resolve) {
    var overlay = document.getElementById('confirm-overlay');
    var body = document.getElementById('confirm-body');
    var okBtn = document.getElementById('confirm-ok');
    var cancelBtn = document.getElementById('confirm-cancel');
    body.textContent = msg;
    overlay.style.display = 'flex';

    function done(result) {
      overlay.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onOk() { done(true); }
    function onCancel() { done(false); }
    function onOverlay(e) { if (e.target === overlay) done(false); }
    function onKey(e) { if (e.key === 'Escape') done(false); }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
    document.addEventListener('keydown', onKey);
  });
}

function copyMessageText(button, index) {
  const activeChat = getActiveChat();
  if (!activeChat || !activeChat.messages[index]) return;

  navigator.clipboard.writeText(activeChat.messages[index].content).then(() => {
    const originalHtml = button.innerHTML;
    button.innerHTML = '<i data-lucide="check" style="width: 12px; height: 12px; color: hsl(var(--success));"></i>';
    lucide.createIcons();
    setTimeout(() => {
      button.innerHTML = originalHtml;
      lucide.createIcons();
    }, 1500);
  });
}

// ── Text-to-Speech ────────────────────────────────────────────────────────

let ttsUtterance = null;
let ttsSpeakingIndex = null;
let ttsAudioContext = null;
let ttsAudioSource = null;

function getAvailableVoices() {
  return new Promise(function (resolve) {
    var voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      resolve(voices);
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', function () {
        resolve(window.speechSynthesis.getVoices());
      }, { once: true });
    }
  });
}

function ttsCleanup() {
  ttsUtterance = null;
  ttsSpeakingIndex = null;
  document.querySelectorAll('.msg-tts-btn.speaking').forEach(function (el) { el.classList.remove('speaking'); });
}

function speakText(text, index) {
  if (!text) return;
  stopSpeaking();
  if (settings.ttsProxyUrl && settings.ttsProxyUrl.trim()) {
    speakViaVoxtral(text, index);
  } else if ('speechSynthesis' in window) {
    speakViaWebSpeech(text, index);
  }
}

function speakViaWebSpeech(text, index) {
  ttsUtterance = new SpeechSynthesisUtterance(text);
  ttsUtterance.rate = settings.ttsRate || 1.0;
  ttsUtterance.pitch = settings.ttsPitch || 1.0;
  ttsUtterance.voice = settings.ttsVoice ? speechSynthesis.getVoices().find(function (v) { return v.name === settings.ttsVoice; }) : null;
  ttsSpeakingIndex = index;
  ttsUtterance.onend = ttsCleanup;
  ttsUtterance.onerror = ttsCleanup;
  speechSynthesis.speak(ttsUtterance);
}

async function speakViaVoxtral(text, index) {
  ttsSpeakingIndex = index;
  var btn = document.querySelector('.msg-tts-btn[data-msg-index="' + index + '"]');
  if (btn) btn.classList.add('loading');
  try {
    var headers = { 'Content-Type': 'application/json' };
    if (settings.apiKey) {
      headers['Authorization'] = 'Bearer ' + settings.apiKey;
    }
    var res = await fetch(settings.ttsProxyUrl, {
      method: 'POST',
      headers: headers,
      body: (function () {
        var b = {
          model: settings.ttsModelName || 'voxtral-mini-tts-2603',
          input: text,
          response_format: 'mp3'
        };
        if (settings.ttsVoice && settings.ttsVoice.trim()) {
          b.voice = settings.ttsVoice.trim();
        }
        return JSON.stringify(b);
      })()
    });
    if (!res.ok) {
      throw new Error('TTS API error: ' + res.status);
    }
    var contentType = res.headers.get('content-type') || '';
    var arrayBuffer;
    if (contentType.includes('json')) {
      var json = await res.json();
      var audioData = json.audio_data || json.audio;
      if (!audioData) throw new Error('No audio data in response');
      var binary = atob(audioData);
      arrayBuffer = new ArrayBuffer(binary.length);
      var view = new Uint8Array(arrayBuffer);
      for (var i = 0; i < binary.length; i++) {
        view[i] = binary.charCodeAt(i);
      }
    } else {
      arrayBuffer = await res.arrayBuffer();
    }
    if (btn) btn.classList.remove('loading');
    if (btn) btn.classList.add('speaking');
    ttsAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    var audioBuffer = await ttsAudioContext.decodeAudioData(arrayBuffer);
    ttsAudioSource = ttsAudioContext.createBufferSource();
    ttsAudioSource.buffer = audioBuffer;
    ttsAudioSource.connect(ttsAudioContext.destination);
    ttsAudioSource.start(0);
    ttsAudioSource.onended = function () {
      ttsCleanup();
      if (ttsAudioContext) {
        ttsAudioContext.close();
        ttsAudioContext = null;
      }
      ttsAudioSource = null;
    };
  } catch (err) {
    console.error('TTS error:', err);
    if (btn) {
      btn.classList.remove('loading');
      btn.title = 'TTS failed';
    }
    ttsCleanup();
  }
}

function stopSpeaking() {
  if (ttsAudioSource) {
    try { ttsAudioSource.stop(); } catch (e) {}
    ttsAudioSource = null;
  }
  if (ttsAudioContext) {
    try { ttsAudioContext.close(); } catch (e) {}
    ttsAudioContext = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  ttsCleanup();
}
