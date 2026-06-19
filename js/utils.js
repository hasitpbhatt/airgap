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
    dec += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ _k.charCodeAt((i / 2) % _k.length));
  }
  return dec;
}

function scrollToBottom() {
  elements.chatFeedContainer.scrollTop = elements.chatFeedContainer.scrollHeight;
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
