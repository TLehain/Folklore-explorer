// Shared helpers

export const KEYS = {
  locationChoice: 'folkloreLocationChoice', // 'use' or 'browse'
  unlockedStories: 'folkloreUnlockedStories',
  walkProgress: 'folkloreWalkProgress',
  legacyWalkState: 'walkState' // used by an earlier version
};

// Escapes text before it is placed into innerHTML
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

// Accepts an array of paragraphs, or a string where blank lines separate paragraphs
export function toParagraphs(content) {
  const parts = Array.isArray(content) ? content : String(content || '').split(/\n\s*\n/);
  return parts.map(part => String(part).trim()).filter(Boolean);
}

// localStorage wrapper that tolerates blocked or full storage
export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('Could not save to storage:', error);
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Could not clear storage:', error);
    }
  }
};
