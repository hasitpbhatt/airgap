// Utility functions and constants

// System Personas
const PERSONAS = {
  general: {
    label: 'General Assistant',
    icon: '🤖',
    system: 'You are a helpful, precise, and friendly AI assistant. Answer the user\'s questions thoroughly and accurately.'
  },
  child: {
    label: 'Like I\'m 10',
    icon: '🧒',
    system: 'You are explaining to a 10-year-old child. Use simple words, fun analogies, and everyday examples. No jargon. Keep it engaging and easy to understand.'
  },
  deep: {
    label: 'Deep Dive',
    icon: '🔬',
    system: 'You are a domain expert. Provide deep, nuanced insights and connect the concept to advanced research, industry practices, or expert-level perspectives. Assume the student has strong foundational knowledge.'
  },
  'first-principles': {
    label: 'First Principles',
    icon: '🧠',
    system: 'You are a first-principles thinker. Break the concept down to its most fundamental truths and derive the explanation from base principles. Use logical reasoning, and where applicable, mathematical or formal foundations. Assume the student is comfortable with abstract thinking.'
  },
  socratic: {
    label: 'Socratic Tutor',
    icon: '❓',
    system: 'You are a Socratic tutor. Do not give direct answers. Instead, ask guiding questions that lead the student to discover the concept themselves. Challenge their assumptions and help them reason step by step.'
  },
  custom: {
    label: 'Custom Persona',
    icon: '⚙️',
    system: ''
  }
};

// Helper functions
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  };
  catch (_) {
    return false;
  }
}

function formatTimeAgo(date) {
  const seconds = Math.floor(Date.now() - date.getTime() / 1000);
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 }
  ];
  
  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count > 0) {
      return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}

export {
  PERSONAS,
  escapeHtml,
  debounce,
  throttle,
  generateId,
  isValidUrl,
  formatTimeAgo
};