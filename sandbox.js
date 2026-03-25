'use strict';

let wordMap = {};
let settings = { autoCapitalize: false, blacklistedDomains: [] };
let applying = false;

const PUNCT_CLASS = ".,!?;:'\"()\\[\\]{}\\-\\/\\\\«»\u201C\u201D\u2018\u2019";
const SEPARATOR_RE = new RegExp('[\\s' + PUNCT_CLASS + ']');
const SENTENCE_END_RE = /[.!?]/;
const LEADING_PUNCT_RE = new RegExp('^[' + PUNCT_CLASS + ']+');
const TRAILING_PUNCT_RE = new RegExp('[' + PUNCT_CLASS + ']+$');

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function loadAll(callback) {
  chrome.storage.local.get(['wordMap', 'settings'], (data) => {
    wordMap = data.wordMap || {};
    settings = data.settings || { autoCapitalize: false, blacklistedDomains: [] };
    if (callback) callback();
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.wordMap) {
    wordMap = changes.wordMap.newValue || {};
    renderWordList();
  }
  if (changes.settings) {
    settings = changes.settings.newValue || { autoCapitalize: false, blacklistedDomains: [] };
  }
});

// ---------------------------------------------------------------------------
// Correction helpers (mirror of content.js logic)
// ---------------------------------------------------------------------------

function getCorrection(word) {
  if (!word) return null;
  if (Object.prototype.hasOwnProperty.call(wordMap, word)) return wordMap[word];

  const lower = word.toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(wordMap, lower)) return null;

  const correction = wordMap[lower];
  if (word === word.toUpperCase() && word.length > 1) return correction.toUpperCase();
  if (word[0] !== word[0].toLowerCase()) {
    return correction[0].toUpperCase() + correction.slice(1);
  }
  return correction;
}

function correctTextarea(element) {
  if (applying) return;
  const value = element.value;
  const cursorPos = element.selectionStart;
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
    const newCursorPos = wordStart + correction.length + trailingLen + 1;
    element.setSelectionRange(newCursorPos, newCursorPos);
    logCorrection(typedWord, correction);
  } finally {
    applying = false;
  }
}

// ---------------------------------------------------------------------------
// Auto-capitalise helpers (mirror of content.js logic)
// ---------------------------------------------------------------------------

function isAtSentenceStart(textBefore) {
  if (textBefore.length === 0) return true;
  let i = textBefore.length - 1;
  while (i >= 0 && (textBefore[i] === ' ' || textBefore[i] === '\t')) {
    i--;
  }
  if (i < 0) return true;
  const ch = textBefore[i];
  return ch === '\n' || SENTENCE_END_RE.test(ch);
}

function autoCapitalizeTextarea(element, event) {
  if (!event || event.inputType !== 'insertText') return;
  const typedChar = event.data;
  if (!typedChar || typedChar.length !== 1) return;
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
  } finally {
    applying = false;
  }
}

// ---------------------------------------------------------------------------
// Correction log
// ---------------------------------------------------------------------------

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function logCorrection(original, corrected) {
  const log = document.getElementById('correctionLog');
  const placeholder = log.querySelector('.no-corrections');
  if (placeholder) placeholder.remove();

  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString('pt-PT');
  li.innerHTML =
    `<span class="log-time">${time}</span>` +
    ` <span class="log-original">${escapeHtml(original)}</span>` +
    ` <span class="log-arrow">&#8594;</span>` +
    ` <span class="log-corrected">${escapeHtml(corrected)}</span>`;
  log.insertBefore(li, log.firstChild);

  // Keep at most 30 entries
  while (log.children.length > 30) {
    log.removeChild(log.lastChild);
  }
}

// ---------------------------------------------------------------------------
// Active word list panel
// ---------------------------------------------------------------------------

function renderWordList() {
  const container = document.getElementById('wordListContainer');
  const countEl = document.getElementById('wordCount');
  const entries = Object.entries(wordMap);

  countEl.textContent = entries.length;

  if (entries.length === 0) {
    container.innerHTML =
      '<p class="no-words">Nenhum par de palavras carregado. ' +
      '<a href="#" id="goToOptions">Adicione palavras na página de opções.</a></p>';
    attachGoToOptions();
    return;
  }

  const sorted = entries.sort((a, b) => a[0].localeCompare(b[0]));
  const rows = sorted
    .map(
      ([k, v]) =>
        `<tr><td class="wl-incorrect">${escapeHtml(k)}</td>` +
        `<td class="wl-arrow">&#8594;</td>` +
        `<td class="wl-correct">${escapeHtml(v)}</td></tr>`
    )
    .join('');

  container.innerHTML =
    '<table class="word-table">' +
    '<thead><tr><th>Incorreto</th><th></th><th>Correto</th></tr></thead>' +
    `<tbody>${rows}</tbody></table>`;
}

function attachGoToOptions() {
  const link = document.getElementById('goToOptions');
  if (link) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  loadAll(() => renderWordList());

  const testArea = document.getElementById('testArea');
  testArea.addEventListener('input', (event) => {
    if (applying) return;
    if (Object.keys(wordMap).length > 0) correctTextarea(testArea);
    if (settings.autoCapitalize) autoCapitalizeTextarea(testArea, event);
  });

  document.getElementById('clearTextBtn').addEventListener('click', () => {
    testArea.value = '';
    testArea.focus();
    const log = document.getElementById('correctionLog');
    log.innerHTML = '<li class="no-corrections">Ainda sem correções</li>';
  });

  attachGoToOptions();
});

