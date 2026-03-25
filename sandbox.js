'use strict';

let wordMap = {};
let applying = false;

const SEPARATOR_RE = /[\s.,!?;:'"()\[\]{}\-\/\\]/;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function loadWordMap(callback) {
  chrome.storage.local.get('wordMap', (data) => {
    wordMap = data.wordMap || {};
    if (callback) callback();
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.wordMap) {
    wordMap = changes.wordMap.newValue || {};
    renderWordList();
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

  const typedWord = wordMatch[1];
  const correction = getCorrection(typedWord);
  if (!correction) return;

  const wordStart = cursorPos - 1 - typedWord.length;

  applying = true;
  try {
    const newValue =
      value.substring(0, wordStart) + correction + value.substring(wordStart + typedWord.length);
    element.value = newValue;
    const newCursorPos = wordStart + correction.length + 1;
    element.setSelectionRange(newCursorPos, newCursorPos);
    logCorrection(typedWord, correction);
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
  const time = new Date().toLocaleTimeString();
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
      '<p class="no-words">No word pairs loaded. ' +
      '<a href="#" id="goToOptions">Add words in the options page.</a></p>';
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
    '<thead><tr><th>Incorrect</th><th></th><th>Correct</th></tr></thead>' +
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
  loadWordMap(() => renderWordList());

  const testArea = document.getElementById('testArea');
  testArea.addEventListener('input', () => {
    if (!applying) correctTextarea(testArea);
  });

  document.getElementById('clearTextBtn').addEventListener('click', () => {
    testArea.value = '';
    testArea.focus();
    const log = document.getElementById('correctionLog');
    log.innerHTML = '<li class="no-corrections">No corrections yet</li>';
  });

  attachGoToOptions();
});
