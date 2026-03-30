'use strict';

let wordMap = {};
let settings = { autoCapitalize: false, blacklistedDomains: [] };
let applying = false;

// Flag to suppress auto-capitalisation for the current sentence (mirrors content.js)
let skipCapForThisSentence = false;

// Secret options state
let secretOptions = {
  revealed: false,
  highlightCorrections: false,
  correctionFlair: false,
  xpBar: false,
  xpBarXp: 0,
};
let cbStats = { wordsAdded: 0, correctionsApplied: 0 };
let cbAchievements = {};

const PUNCT_CLASS = ".,!?;:'\"()\\[\\]{}\\-\\/\\\\«»\u201C\u201D\u2018\u2019";
const SEPARATOR_RE = new RegExp('[\\s' + PUNCT_CLASS + ']');
const SENTENCE_END_RE = /[.!?]/;
const LEADING_PUNCT_RE = new RegExp('^[' + PUNCT_CLASS + ']+');
const TRAILING_PUNCT_RE = new RegExp('[' + PUNCT_CLASS + ']+$');
const FLAIR_OPTIONS = ['✨', '🎉', '⭐', '💫', '✅'];

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/**
 * Returns true when a KeyboardEvent matches a stored keybind string
 * like "Alt+K", "Ctrl+Shift+F", etc.
 */
function matchesKeybind(event, keybindStr) {
  if (!keybindStr) return false;
  const parts = keybindStr.split('+');
  const mainKey = parts[parts.length - 1];
  const needsAlt   = parts.includes('Alt');
  const needsCtrl  = parts.includes('Ctrl');
  const needsShift = parts.includes('Shift');
  const needsMeta  = parts.includes('Meta');
  const eventKey = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  const bindKey  = mainKey.length === 1  ? mainKey.toUpperCase()  : mainKey;
  return (
    eventKey === bindKey &&
    event.altKey   === needsAlt   &&
    event.ctrlKey  === needsCtrl  &&
    event.shiftKey === needsShift &&
    event.metaKey  === needsMeta
  );
}

function loadAll(callback) {
  chrome.storage.local.get(
    ['wordMap', 'settings', 'language', 'secretOptions', 'cbStats', 'cbAchievements', 'theme'],
    (data) => {
      wordMap = data.wordMap || {};
      settings = data.settings || { autoCapitalize: false, blacklistedDomains: [] };
      secretOptions = data.secretOptions || {
        revealed: false,
        highlightCorrections: false,
        correctionFlair: false,
        xpBar: false,
        xpBarXp: 0,
      };
      cbStats = data.cbStats || { wordsAdded: 0, correctionsApplied: 0 };
      cbAchievements = data.cbAchievements || {};
      const lang = data.language || 'pt';
      I18n._lang = lang;
      applyTheme(data.theme || 'light');
      if (callback) callback(lang);
    }
  );
}

function saveSecretOptions() {
  chrome.storage.local.set({ secretOptions });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  const btn = document.getElementById('headerThemeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.wordMap) {
    wordMap = changes.wordMap.newValue || {};
    renderWordList();
  }
  if (changes.settings) {
    settings = changes.settings.newValue || { autoCapitalize: false, blacklistedDomains: [] };
    if (!settings.autoCapitalize || !settings.skipCapEnabled) {
      skipCapForThisSentence = false;
    }
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
  if (changes.theme) {
    applyTheme(changes.theme.newValue || 'light');
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

  // Secret features (called after applying = false so they don't interfere)
  showCorrectionFlair();
  highlightCorrectedWord(element, wordStart, correction.length);
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
  if (skipCapForThisSentence) return;
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
  const time = new Date().toLocaleTimeString(I18n.locale());
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
  const val = document.getElementById('testArea').value.toLowerCase();
  if (!val.includes(EASTER_EGG_PHRASE)) return;

  // Only act if at least one achievement is still locked
  const allAlreadyUnlocked = ACHIEVEMENT_DEFINITIONS.every((d) => cbAchievements[d.id]);
  if (allAlreadyUnlocked) return;

  // Unlock every achievement at once
  const now = new Date().toISOString();
  const newlyUnlocked = [];
  ACHIEVEMENT_DEFINITIONS.forEach((d) => {
    if (!cbAchievements[d.id]) {
      cbAchievements[d.id] = now;
      newlyUnlocked.push(d);
    }
  });
  chrome.storage.local.set({ cbAchievements });

  // Grant all rewards automatically
  secretOptions.highlightCorrections = true;
  secretOptions.correctionFlair = true;
  secretOptions.xpBar = true;
  secretOptions.revealed = true;
  saveSecretOptions();

  revealSecretPanel();

  // Show a toast for each newly unlocked achievement, staggered
  newlyUnlocked.forEach((def, i) => {
    setTimeout(() => showAchievementToast(def), i * 400);
  });
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

function highlightCorrectedWord(element, wordStart, wordLength) {
  if (!secretOptions.highlightCorrections) return;
  const wrapper = element.closest('.textarea-wrapper');
  if (!wrapper) return;

  // Build a hidden mirror div that exactly replicates the textarea's text layout
  // so we can measure the pixel position of the corrected word.
  const cs = window.getComputedStyle(element);
  const mirror = document.createElement('div');
  [
    'boxSizing', 'width',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
    'wordSpacing', 'tabSize', 'lineHeight',
  ].forEach((p) => { mirror.style[p] = cs[p]; });
  mirror.style.position = 'absolute';
  mirror.style.top = '0';
  mirror.style.left = '0';
  mirror.style.visibility = 'hidden';
  mirror.style.overflow = 'hidden';
  mirror.style.height = element.offsetHeight + 'px';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';

  const text = element.value;
  const markEl = document.createElement('mark');
  markEl.textContent = text.substring(wordStart, wordStart + wordLength);
  mirror.appendChild(document.createTextNode(text.substring(0, wordStart)));
  mirror.appendChild(markEl);
  wrapper.appendChild(mirror);
  mirror.scrollTop = element.scrollTop;

  const markRect = markEl.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();
  mirror.remove();

  if (markRect.width === 0 || markRect.height === 0) return;

  const hl = document.createElement('div');
  hl.className = 'correction-word-flash';
  hl.style.left = (markRect.left - wrapperRect.left) + 'px';
  hl.style.top = (markRect.top - wrapperRect.top) + 'px';
  hl.style.width = markRect.width + 'px';
  hl.style.height = markRect.height + 'px';
  wrapper.appendChild(hl);
  setTimeout(() => hl.remove(), 1500);
}

function incrementCorrections() {
  chrome.storage.local.get('cbStats', (data) => {
    const stats = data.cbStats || { wordsAdded: 0, correctionsApplied: 0 };
    stats.correctionsApplied = (stats.correctionsApplied || 0) + 1;
    cbStats = stats;
    if (secretOptions.xpBar) {
      secretOptions.xpBarXp = (secretOptions.xpBarXp || 0) + 1;
      chrome.storage.local.set({ cbStats: stats, secretOptions }, checkAndSaveAchievements);
    } else {
      chrome.storage.local.set({ cbStats: stats }, checkAndSaveAchievements);
    }
  });
}

// ---------------------------------------------------------------------------
// XP / Level helpers
// ---------------------------------------------------------------------------

/**
 * Compute the current level and XP progress from a total XP value.
 * Required XP to level up from level N = N * 6.
 * (Total XP to reach level N = 3 * N * (N - 1).)
 *
 * @param {number} totalXp
 * @returns {{ level: number, currentXp: number, requiredXp: number }}
 */
function computeLevel(totalXp) {
  let level = 1;
  let xpUsed = 0;
  while (true) {
    const needed = level * 6;
    if (xpUsed + needed > totalXp) break;
    xpUsed += needed;
    level++;
  }
  return { level, currentXp: totalXp - xpUsed, requiredXp: level * 6 };
}

/** Refresh the XP bar widget to reflect the current XP earned while the option is enabled. */
function updateXpBar() {
  const fill = document.getElementById('xpBarFill');
  const levelEl = document.getElementById('xpBarLevel');
  if (!fill || !levelEl) return;
  const { level, currentXp, requiredXp } = computeLevel(secretOptions.xpBarXp || 0);
  fill.style.width = (requiredXp > 0 ? Math.min(100, (currentXp / requiredXp) * 100) : 0) + '%';
  levelEl.textContent = level;
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

function checkAndSaveAchievements() {
  const { newlyUnlocked, updated } = processAchievements(cbStats, cbAchievements);
  if (newlyUnlocked.length > 0) {
    cbAchievements = updated;
    chrome.storage.local.set({ cbAchievements: updated });

    let secretChanged = false;
    let shouldReveal = false;

    // Show a toast and apply any reward for each newly unlocked achievement
    newlyUnlocked.forEach((id, i) => {
      const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === id);
      if (!def) return;

      if (def.reward === 'highlight' && !secretOptions.highlightCorrections) {
        secretOptions.highlightCorrections = true;
        secretChanged = true;
        shouldReveal = true;
      } else if (def.reward === 'flair' && !secretOptions.correctionFlair) {
        secretOptions.correctionFlair = true;
        secretChanged = true;
        shouldReveal = true;
      } else if (def.reward === 'xpbar') {
        shouldReveal = true;
      }

      setTimeout(() => showAchievementToast(def), i * 400);
    });

    if (shouldReveal) {
      secretOptions.revealed = true;
      secretChanged = true;
      revealSecretPanel();
    }

    if (secretChanged) {
      saveSecretOptions();
    }
  }
  // Always keep the XP bar up to date whenever stats change
  updateXpBar();
}

// ---------------------------------------------------------------------------
// Achievement toast notifications
// ---------------------------------------------------------------------------

function showAchievementToast(def) {
  // Stack toasts upward: each new toast sits above existing ones
  const existing = document.querySelectorAll('.ach-toast');
  const bottomOffset = 20 + existing.length * 76; // 76px stride per toast (≈68px height + 8px gap)

  const toast = document.createElement('div');
  toast.className = 'ach-toast';
  toast.style.bottom = bottomOffset + 'px';
  toast.innerHTML =
    `<span class="ach-toast-icon">🏆</span>` +
    `<div class="ach-toast-body">` +
      `<strong>${I18n.t('ach-toast-title')}</strong>` +
      `<span title="${escapeHtml(I18n.t('ach-' + def.id + '-name'))}">${escapeHtml(I18n.t('ach-' + def.id + '-name'))}</span>` +
    `</div>`;
  document.body.appendChild(toast);

  // Slide in on next frame
  requestAnimationFrame(() => toast.classList.add('ach-toast-visible'));

  // Slide out after 3.5 s
  setTimeout(() => {
    toast.classList.remove('ach-toast-visible');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ---------------------------------------------------------------------------
// Secret UI state
// ---------------------------------------------------------------------------

function updateSecretUI() {
  const optHighlight = document.getElementById('optHighlight');
  const optFlair = document.getElementById('optFlair');
  const optXpBar = document.getElementById('optXpBar');
  if (!optHighlight) return; // DOM not ready yet

  optHighlight.checked = !!secretOptions.highlightCorrections;
  optFlair.checked = !!secretOptions.correctionFlair;
  if (optXpBar) optXpBar.checked = !!secretOptions.xpBar;

  // Show each reward row only if its corresponding achievement has been earned
  const highlightEarned = ACHIEVEMENT_DEFINITIONS.some((d) => d.reward === 'highlight' && cbAchievements[d.id]);
  const flairEarned = ACHIEVEMENT_DEFINITIONS.some((d) => d.reward === 'flair' && cbAchievements[d.id]);
  const xpBarEarned = ACHIEVEMENT_DEFINITIONS.some((d) => d.reward === 'xpbar' && cbAchievements[d.id]);

  const highlightRow = document.getElementById('optHighlightRow');
  const flairRow = document.getElementById('optFlairRow');
  const xpBarRow = document.getElementById('optXpBarRow');
  if (highlightRow) highlightRow.hidden = !highlightEarned;
  if (flairRow) flairRow.hidden = !flairEarned;
  if (xpBarRow) xpBarRow.hidden = !xpBarEarned;

  // Show/hide the XP bar widget based on whether the option is enabled
  const xpBarWidget = document.getElementById('xpBarWidget');
  const xpBarDesc = document.getElementById('xpBarDesc');
  if (xpBarWidget) xpBarWidget.hidden = !secretOptions.xpBar;
  if (xpBarDesc) xpBarDesc.hidden = !!secretOptions.xpBar;
  if (secretOptions.xpBar) updateXpBar();
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

  // Skip-cap keybind listener on the test area
  testArea.addEventListener('keydown', (e) => {
    if (!settings.autoCapitalize || !settings.skipCapEnabled) return;
    if (matchesKeybind(e, settings.skipCapKey || 'Alt+K')) {
      skipCapForThisSentence = true;
      e.preventDefault();
    }
  });

  testArea.addEventListener('input', (event) => {
    if (applying) return;
    if (Object.keys(wordMap).length > 0) correctTextarea(testArea);
    if (settings.autoCapitalize) {
      // Reset skip flag when a sentence-ending character or newline is typed
      if (skipCapForThisSentence && settings.skipCapEnabled) {
        const typedChar = event.data;
        const inputType = event.inputType;
        if (
          (typedChar && (SENTENCE_END_RE.test(typedChar) || typedChar === '\n')) ||
          inputType === 'insertParagraph' ||
          inputType === 'insertLineBreak'
        ) {
          skipCapForThisSentence = false;
        }
      }
      autoCapitalizeTextarea(testArea, event);
    }
    checkEasterEgg();
  });

  document.getElementById('clearTextBtn').addEventListener('click', () => {
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
  document.getElementById('optXpBar').addEventListener('change', (e) => {
    secretOptions.xpBar = e.target.checked;
    saveSecretOptions();
    const xpBarWidget = document.getElementById('xpBarWidget');
    const xpBarDesc = document.getElementById('xpBarDesc');
    if (xpBarWidget) xpBarWidget.hidden = !secretOptions.xpBar;
    if (xpBarDesc) xpBarDesc.hidden = !!secretOptions.xpBar;
    if (secretOptions.xpBar) updateXpBar();
  });

  // Header theme toggle
  document.getElementById('headerThemeToggle').addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    applyTheme(newTheme);
    chrome.storage.local.set({ theme: newTheme });
  });

  attachGoToOptions();
});
