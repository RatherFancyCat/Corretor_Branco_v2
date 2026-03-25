'use strict';

let wordMap = {};
let enabled = true;

// Flag to prevent re-entrant corrections when we programmatically set element.value
let applying = false;

// Characters that mark the end of a word
const SEPARATOR_RE = /[\s.,!?;:'"()\[\]{}\-\/\\]/;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function loadSettings() {
  chrome.storage.local.get(['wordMap', 'enabled'], (data) => {
    wordMap = data.wordMap || {};
    enabled = data.enabled !== false;
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.wordMap) wordMap = changes.wordMap.newValue || {};
  if (changes.enabled !== undefined) enabled = changes.enabled.newValue !== false;
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
  const cursorPos = element.selectionStart;
  if (cursorPos === null || cursorPos === undefined) return;

  const charBefore = value[cursorPos - 1];
  if (!charBefore || !SEPARATOR_RE.test(charBefore)) return;

  const textBefore = value.substring(0, cursorPos - 1);
  const wordMatch = textBefore.match(/(\S+)$/);
  if (!wordMatch) return;

  const typedWord = wordMatch[1];
  const correction = getCorrection(typedWord);
  if (!correction) return;

  const wordStart = cursorPos - 1 - typedWord.length;

  applying = true;
  try {
    const newValue =
      value.substring(0, wordStart) + correction + value.substring(wordStart + typedWord.length);
    element.value = newValue;

    const newCursorPos = wordStart + correction.length + 1; // +1 for the separator
    element.setSelectionRange(newCursorPos, newCursorPos);

    // Notify JS frameworks (React, Vue, etc.) that the value changed
    element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false }));
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

  const typedWord = wordMatch[1];
  const correction = getCorrection(typedWord);
  if (!correction) return;

  const wordStart = cursorPos - 1 - typedWord.length;

  applying = true;
  try {
    node.textContent =
      text.substring(0, wordStart) + correction + text.substring(wordStart + typedWord.length);

    const newRange = document.createRange();
    const newOffset = Math.min(wordStart + correction.length + 1, node.textContent.length);
    newRange.setStart(node, newOffset);
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
  if (!enabled) return;
  if (Object.keys(wordMap).length === 0) return;

  const el = event.target;
  const tag = el.tagName;

  const isTextInput =
    (tag === 'INPUT' || tag === 'TEXTAREA') && el.type !== 'password';

  if (isTextInput) {
    correctInputElement(el);
  } else if (el.isContentEditable) {
    correctContentEditable(el);
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
    ':not([type="month"]):not([type="week"])',
  'textarea',
  '[contenteditable]',
].join(', ');

function attachToElement(el) {
  if (!el || el._correctorAttached) return;

  const tag = el.tagName;
  if (!tag) return;

  const isInput = tag === 'INPUT' || tag === 'TEXTAREA';
  const isContentEditable =
    el.getAttribute && el.getAttribute('contenteditable') !== null;

  if (isInput || isContentEditable) {
    el.addEventListener('input', handleInput);
    el._correctorAttached = true;
  }
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
