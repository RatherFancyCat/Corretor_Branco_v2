'use strict';

let wordMap = {};
let enabled = true;
let settings = { autoCapitalize: false, blacklistedDomains: [] };
let blockedByDomain = false;

// Flag to prevent re-entrant corrections when we programmatically set element.value
let applying = false;

// Characters that mark the end of a word
// PUNCT_CLASS is the non-whitespace subset; SEPARATOR_RE also includes \s.
const PUNCT_CLASS = ".,!?;:'\"()\\[\\]{}\\-\\/\\\\«»\u201C\u201D\u2018\u2019";
const SEPARATOR_RE = new RegExp('[\\s' + PUNCT_CLASS + ']');

// Used to strip wrapping punctuation from an extracted token so that words
// inside quotes or parentheses (e.g. "(nao)", '"nao"', «nao») are still
// matched in the word map.
const LEADING_PUNCT_RE = new RegExp('^[' + PUNCT_CLASS + ']+');
const TRAILING_PUNCT_RE = new RegExp('[' + PUNCT_CLASS + ']+$');

// Sentence-ending characters (for auto-capitalise)
const SENTENCE_END_RE = /[.!?]/;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function checkDomainBlock() {
  const hostname = window.location.hostname;
  const domains = (settings && settings.blacklistedDomains) || [];
  blockedByDomain = domains.some(
    (d) => d && (hostname === d || hostname.endsWith('.' + d))
  );
}

function loadSettings() {
  chrome.storage.local.get(['wordMap', 'enabled', 'settings'], (data) => {
    wordMap = data.wordMap || {};
    enabled = data.enabled !== false;
    settings = data.settings || { autoCapitalize: false, blacklistedDomains: [] };
    checkDomainBlock();
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.wordMap) wordMap = changes.wordMap.newValue || {};
  if (changes.enabled !== undefined) enabled = changes.enabled.newValue !== false;
  if (changes.settings) {
    settings = changes.settings.newValue || { autoCapitalize: false, blacklistedDomains: [] };
    checkDomainBlock();
  }
});

loadSettings();

// ---------------------------------------------------------------------------
// Correction logic
// ---------------------------------------------------------------------------

/**
 * Look up a correction for the given word.
 * Matching is case-insensitive; the returned correction preserves the
 * casing pattern of the original word (ALL CAPS or Title Case).
 */
function getCorrection(word) {
  if (!word) return null;

  // 1. Exact match
  if (Object.prototype.hasOwnProperty.call(wordMap, word)) return wordMap[word];

  // 2. Case-insensitive match
  const lower = word.toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(wordMap, lower)) return null;

  const correction = wordMap[lower];

  // Preserve ALL CAPS
  if (word === word.toUpperCase() && word.length > 1) {
    return correction.toUpperCase();
  }
  // Preserve Title Case (first letter capital)
  if (word[0] !== word[0].toLowerCase()) {
    return correction[0].toUpperCase() + correction.slice(1);
  }
  return correction;
}

/**
 * Find and replace the last completed word in a standard input/textarea.
 * A word is "completed" when followed by a separator character.
 */
function correctInputElement(element) {
  const value = element.value;
  // selectionStart throws a TypeError on input types that don't support text
  // selection (e.g. type="email"). This is a defensive fallback in case such an
  // element somehow bypasses the SELECTOR filter.
  let cursorPos;
  try {
    cursorPos = element.selectionStart;
  } catch {
    return;
  }
  if (cursorPos === null || cursorPos === undefined) return;

  const charBefore = value[cursorPos - 1];
  if (!charBefore || !SEPARATOR_RE.test(charBefore)) return;

  const textBefore = value.substring(0, cursorPos - 1);
  const wordMatch = textBefore.match(/(\S+)$/);
  if (!wordMatch) return;

  const rawToken = wordMatch[1];
  // Strip leading and trailing separator characters so that words wrapped in
  // quotes or parentheses (e.g. "(nao)", '"nao"', «nao») are still matched.
  const strippedLeading = rawToken.replace(LEADING_PUNCT_RE, '');
  const typedWord = strippedLeading.replace(TRAILING_PUNCT_RE, '');
  if (!typedWord) return;
  const correction = getCorrection(typedWord);
  if (!correction) return;

  const leadingLen = rawToken.length - strippedLeading.length;
  const trailingLen = strippedLeading.length - typedWord.length;
  const wordStart = cursorPos - 1 - rawToken.length + leadingLen;

  applying = true;
  try {
    const newValue =
      value.substring(0, wordStart) + correction + value.substring(wordStart + typedWord.length);
    element.value = newValue;

    const newCursorPos = wordStart + correction.length + trailingLen + 1; // +1 for the separator
    element.setSelectionRange(newCursorPos, newCursorPos);

    // Notify JS frameworks (React, Vue, etc.) that the value changed.
    // `composed: true` is required so the event crosses Shadow DOM boundaries.
    element.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, cancelable: false }));
  } finally {
    applying = false;
  }
}

/**
 * Find and replace the last completed word in a contenteditable element.
 */
function correctContentEditable(element) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  if (!range.collapsed) return;

  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  if (!element.contains(node)) return;

  const cursorPos = range.startOffset;
  const text = node.textContent;

  const charBefore = text[cursorPos - 1];
  if (!charBefore || !SEPARATOR_RE.test(charBefore)) return;

  const textBefore = text.substring(0, cursorPos - 1);
  const wordMatch = textBefore.match(/(\S+)$/);
  if (!wordMatch) return;

  const rawToken = wordMatch[1];
  // Strip leading and trailing separator characters so that words wrapped in
  // quotes or parentheses (e.g. "(nao)", '"nao"', «nao») are still matched.
  const strippedLeading = rawToken.replace(LEADING_PUNCT_RE, '');
  const typedWord = strippedLeading.replace(TRAILING_PUNCT_RE, '');
  if (!typedWord) return;
  const correction = getCorrection(typedWord);
  if (!correction) return;

  const leadingLen = rawToken.length - strippedLeading.length;
  const trailingLen = strippedLeading.length - typedWord.length;
  const wordStart = cursorPos - 1 - rawToken.length + leadingLen;

  applying = true;
  try {
    node.textContent =
      text.substring(0, wordStart) + correction + text.substring(wordStart + typedWord.length);

    const newRange = document.createRange();
    const newOffset = Math.min(wordStart + correction.length + trailingLen + 1, node.textContent.length);
    newRange.setStart(node, newOffset);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
  } finally {
    applying = false;
  }
}

// ---------------------------------------------------------------------------
// Auto-capitalise logic
// ---------------------------------------------------------------------------

/**
 * Returns true if textBefore represents a position at the start of a sentence:
 * - beginning of the field (empty or only whitespace)
 * - after a newline (possibly preceded by spaces/tabs)
 * - after a sentence-ending character (. ! ?) possibly followed by spaces/tabs
 */
function isAtSentenceStart(textBefore) {
  if (textBefore.length === 0) return true;

  // Scan backwards past spaces and tabs (newline is itself a trigger, not skipped)
  let i = textBefore.length - 1;
  while (i >= 0 && (textBefore[i] === ' ' || textBefore[i] === '\t')) {
    i--;
  }

  if (i < 0) return true; // nothing but whitespace before
  const ch = textBefore[i];
  return ch === '\n' || SENTENCE_END_RE.test(ch);
}

/**
 * Capitalise the just-typed letter if it follows a sentence-ending context.
 * Only fires when a single lowercase letter was inserted (event.inputType === 'insertText').
 */
function autoCapitalizeInput(element, event) {
  if (!event || event.inputType !== 'insertText') return;
  const typedChar = event.data;
  if (!typedChar || typedChar.length !== 1) return;
  // Only act when the character has an uppercase form and is currently lowercase
  if (typedChar === typedChar.toUpperCase()) return;

  const value = element.value;
  const cursorPos = element.selectionStart;
  if (cursorPos === null || cursorPos < 1) return;

  const textBefore = value.substring(0, cursorPos - 1);
  if (!isAtSentenceStart(textBefore)) return;

  const upper = typedChar.toUpperCase();
  applying = true;
  try {
    element.value = value.substring(0, cursorPos - 1) + upper + value.substring(cursorPos);
    element.setSelectionRange(cursorPos, cursorPos);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, cancelable: false }));
  } finally {
    applying = false;
  }
}

/**
 * Capitalise the just-typed letter in a contenteditable element.
 */
function autoCapitalizeContentEditable(element, event) {
  if (!event || event.inputType !== 'insertText') return;
  const typedChar = event.data;
  if (!typedChar || typedChar.length !== 1) return;
  if (typedChar === typedChar.toUpperCase()) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!range.collapsed) return;
  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  if (!element.contains(node)) return;

  const cursorPos = range.startOffset;
  if (cursorPos < 1) return;
  const text = node.textContent;
  const textBefore = text.substring(0, cursorPos - 1);
  if (!isAtSentenceStart(textBefore)) return;

  const upper = typedChar.toUpperCase();
  applying = true;
  try {
    node.textContent = text.substring(0, cursorPos - 1) + upper + text.substring(cursorPos);
    const newRange = document.createRange();
    newRange.setStart(node, cursorPos);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
  } finally {
    applying = false;
  }
}

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------

function handleInput(event) {
  if (applying) return;
  if (!enabled || blockedByDomain) return;

  const el = event.target;
  const tag = el.tagName;

  const isTextInput =
    (tag === 'INPUT' || tag === 'TEXTAREA') && el.type !== 'password';

  // Word correction (triggers on separator character)
  if (Object.keys(wordMap).length > 0) {
    if (isTextInput) {
      correctInputElement(el);
    } else if (el.isContentEditable) {
      correctContentEditable(el);
    }
  }

  // Auto-capitalise (triggers on alphabetic letter at sentence start)
  if (settings.autoCapitalize) {
    if (isTextInput) {
      autoCapitalizeInput(el, event);
    } else if (el.isContentEditable) {
      autoCapitalizeContentEditable(el, event);
    }
  }
}

// ---------------------------------------------------------------------------
// DOM attachment
// ---------------------------------------------------------------------------

const SELECTOR = [
  'input:not([type="password"]):not([type="hidden"]):not([type="file"])' +
    ':not([type="checkbox"]):not([type="radio"]):not([type="submit"])' +
    ':not([type="button"]):not([type="reset"]):not([type="image"])' +
    ':not([type="color"]):not([type="range"]):not([type="number"])' +
    ':not([type="date"]):not([type="time"]):not([type="datetime-local"])' +
    ':not([type="month"]):not([type="week"]):not([type="email"])',
  'textarea',
  '[contenteditable]:not([contenteditable="false" i])',
].join(', ');

function attachToElement(el) {
  if (!el || el._correctorAttached) return;
  if (typeof el.matches !== 'function') return;
  if (!el.matches(SELECTOR)) return;
  el.addEventListener('input', handleInput);
  el._correctorAttached = true;
}

function attachToAll(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll(SELECTOR).forEach(attachToElement);
}

if (document.body) {
  attachToAll(document.body);
} else {
  document.addEventListener('DOMContentLoaded', () => attachToAll(document.body));
}

// Watch for dynamically added elements
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        attachToElement(node);
        attachToAll(node);
      }
    }
  }
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
  });
}


