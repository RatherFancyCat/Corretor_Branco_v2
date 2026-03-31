'use strict';

let wordMap = {};
let enabled = true;
let settings = { autoCapitalize: false, blacklistedDomains: [] };
let blockedByDomain = false;
let currentLang = 'pt';

// Flag to prevent re-entrant corrections when we programmatically set element.value
let applying = false;

const FLAIR_OPTIONS = ['✨', '🎉', '⭐', '💫', '✅'];
let secretOptions = { revealed: false, highlightCorrections: false, correctionFlair: false };

// Flag to suppress auto-capitalisation for the current sentence.
// Set by the user's keybind; cleared on the next sentence-ending character.
let skipCapForThisSentence = false;

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
  // Normalise single characters to upper-case for case-insensitive comparison
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

function checkDomainBlock() {
  const hostname = window.location.hostname;
  const domains = (settings && settings.blacklistedDomains) || [];
  blockedByDomain = domains.some(
    (d) => d && (hostname === d || hostname.endsWith('.' + d))
  );
}

function loadSettings() {
  chrome.storage.local.get(['wordMap', 'enabled', 'settings', 'language', 'secretOptions'], (data) => {
    wordMap = data.wordMap || {};
    enabled = data.enabled !== false;
    settings = data.settings || { autoCapitalize: false, blacklistedDomains: [] };
    currentLang = data.language || 'pt';
    secretOptions = data.secretOptions || { revealed: false, highlightCorrections: false, correctionFlair: false };
    checkDomainBlock();
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.wordMap) wordMap = changes.wordMap.newValue || {};
  if (changes.enabled !== undefined) enabled = changes.enabled.newValue !== false;
  if (changes.settings) {
    settings = changes.settings.newValue || { autoCapitalize: false, blacklistedDomains: [] };
    if (!settings.autoCapitalize || !settings.skipCapEnabled) {
      skipCapForThisSentence = false;
    }
    checkDomainBlock();
  }
  if (changes.language) currentLang = changes.language.newValue || 'pt';
  if (changes.secretOptions) secretOptions = changes.secretOptions.newValue || secretOptions;
});

loadSettings();

// Listen for the skip-capitalisation keybind and the Alt+Q cursor locator keybind.
// Uses capture so it fires even when a text field has focus.
document.addEventListener('keydown', (e) => {
  if (!enabled || blockedByDomain) return;

  // Skip-capitalisation keybind
  if (settings.autoCapitalize && settings.skipCapEnabled) {
    if (matchesKeybind(e, settings.skipCapKey || 'Alt+K')) {
      skipCapForThisSentence = true;
      e.preventDefault();
      return;
    }
  }

  // Cursor locator keybind – works in any text input on any page
  if (secretOptions.cursorLocator && matchesKeybind(e, secretOptions.cursorLocatorKey || 'Alt+Q')) {
    const el = document.activeElement;
    if (el) {
      const isTextInput =
        ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.type !== 'password') ||
        !!el.isContentEditable;
      if (isTextInput) {
        showCursorLocator(el);
        e.preventDefault();
      }
    }
  }
}, true);

// ---------------------------------------------------------------------------
// Stats tracking (for achievements)
// ---------------------------------------------------------------------------

// Counts toasts currently on screen so each new one stacks above the last.
let __cbToastCount = 0;

/** Render an achievement toast notification on the active web page. */
function showAchievementToastOnPage(def) {
  const DISPLAY_MS = 7000;
  const SLIDE_MS   = 400;

  const bottomOffset = 20 + __cbToastCount * 130;
  __cbToastCount++;

  // ── Outer toast container ────────────────────────────────────────────────
  const toast = document.createElement('div');
  Object.assign(toast.style, {
    position: 'fixed',
    right: '-380px',
    bottom: bottomOffset + 'px',
    width: '340px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    borderRadius: '10px',
    padding: '12px 16px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.28)',
    transition: 'right ' + SLIDE_MS + 'ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    zIndex: '2147483647',
    pointerEvents: 'auto',
    userSelect: 'none',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxSizing: 'border-box',
  });

  // ── Top row: icon + text + dismiss ──────────────────────────────────────
  const topRow = document.createElement('div');
  Object.assign(topRow.style, {
    display: 'flex', alignItems: 'center', gap: '10px',
  });

  const icon = document.createElement('span');
  Object.assign(icon.style, { fontSize: '26px', flexShrink: '0' });
  icon.textContent = '🏆';

  const body = document.createElement('div');
  Object.assign(body.style, {
    display: 'flex', flexDirection: 'column', gap: '2px',
    minWidth: '0', overflow: 'hidden', flex: '1',
  });

  const titleEl = document.createElement('strong');
  Object.assign(titleEl.style, {
    fontSize: '12px', letterSpacing: '0.3px', opacity: '0.85',
    textTransform: 'uppercase', display: 'block',
  });
  titleEl.textContent = I18n.t('ach-toast-title');

  const nameEl = document.createElement('span');
  Object.assign(nameEl.style, {
    fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap',
    overflow: 'hidden', textOverflow: 'ellipsis', display: 'block',
  });
  nameEl.textContent = I18n.t('ach-' + def.id + '-name');

  body.appendChild(titleEl);
  body.appendChild(nameEl);

  // Dismiss (×) button
  const dismissBtn = document.createElement('button');
  Object.assign(dismissBtn.style, {
    background: 'rgba(255,255,255,0.20)',
    border: 'none',
    color: '#fff',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
    alignSelf: 'flex-start',
    padding: '0',
    lineHeight: '1',
  });
  dismissBtn.title = I18n.t('ach-toast-btn-dismiss');
  dismissBtn.textContent = '✕';
  dismissBtn.addEventListener('click', () => slideOut());

  topRow.appendChild(icon);
  topRow.appendChild(body);
  topRow.appendChild(dismissBtn);

  // ── Bottom row: action buttons ───────────────────────────────────────────
  const btnRow = document.createElement('div');
  Object.assign(btnRow.style, {
    display: 'flex', gap: '6px', justifyContent: 'flex-end',
  });

  const makeBtn = (label) => {
    const b = document.createElement('button');
    Object.assign(b.style, {
      background: 'rgba(255,255,255,0.20)',
      border: '1px solid rgba(255,255,255,0.35)',
      color: '#fff',
      borderRadius: '6px',
      padding: '4px 10px',
      fontSize: '12px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontWeight: '600',
      whiteSpace: 'nowrap',
    });
    b.textContent = label;
    b.addEventListener('mouseenter', () => { b.style.background = 'rgba(255,255,255,0.35)'; });
    b.addEventListener('mouseleave', () => { b.style.background = 'rgba(255,255,255,0.20)'; });
    return b;
  };

  // "View Achievements" — shows an in-page achievement list panel
  const viewListBtn = makeBtn(I18n.t('ach-toast-btn-view-list'));
  viewListBtn.addEventListener('click', () => {
    slideOut();
    showAchievementListPanel();
  });
  btnRow.appendChild(viewListBtn);

  // "View Reward" — only when the achievement has a reward; opens sandbox tab
  if (def.reward) {
    const viewRewardBtn = makeBtn(I18n.t('ach-toast-btn-view-reward'));
    viewRewardBtn.addEventListener('click', () => {
      slideOut();
      chrome.runtime.sendMessage({ action: 'openSandbox' });
    });
    btnRow.appendChild(viewRewardBtn);
  }

  toast.appendChild(topRow);
  toast.appendChild(btnRow);
  document.body.appendChild(toast);

  // ── Auto-slide lifecycle ─────────────────────────────────────────────────
  let dismissed = false;
  let slideOutTimer;

  function slideOut() {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(slideOutTimer);
    toast.style.right = '-380px';
    setTimeout(() => {
      toast.remove();
      __cbToastCount = Math.max(0, __cbToastCount - 1);
    }, SLIDE_MS);
  }

  // Slide in on next frame
  requestAnimationFrame(() => { toast.style.right = '20px'; });

  // Slide out after DISPLAY_MS
  slideOutTimer = setTimeout(slideOut, DISPLAY_MS);
}

// ---------------------------------------------------------------------------
// In-page achievement list panel (shown when "View Achievements" is clicked)
// ---------------------------------------------------------------------------

function showAchievementListPanel() {
  // Only one panel at a time
  if (document.getElementById('__cb_ach_panel__')) return;

  chrome.storage.local.get(['cbAchievements'], (data) => {
    const achievements = data.cbAchievements || {};

    // ── Backdrop ──────────────────────────────────────────────────────────
    const backdrop = document.createElement('div');
    backdrop.id = '__cb_ach_panel__';
    Object.assign(backdrop.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '2147483646',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    // ── Dialog ────────────────────────────────────────────────────────────
    const dialog = document.createElement('div');
    Object.assign(dialog.style, {
      background: '#fff',
      borderRadius: '12px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      width: '480px',
      maxWidth: '90vw',
      maxHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box',
    });

    // ── Header ────────────────────────────────────────────────────────────
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '18px 20px',
      borderBottom: '1px solid #eee',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#fff',
      flexShrink: '0',
    });

    const headerTitle = document.createElement('h2');
    Object.assign(headerTitle.style, {
      margin: '0', fontSize: '17px', fontWeight: '700', color: '#fff',
    });
    headerTitle.textContent = I18n.t('modal-achievements-h2');

    const closeBtn = document.createElement('button');
    Object.assign(closeBtn.style, {
      background: 'rgba(255,255,255,0.2)',
      border: 'none',
      color: '#fff',
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      cursor: 'pointer',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => backdrop.remove());

    header.appendChild(headerTitle);
    header.appendChild(closeBtn);

    // ── Achievement list ──────────────────────────────────────────────────
    const listEl = document.createElement('div');
    Object.assign(listEl.style, {
      overflowY: 'auto',
      padding: '16px',
      flex: '1',
    });

    const unlockedCount = ACHIEVEMENT_DEFINITIONS.filter((d) => achievements[d.id]).length;

    const summary = document.createElement('div');
    Object.assign(summary.style, {
      textAlign: 'center',
      fontSize: '13px',
      color: '#888',
      marginBottom: '14px',
      padding: '8px',
      background: '#f8f9fa',
      borderRadius: '6px',
    });
    summary.textContent = I18n.t('ach-summary', {
      unlocked: unlockedCount,
      total: ACHIEVEMENT_DEFINITIONS.length,
    });
    listEl.appendChild(summary);

    for (const def of ACHIEVEMENT_DEFINITIONS) {
      const unlockedAt = achievements[def.id];
      const isUnlocked = !!unlockedAt;

      const item = document.createElement('div');
      Object.assign(item.style, {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '8px',
        border: '1px solid ' + (isUnlocked ? '#86efac' : '#eee'),
        background: isUnlocked ? '#f0fdf4' : '#fafafa',
        opacity: isUnlocked ? '1' : '0.65',
      });

      const itemIcon = document.createElement('div');
      Object.assign(itemIcon.style, { fontSize: '24px', flexShrink: '0', marginTop: '1px' });
      itemIcon.textContent = isUnlocked ? '🏆' : '🔒';

      const info = document.createElement('div');
      Object.assign(info.style, {
        display: 'flex', flexDirection: 'column', gap: '3px', flex: '1',
      });

      const achName = document.createElement('strong');
      Object.assign(achName.style, { fontSize: '14px', color: '#333' });
      achName.textContent = I18n.t('ach-' + def.id + '-name');

      const achDesc = document.createElement('span');
      Object.assign(achDesc.style, { fontSize: '12px', color: '#666' });
      achDesc.textContent = I18n.t('ach-' + def.id + '-desc');

      const rewardText = def.reward
        ? I18n.t('ach-reward-' + def.reward)
        : I18n.t('ach-reward-none');
      const achReward = document.createElement('span');
      Object.assign(achReward.style, { fontSize: '11px', color: '#999', fontStyle: 'italic' });
      achReward.textContent = I18n.t('ach-reward-label') + ' ' + rewardText;

      info.appendChild(achName);
      info.appendChild(achDesc);
      info.appendChild(achReward);

      if (unlockedAt) {
        const achDate = document.createElement('span');
        Object.assign(achDate.style, { fontSize: '11px', color: '#22c55e', fontWeight: '600', marginTop: '2px' });
        achDate.textContent = I18n.t('ach-unlocked-on') + ' ' + new Date(unlockedAt).toLocaleString(I18n.locale());
        info.appendChild(achDate);
      }

      item.appendChild(itemIcon);
      item.appendChild(info);
      listEl.appendChild(item);
    }

    dialog.appendChild(header);
    dialog.appendChild(listEl);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
  });
}

function recordCorrection() {
  chrome.storage.local.get(['cbStats', 'cbAchievements', 'secretOptions'], (data) => {
    const stats = data.cbStats || { wordsAdded: 0, correctionsApplied: 0 };
    stats.correctionsApplied = (stats.correctionsApplied || 0) + 1;

    const currentAchievements = data.cbAchievements || {};
    const { newlyUnlocked, updated } = processAchievements(stats, currentAchievements);

    if (newlyUnlocked.length > 0) {
      // Grant any rewards and mark the secret panel as revealed
      const opts = data.secretOptions || { revealed: false, highlightCorrections: false, correctionFlair: false };
      let secretChanged = false;
      newlyUnlocked.forEach((id) => {
        const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === id);
        if (!def) return;
        if (def.reward === 'highlight' && !opts.highlightCorrections) {
          opts.highlightCorrections = true;
          opts.revealed = true;
          secretChanged = true;
        } else if (def.reward === 'flair' && !opts.correctionFlair) {
          opts.correctionFlair = true;
          opts.revealed = true;
          secretChanged = true;
        } else if ((def.reward === 'xpbar' || def.reward === 'cursorlocator') && !opts.revealed) {
          opts.revealed = true;
          secretChanged = true;
        }
      });

      // Save stats + newly unlocked achievements atomically (and secretOptions if changed).
      // Saving cbAchievements together with cbStats means sandbox.js's onChanged listener
      // will see the updated cbAchievements before it calls checkAndSaveAchievements(),
      // preventing duplicate toasts when the sandbox page is also open.
      const toSave = { cbStats: stats, cbAchievements: updated };
      if (secretChanged) {
        toSave.secretOptions = opts;
        secretOptions = opts;
      }
      chrome.storage.local.set(toSave, () => {
        newlyUnlocked.forEach((id, i) => {
          const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === id);
          if (def) setTimeout(() => showAchievementToastOnPage(def), i * 400);
        });
      });
    } else {
      chrome.storage.local.set({ cbStats: stats });
    }
  });
}

// ---------------------------------------------------------------------------
// Secret reward features
// ---------------------------------------------------------------------------

/**
 * Lazily inject the CSS keyframe animations needed by the reward effects.
 * Only runs once per document; uses an id-guard to avoid duplicates.
 */
function ensureContentStyles() {
  if (document.getElementById('__cb_content_styles__')) return;
  const s = document.createElement('style');
  s.id = '__cb_content_styles__';
  s.textContent =
    '@keyframes __cb_flair_float__{' +
    '0%{opacity:1;transform:translateY(0) scale(1) rotate(0deg)}' +
    '100%{opacity:0;transform:translateY(-60px) scale(1.5) rotate(20deg)}}' +
    '@keyframes __cb_word_flash__{' +
    '0%{opacity:.7}100%{opacity:0}}' +
    '@keyframes __cb_cursor_beacon__{' +
    '0%{opacity:1;transform:translateY(0)}' +
    '60%{opacity:1;transform:translateY(-5px)}' +
    '100%{opacity:0;transform:translateY(-14px)}}' +
    '@keyframes __cb_cursor_ring__{' +
    '0%{transform:scale(1);opacity:.9}' +
    '100%{transform:scale(2.8);opacity:0}}';
  (document.head || document.documentElement).appendChild(s);
}

/** Show a floating emoji burst near the element that was just corrected. */
function showCorrectionFlair(element) {
  if (!secretOptions.correctionFlair) return;
  ensureContentStyles();
  const rect = element.getBoundingClientRect();
  const flair = document.createElement('div');
  Object.assign(flair.style, {
    position: 'fixed',
    fontSize: '22px',
    left: (rect.left + Math.random() * Math.max(rect.width - 30, 10)) + 'px',
    top: (rect.top + Math.random() * Math.max(rect.height / 2, 10)) + 'px',
    pointerEvents: 'none',
    zIndex: '2147483647',
    userSelect: 'none',
    animation: '__cb_flair_float__ 0.8s ease-out forwards',
  });
  flair.textContent = FLAIR_OPTIONS[Math.floor(Math.random() * FLAIR_OPTIONS.length)];
  document.body.appendChild(flair);
  setTimeout(() => flair.remove(), 800);
}

/**
 * Overlay a brief green highlight over the corrected word in an input/textarea.
 * Uses the "mirror div" technique to measure the word's pixel position without
 * altering the element's content or cursor.
 */
function highlightCorrectedWord(element, wordStart, wordLength) {
  if (!secretOptions.highlightCorrections) return;
  ensureContentStyles();

  const cs = window.getComputedStyle(element);
  const mirror = document.createElement('div');
  [
    'boxSizing', 'width',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
    'wordSpacing', 'tabSize', 'lineHeight',
  ].forEach((p) => { mirror.style[p] = cs[p]; });

  const elRect = element.getBoundingClientRect();
  Object.assign(mirror.style, {
    position: 'fixed',
    top: elRect.top + 'px',
    left: elRect.left + 'px',
    visibility: 'hidden',
    overflow: 'hidden',
    height: element.offsetHeight + 'px',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  });

  const text = element.value;
  const markEl = document.createElement('mark');
  markEl.textContent = text.substring(wordStart, wordStart + wordLength);
  mirror.appendChild(document.createTextNode(text.substring(0, wordStart)));
  mirror.appendChild(markEl);
  document.body.appendChild(mirror);
  mirror.scrollTop = element.scrollTop;

  const markRect = markEl.getBoundingClientRect();
  mirror.remove();

  if (markRect.width === 0 || markRect.height === 0) return;

  const hl = document.createElement('div');
  Object.assign(hl.style, {
    position: 'fixed',
    left: markRect.left + 'px',
    top: markRect.top + 'px',
    width: markRect.width + 'px',
    height: markRect.height + 'px',
    background: 'rgba(39,174,96,0.4)',
    borderRadius: '2px',
    pointerEvents: 'none',
    zIndex: '2147483647',
    animation: '__cb_word_flash__ 5.5s ease-out forwards',
  });
  document.body.appendChild(hl);
  setTimeout(() => hl.remove(), 5500);
}

/**
 * Same as highlightCorrectedWord but for a contenteditable text node.
 * Uses the Range API to get the exact bounding rect of the word.
 */
function highlightCorrectedWordCE(node, wordStart, wordLength) {
  if (!secretOptions.highlightCorrections) return;
  ensureContentStyles();

  const startOffset = Math.min(wordStart, node.textContent.length);
  const endOffset = Math.min(wordStart + wordLength, node.textContent.length);
  if (startOffset >= endOffset) return;

  const range = document.createRange();
  range.setStart(node, startOffset);
  range.setEnd(node, endOffset);
  const markRect = range.getBoundingClientRect();

  if (markRect.width === 0 || markRect.height === 0) return;

  const hl = document.createElement('div');
  Object.assign(hl.style, {
    position: 'fixed',
    left: markRect.left + 'px',
    top: markRect.top + 'px',
    width: markRect.width + 'px',
    height: markRect.height + 'px',
    background: 'rgba(39,174,96,0.4)',
    borderRadius: '2px',
    pointerEvents: 'none',
    zIndex: '2147483647',
    animation: '__cb_word_flash__ 1.5s ease-out forwards',
  });
  document.body.appendChild(hl);
  setTimeout(() => hl.remove(), 1500);
}

/**
 * Show a beacon pointing at the cursor's current position in the given element.
 * Triggered by the Alt+Q keybind when the cursor locator reward is active.
 */
function showCursorLocator(el) {
  if (!secretOptions.cursorLocator) return;
  ensureContentStyles();

  let cursorRect = null;

  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    const cs = window.getComputedStyle(el);
    const mirror = document.createElement('div');
    [
      'boxSizing', 'width',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
      'wordSpacing', 'tabSize', 'lineHeight',
    ].forEach((p) => { mirror.style[p] = cs[p]; });

    const elRect = el.getBoundingClientRect();
    Object.assign(mirror.style, {
      position: 'fixed',
      top: elRect.top + 'px',
      left: elRect.left + 'px',
      visibility: 'hidden',
      overflow: 'hidden',
      height: el.offsetHeight + 'px',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
    });

    const pos = el.selectionStart || 0;
    const cursorSpan = document.createElement('span');
    cursorSpan.textContent = '\u200B'; // zero-width space marks cursor position
    mirror.appendChild(document.createTextNode(el.value.substring(0, pos)));
    mirror.appendChild(cursorSpan);
    document.body.appendChild(mirror);
    mirror.scrollTop = el.scrollTop;
    cursorRect = cursorSpan.getBoundingClientRect();
    mirror.remove();
  } else if (el.isContentEditable) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0).cloneRange();
      range.collapse(true);
      cursorRect = range.getBoundingClientRect();
    }
  }

  if (!cursorRect || cursorRect.height === 0) return;

  const x = cursorRect.left;
  const y = cursorRect.top;

  const arrow = document.createElement('div');
  Object.assign(arrow.style, {
    position: 'fixed',
    left: (x - 10) + 'px',
    top: (y - 28) + 'px',
    fontSize: '20px',
    color: '#4A90D9',
    pointerEvents: 'none',
    zIndex: '2147483647',
    userSelect: 'none',
    animation: '__cb_cursor_beacon__ 2.5s ease-out forwards',
  });
  arrow.textContent = '▼';
  document.body.appendChild(arrow);

  const ring = document.createElement('div');
  Object.assign(ring.style, {
    position: 'fixed',
    left: (x - 10) + 'px',
    top: (y - 2) + 'px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '2px solid #4A90D9',
    pointerEvents: 'none',
    zIndex: '2147483647',
    animation: '__cb_cursor_ring__ 2.5s ease-out forwards',
  });
  document.body.appendChild(ring);

  setTimeout(() => { arrow.remove(); ring.remove(); }, 2500);
}

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

  showCorrectionFlair(element);
  highlightCorrectedWord(element, wordStart, correction.length);
  recordCorrection();
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

  showCorrectionFlair(element);
  highlightCorrectedWordCE(node, wordStart, correction.length);
  recordCorrection();
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
  if (skipCapForThisSentence) return;
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
  if (skipCapForThisSentence) return;
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
    // Reset skip flag when a sentence-ending character (or newline) is typed
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

// ---------------------------------------------------------------------------
// "Add as misspelled" dialog (triggered via context menu → background.js)
// ---------------------------------------------------------------------------

function showAddWordDialog(selectedWord) {
  // Remove any pre-existing dialog
  const existing = document.getElementById('__cb_add_word_host__');
  if (existing) existing.remove();

  // Strip leading/trailing punctuation from the selection so the field
  // starts with a clean word (mirrors the correction logic in the corrector).
  const cleaned = selectedWord.trim()
    .replace(LEADING_PUNCT_RE, '')
    .replace(TRAILING_PUNCT_RE, '');

  // ---- Overlay host (fixed, full-screen, semi-transparent backdrop) --------
  const host = document.createElement('div');
  host.id = '__cb_add_word_host__';
  Object.assign(host.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.45)',
    zIndex: '2147483647',
    // Isolate from any font the page may set on <html>
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  });

  // Attach a shadow DOM so page styles cannot affect the dialog and the
  // dialog styles cannot leak to the page.
  const shadow = host.attachShadow({ mode: 'open' });

  // ---- Styles inside shadow ------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
    *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
    .dialog {
      background: #fff;
      border-radius: 12px;
      padding: 20px 22px 18px;
      box-shadow: 0 6px 28px rgba(0,0,0,0.22);
      min-width: 300px;
      max-width: 90vw;
    }
    .cols {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .col-label {
      font-size: 13px;
      font-weight: 600;
      color: #444;
      text-align: center;
      margin-bottom: 6px;
    }
    .col-input {
      width: 100%;
      padding: 7px 14px;
      border: 1.5px solid #ccc;
      border-radius: 999px;
      font-size: 13px;
      color: #222;
      outline: none;
      text-align: center;
      background: #fff;
      font-family: inherit;
    }
    .col-input:focus { border-color: #4A90D9; }
    .btns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .btn {
      padding: 8px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-cancel { background: #e04040; color: #fff; }
    .btn-cancel:hover { background: #c83434; }
    .btn-ok { background: #38b560; color: #fff; }
    .btn-ok:hover { background: #2d9e52; }
    .error {
      font-size: 11px;
      color: #e04040;
      text-align: center;
      margin-top: 10px;
      min-height: 1em;
    }
  `;

  // ---- Dialog markup -------------------------------------------------------
  I18n._lang = currentLang;

  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  // Stop clicks inside the dialog from bubbling to the backdrop
  dialog.addEventListener('click', (e) => e.stopPropagation());

  // Column headers + inputs
  const cols = document.createElement('div');
  cols.className = 'cols';

  function makeCol(labelKey, inputValue, inputId) {
    const col = document.createElement('div');
    const label = document.createElement('div');
    label.className = 'col-label';
    label.textContent = I18n.t(labelKey);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'col-input';
    input.value = inputValue;
    input.id = inputId;
    col.appendChild(label);
    col.appendChild(input);
    return { col, input };
  }

  const { col: incorrectCol, input: incorrectInput } =
    makeCol('sandbox-th-incorrect', cleaned, 'cb-incorrect');
  const { col: correctCol, input: correctInput } =
    makeCol('sandbox-th-correct', '', 'cb-correct');
  cols.appendChild(incorrectCol);
  cols.appendChild(correctCol);

  // Buttons
  const btns = document.createElement('div');
  btns.className = 'btns';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-cancel';
  cancelBtn.textContent = I18n.t('ctx-dialog-cancel');
  const okBtn = document.createElement('button');
  okBtn.className = 'btn btn-ok';
  okBtn.textContent = I18n.t('ctx-dialog-ok');
  btns.appendChild(cancelBtn);
  btns.appendChild(okBtn);

  // Error message area
  const errorEl = document.createElement('p');
  errorEl.className = 'error';

  dialog.appendChild(cols);
  dialog.appendChild(btns);
  dialog.appendChild(errorEl);

  shadow.appendChild(style);
  shadow.appendChild(dialog);
  document.documentElement.appendChild(host);

  // Auto-focus the "Correct" input (incorrect is pre-filled)
  setTimeout(() => correctInput.focus(), 30);

  // ---- Close helpers -------------------------------------------------------
  function handleKeyDown(e) {
    if (e.key === 'Escape') closeDialog();
  }
  document.addEventListener('keydown', handleKeyDown);

  function closeDialog() {
    document.removeEventListener('keydown', handleKeyDown);
    host.remove();
  }

  // Close on backdrop click (host itself, outside dialog)
  host.addEventListener('click', closeDialog);

  cancelBtn.addEventListener('click', closeDialog);

  // ---- Save on OK ----------------------------------------------------------
  function handleOk() {
    const incorrect = incorrectInput.value.trim().toLowerCase();
    const correct = correctInput.value.trim();
    errorEl.textContent = '';

    if (!incorrect) {
      errorEl.textContent = I18n.t('err-empty-incorrect');
      incorrectInput.focus();
      return;
    }
    if (!correct) {
      errorEl.textContent = I18n.t('err-empty-correct');
      correctInput.focus();
      return;
    }
    if (incorrect === correct) {
      errorEl.textContent = I18n.t('err-same-words');
      return;
    }

    chrome.storage.local.get('wordMap', (data) => {
      const wm = data.wordMap || {};
      wm[incorrect] = correct;
      chrome.storage.local.set({ wordMap: wm }, closeDialog);
    });
  }

  okBtn.addEventListener('click', handleOk);
  correctInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleOk();
  });
}

// ---------------------------------------------------------------------------
// Message listener (background.js → content script)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'showAddWordDialog') {
    showAddWordDialog(msg.word || '');
  }
});