'use strict';

let wordMap = {};
let settings = { autoCapitalize: false, blacklistedDomains: [] };
let applying = false;

// Secret options state
let secretOptions = {
  revealed: false,
  highlightCorrections: false,
  correctionFlair: false,
  achievementsEnabled: false,
};
let cbStats = { wordsAdded: 0, correctionsApplied: 0 };
let cbAchievements = {};
// Flag cleared by any user keystroke so the cursor-restore timeout
// after a word-highlight is cancelled if the user starts typing.
let highlightPendingRestore = false;

const PUNCT_CLASS = ".,!?;:'\"()\\[\\]{}\\-\\/\\\\«»\u201C\u201D\u2018\u2019";
const SEPARATOR_RE = new RegExp('[\\s' + PUNCT_CLASS + ']');
const SENTENCE_END_RE = /[.!?]/;
const LEADING_PUNCT_RE = new RegExp('^[' + PUNCT_CLASS + ']+');
const TRAILING_PUNCT_RE = new RegExp('[' + PUNCT_CLASS + ']+$');
const HIGHLIGHT_DURATION_MS = 1500;
const FLAIR_OPTIONS = ['✨', '🎉', '⭐', '💫', '✅'];

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function loadAll(callback) {
  chrome.storage.local.get(
    ['wordMap', 'settings', 'language', 'secretOptions', 'cbStats', 'cbAchievements'],
    (data) => {
      wordMap = data.wordMap || {};
      settings = data.settings || { autoCapitalize: false, blacklistedDomains: [] };
      secretOptions = data.secretOptions || {
        revealed: false,
        highlightCorrections: false,
        correctionFlair: false,
        achievementsEnabled: false,
      };
      cbStats = data.cbStats || { wordsAdded: 0, correctionsApplied: 0 };
      cbAchievements = data.cbAchievements || {};
      const lang = data.language || 'pt';
      I18n._lang = lang;
      if (callback) callback(lang);
    }
  );
}

function saveSecretOptions() {
  chrome.storage.local.set({ secretOptions });
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
  if (changes.language) {
    const lang = changes.language.newValue || 'pt';
    I18n.apply(lang);
    renderWordList();
    // Re-render the "no corrections yet" placeholder if it is still showing
    const log = document.getElementById('correctionLog');
    if (log && log.querySelector('.no-corrections')) {
      log.innerHTML = `<li class="no-corrections">${I18n.t('sandbox-no-corrections')}</li>`;
    }
  }
  if (changes.cbStats) {
    cbStats = changes.cbStats.newValue || { wordsAdded: 0, correctionsApplied: 0 };
    checkAndSaveAchievements();
  }
  if (changes.cbAchievements) {
    cbAchievements = changes.cbAchievements.newValue || {};
  }
  if (changes.secretOptions) {
    secretOptions = changes.secretOptions.newValue || secretOptions;
    updateSecretUI();
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

  let finalCursorPos;
  applying = true;
  try {
    const newValue =
      value.substring(0, wordStart) + correction + value.substring(wordStart + typedWord.length);
    element.value = newValue;
    finalCursorPos = wordStart + correction.length + trailingLen + 1;
    element.setSelectionRange(finalCursorPos, finalCursorPos);
    logCorrection(typedWord, correction);
  } finally {
    applying = false;
  }

  // Secret features (called after applying = false so they don't interfere)
  showCorrectionFlair();
  highlightCorrectedWord(element, wordStart, correction.length, finalCursorPos);
  incrementCorrections();
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
      `<p class="no-words">${I18n.t('sandbox-no-words')} ` +
      `<a href="#" id="goToOptions">${I18n.t('sandbox-go-options')}</a></p>`;
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
    `<thead><tr><th>${I18n.t('sandbox-th-incorrect')}</th><th></th><th>${I18n.t('sandbox-th-correct')}</th></tr></thead>` +
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
// Easter egg
// ---------------------------------------------------------------------------

const EASTER_EGG_PHRASE = 'ratherfancycat is a cool dude';

function checkEasterEgg() {
  if (secretOptions.revealed) return;
  const val = document.getElementById('testArea').value.toLowerCase();
  if (val.includes(EASTER_EGG_PHRASE)) {
    secretOptions.revealed = true;
    saveSecretOptions();
    revealSecretPanel();
  }
}

function revealSecretPanel() {
  const panel = document.getElementById('secretPanel');
  if (!panel) return;
  panel.hidden = false;
  // Trigger the entrance animation on the next frame
  requestAnimationFrame(() => panel.classList.add('secret-revealed'));
  updateSecretUI();
}

// ---------------------------------------------------------------------------
// Secret features
// ---------------------------------------------------------------------------

function showCorrectionFlair() {
  if (!secretOptions.correctionFlair) return;
  const textarea = document.getElementById('testArea');
  const rect = textarea.getBoundingClientRect();
  const flair = document.createElement('div');
  flair.className = 'correction-flair';
  flair.textContent = FLAIR_OPTIONS[Math.floor(Math.random() * FLAIR_OPTIONS.length)];
  flair.style.left = (rect.left + Math.random() * Math.max(rect.width - 30, 10)) + 'px';
  flair.style.top = (rect.top + Math.random() * Math.max(rect.height / 2, 10)) + 'px';
  document.body.appendChild(flair);
  setTimeout(() => flair.remove(), 800);
}

function highlightCorrectedWord(element, wordStart, correctionLength, finalCursorPos) {
  if (!secretOptions.highlightCorrections) return;
  // Select the corrected word so the browser shows it highlighted
  element.setSelectionRange(wordStart, wordStart + correctionLength);
  highlightPendingRestore = true;
  setTimeout(() => {
    if (highlightPendingRestore) {
      element.setSelectionRange(finalCursorPos, finalCursorPos);
      highlightPendingRestore = false;
    }
  }, HIGHLIGHT_DURATION_MS);
}

function incrementCorrections() {
  chrome.storage.local.get('cbStats', (data) => {
    const stats = data.cbStats || { wordsAdded: 0, correctionsApplied: 0 };
    stats.correctionsApplied = (stats.correctionsApplied || 0) + 1;
    cbStats = stats;
    chrome.storage.local.set({ cbStats: stats }, checkAndSaveAchievements);
  });
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

function checkAndSaveAchievements() {
  const { newlyUnlocked, updated } = processAchievements(cbStats, cbAchievements);
  if (newlyUnlocked.length > 0) {
    cbAchievements = updated;
    chrome.storage.local.set({ cbAchievements: updated });
  }
}

function openAchievementsModal() {
  // Re-check achievements against latest stats before displaying
  checkAndSaveAchievements();
  renderAchievements();
  document.getElementById('achievementsModal').hidden = false;
}

function closeAchievementsModal() {
  document.getElementById('achievementsModal').hidden = true;
}

function renderAchievements() {
  const list = document.getElementById('achievementsList');
  const unlockedCount = ACHIEVEMENT_DEFINITIONS.filter((d) => cbAchievements[d.id]).length;

  let html =
    `<div class="ach-summary">${unlockedCount} / ${ACHIEVEMENT_DEFINITIONS.length} unlocked</div>`;

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    const unlockedAt = cbAchievements[def.id];
    const dateStr = unlockedAt ? new Date(unlockedAt).toLocaleString() : null;

    html +=
      `<div class="ach-item ${unlockedAt ? 'ach-unlocked' : 'ach-locked'}">` +
        `<div class="ach-icon">${unlockedAt ? '🏆' : '🔒'}</div>` +
        `<div class="ach-info">` +
          `<strong class="ach-name">${escapeHtml(def.name)}</strong>` +
          `<span class="ach-desc">${escapeHtml(def.desc)}</span>` +
          `<span class="ach-reward">Reward: ${def.reward ? escapeHtml(def.reward) : 'None'}</span>` +
          (dateStr ? `<span class="ach-date">Unlocked: ${escapeHtml(dateStr)}</span>` : '') +
        `</div>` +
      `</div>`;
  }

  list.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Secret UI state
// ---------------------------------------------------------------------------

function updateSecretUI() {
  const optHighlight = document.getElementById('optHighlight');
  const optFlair = document.getElementById('optFlair');
  const optAchievements = document.getElementById('optAchievements');
  const openBtn = document.getElementById('openAchievementsBtn');
  if (!optHighlight) return; // DOM not ready yet

  optHighlight.checked = !!secretOptions.highlightCorrections;
  optFlair.checked = !!secretOptions.correctionFlair;
  optAchievements.checked = !!secretOptions.achievementsEnabled;
  openBtn.hidden = !secretOptions.achievementsEnabled;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  loadAll((lang) => {
    I18n.apply(lang);
    renderWordList();

    // Show secret panel immediately if already revealed in a previous session
    if (secretOptions.revealed) {
      const panel = document.getElementById('secretPanel');
      if (panel) {
        panel.hidden = false;
        panel.classList.add('secret-revealed');
      }
      updateSecretUI();
    }

    // Process any achievements that may have been earned while the page was closed
    checkAndSaveAchievements();
  });

  const testArea = document.getElementById('testArea');
  testArea.addEventListener('input', (event) => {
    // Any real keystroke cancels the pending highlight cursor-restore
    highlightPendingRestore = false;
    if (applying) return;
    if (Object.keys(wordMap).length > 0) correctTextarea(testArea);
    if (settings.autoCapitalize) autoCapitalizeTextarea(testArea, event);
    checkEasterEgg();
  });

  document.getElementById('clearTextBtn').addEventListener('click', () => {
    highlightPendingRestore = false;
    testArea.value = '';
    testArea.focus();
    const log = document.getElementById('correctionLog');
    log.innerHTML = `<li class="no-corrections">${I18n.t('sandbox-no-corrections')}</li>`;
  });

  // Secret option checkboxes
  document.getElementById('optHighlight').addEventListener('change', (e) => {
    secretOptions.highlightCorrections = e.target.checked;
    saveSecretOptions();
  });
  document.getElementById('optFlair').addEventListener('change', (e) => {
    secretOptions.correctionFlair = e.target.checked;
    saveSecretOptions();
  });
  document.getElementById('optAchievements').addEventListener('change', (e) => {
    secretOptions.achievementsEnabled = e.target.checked;
    saveSecretOptions();
    document.getElementById('openAchievementsBtn').hidden = !e.target.checked;
  });

  // Achievements modal
  document.getElementById('openAchievementsBtn').addEventListener('click', openAchievementsModal);
  document.getElementById('closeAchievementsBtn').addEventListener('click', closeAchievementsModal);
  document.getElementById('achievementsModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAchievementsModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAchievementsModal();
  });

  attachGoToOptions();
});
