'use strict';

let wordMap = {};
let settings = { autoCapitalize: false, blacklistedDomains: [] };
let cbStats = { wordsAdded: 0, correctionsApplied: 0 };
let cbAchievements = {};

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function loadAll(callback) {
  chrome.storage.local.get(['wordMap', 'settings', 'language', 'cbStats', 'cbAchievements'], (data) => {
    wordMap = data.wordMap || {};
    settings = data.settings || { autoCapitalize: false, blacklistedDomains: [] };
    cbStats = data.cbStats || { wordsAdded: 0, correctionsApplied: 0 };
    cbAchievements = data.cbAchievements || {};
    const lang = data.language || 'pt';
    I18n._lang = lang;
    if (callback) callback(lang);
  });
}

function saveWordMap(callback) {
  chrome.storage.local.set({ wordMap }, callback);
}

function saveSettings(callback) {
  chrome.storage.local.set({ settings }, callback);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderWordList(filter) {
  const tbody = document.getElementById('wordTableBody');
  const emptyMsg = document.getElementById('emptyMessage');
  const wordCountEl = document.getElementById('wordCount');

  const q = (filter || '').toLowerCase().trim();
  const entries = Object.entries(wordMap);

  wordCountEl.textContent = entries.length;

  const visible = q
    ? entries.filter(([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q))
    : entries;

  tbody.innerHTML = '';

  if (visible.length === 0) {
    emptyMsg.hidden = false;
    emptyMsg.textContent = q
      ? I18n.t('err-no-words-found')
      : I18n.t('opts-empty-msg');
    return;
  }

  emptyMsg.hidden = true;

  visible.sort((a, b) => a[0].localeCompare(b[0]));

  for (const [incorrect, correct] of visible) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="word-incorrect">${escapeHtml(incorrect)}</td>
      <td class="word-correct">${escapeHtml(correct)}</td>
      <td class="col-action">
        <button class="btn btn-sm btn-danger delete-btn"
                data-word="${escapeHtml(incorrect)}">${I18n.t('btn-delete')}</button>
      </td>`;
    tbody.appendChild(tr);
  }
}

function populateSettings() {
  document.getElementById('autoCapitalizeChk').checked = settings.autoCapitalize;
  document.getElementById('blacklistDomains').value =
    (settings.blacklistedDomains || []).join('\n');
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function parseCSV(text) {
  const rows = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let inQuote = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === ',' && !inQuote) {
        row.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

function escapeCSV(value) {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ---------------------------------------------------------------------------
// Stats tracking (for achievements)
// ---------------------------------------------------------------------------

function recordWordsAdded(count) {
  if (!count || count <= 0) return;
  chrome.storage.local.get('cbStats', (data) => {
    const stats = data.cbStats || { wordsAdded: 0, correctionsApplied: 0 };
    stats.wordsAdded = (stats.wordsAdded || 0) + count;
    chrome.storage.local.set({ cbStats: stats });
  });
}

// ---------------------------------------------------------------------------
// Event: Add word pair
// ---------------------------------------------------------------------------

document.getElementById('addWordForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const incorrectEl = document.getElementById('incorrectWord');
  const correctEl = document.getElementById('correctWord');
  const errorEl = document.getElementById('addError');

  const incorrect = incorrectEl.value.trim().toLowerCase();
  const correct = correctEl.value.trim();

  errorEl.hidden = true;

  if (!incorrect) {
    errorEl.textContent = I18n.t('err-empty-incorrect');
    errorEl.hidden = false;
    incorrectEl.focus();
    return;
  }
  if (!correct) {
    errorEl.textContent = I18n.t('err-empty-correct');
    errorEl.hidden = false;
    correctEl.focus();
    return;
  }
  if (incorrect === correct) {
    errorEl.textContent = I18n.t('err-same-words');
    errorEl.hidden = false;
    return;
  }

  wordMap[incorrect] = correct;
  saveWordMap(() => {
    incorrectEl.value = '';
    correctEl.value = '';
    incorrectEl.focus();
    renderWordList(document.getElementById('searchInput').value);
    recordWordsAdded(1);
  });
});

// ---------------------------------------------------------------------------
// Event: Delete (delegated)
// ---------------------------------------------------------------------------

document.getElementById('wordTableBody').addEventListener('click', (e) => {
  if (!e.target.classList.contains('delete-btn')) return;
  const word = e.target.dataset.word;
  if (Object.prototype.hasOwnProperty.call(wordMap, word)) {
    delete wordMap[word];
    saveWordMap(() => renderWordList(document.getElementById('searchInput').value));
  }
});

// ---------------------------------------------------------------------------
// Event: Search
// ---------------------------------------------------------------------------

document.getElementById('searchInput').addEventListener('input', (e) => {
  renderWordList(e.target.value);
});

// ---------------------------------------------------------------------------
// Event: Clear all
// ---------------------------------------------------------------------------

document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (Object.keys(wordMap).length === 0) {
    alert(I18n.t('err-list-empty'));
    return;
  }
  if (confirm(I18n.t('confirm-clear-all'))) {
    wordMap = {};
    saveWordMap(() => renderWordList());
  }
});

// ---------------------------------------------------------------------------
// Event: Settings – auto-capitalise
// ---------------------------------------------------------------------------

document.getElementById('autoCapitalizeChk').addEventListener('change', (e) => {
  settings.autoCapitalize = e.target.checked;
  saveSettings();
});

// ---------------------------------------------------------------------------
// Event: Settings – blacklist save
// ---------------------------------------------------------------------------

document.getElementById('saveBlacklistBtn').addEventListener('click', () => {
  const raw = document.getElementById('blacklistDomains').value;
  settings.blacklistedDomains = raw
    .split('\n')
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0);

  const btn = document.getElementById('saveBlacklistBtn');
  saveSettings(() => {
    btn.textContent = I18n.t('opts-btn-saved');
    setTimeout(() => { btn.textContent = I18n.t('opts-btn-save'); }, 1500);
  });
});

// ---------------------------------------------------------------------------
// Event: Language selector
// ---------------------------------------------------------------------------

document.getElementById('languageSelect').addEventListener('change', (e) => {
  const lang = e.target.value;
  chrome.storage.local.set({ language: lang }, () => {
    I18n.apply(lang);
    renderWordList(document.getElementById('searchInput').value);
  });
});

// ---------------------------------------------------------------------------
// Event: Import CSV
// ---------------------------------------------------------------------------

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    const rows = parseCSV(evt.target.result);
    let imported = 0;
    let skipped = 0;

    // Skip header row if it reads "incorrect"
    const start =
      rows[0] && rows[0][0] && rows[0][0].toLowerCase() === 'incorrect' ? 1 : 0;

    for (let i = start; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 2) { skipped++; continue; }
      const incorrect = row[0].toLowerCase();
      const correct = row[1];
      if (!incorrect || !correct) { skipped++; continue; }
      if (incorrect === correct) { skipped++; continue; }
      wordMap[incorrect] = correct;
      imported++;
    }

    saveWordMap(() => {
      renderWordList(document.getElementById('searchInput').value);
      let msg = I18n.t('msg-imported', { count: imported });
      if (skipped > 0) msg += ' ' + I18n.t('msg-skipped', { count: skipped });
      alert(msg);
      recordWordsAdded(imported);
    });
  };
  reader.readAsText(file);
  e.target.value = ''; // allow re-importing the same file
});

// ---------------------------------------------------------------------------
// Event: Export CSV
// ---------------------------------------------------------------------------

document.getElementById('exportBtn').addEventListener('click', () => {
  const entries = Object.entries(wordMap);
  if (entries.length === 0) {
    alert(I18n.t('err-nothing-to-export'));
    return;
  }

  const rows = [['incorrect', 'correct'], ...entries];
  const csv = rows.map((row) => row.map(escapeCSV).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'corretor_branco_palavras.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

function renderAchievements() {
  const list = document.getElementById('achievementsList');
  const unlockedCount = ACHIEVEMENT_DEFINITIONS.filter((d) => cbAchievements[d.id]).length;

  let html =
    `<div class="ach-summary">${I18n.t('ach-summary', { unlocked: unlockedCount, total: ACHIEVEMENT_DEFINITIONS.length })}</div>`;

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    const unlockedAt = cbAchievements[def.id];
    const dateStr = unlockedAt ? new Date(unlockedAt).toLocaleString(I18n.locale()) : null;
    const rewardText = def.reward
      ? escapeHtml(I18n.t('ach-reward-' + def.reward))
      : I18n.t('ach-reward-none');

    html +=
      `<div class="ach-item ${unlockedAt ? 'ach-unlocked' : 'ach-locked'}">` +
        `<div class="ach-icon">${unlockedAt ? '🏆' : '🔒'}</div>` +
        `<div class="ach-info">` +
          `<strong class="ach-name">${escapeHtml(I18n.t('ach-' + def.id + '-name'))}</strong>` +
          `<span class="ach-desc">${escapeHtml(I18n.t('ach-' + def.id + '-desc'))}</span>` +
          `<span class="ach-reward">${I18n.t('ach-reward-label')} ${rewardText}</span>` +
          (dateStr ? `<span class="ach-date">${I18n.t('ach-unlocked-on')} ${escapeHtml(dateStr)}</span>` : '') +
        `</div>` +
      `</div>`;
  }

  list.innerHTML = html;

  // Show the "View My Rewards" button only when at least one reward-bearing achievement is unlocked
  const anyRewardUnlocked = ACHIEVEMENT_DEFINITIONS.some((d) => d.reward && cbAchievements[d.id]);
  document.getElementById('viewRewardsBtn').hidden = !anyRewardUnlocked;
}

function openAchievementsModal() {
  renderAchievements();
  document.getElementById('achievementsModal').hidden = false;
}

function closeAchievementsModal() {
  document.getElementById('achievementsModal').hidden = true;
}

function resetAchievements() {
  if (!confirm(I18n.t('confirm-reset-achievements'))) return;
  cbAchievements = {};
  cbStats = { wordsAdded: 0, correctionsApplied: 0 };
  chrome.storage.local.set({ cbAchievements: {}, cbStats: { wordsAdded: 0, correctionsApplied: 0 } }, () => {
    renderAchievements();
  });
}

document.getElementById('viewAchievementsBtn').addEventListener('click', openAchievementsModal);
document.getElementById('viewRewardsBtn').addEventListener('click', () => {
  window.open(chrome.runtime.getURL('sandbox.html'), '_blank');
});
document.getElementById('closeAchievementsBtn').addEventListener('click', closeAchievementsModal);
document.getElementById('resetAchievementsBtn').addEventListener('click', resetAchievements);
document.getElementById('achievementsModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeAchievementsModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAchievementsModal();
});

// ---------------------------------------------------------------------------
// Sync language changes made from another page (e.g. popup)
// ---------------------------------------------------------------------------

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.language) {
    const lang = changes.language.newValue || 'pt';
    I18n.apply(lang);
    document.getElementById('languageSelect').value = lang;
    renderWordList(document.getElementById('searchInput').value);
    const modal = document.getElementById('achievementsModal');
    if (modal && !modal.hidden) renderAchievements();
  }
  if (changes.cbAchievements) {
    cbAchievements = changes.cbAchievements.newValue || {};
    const modal = document.getElementById('achievementsModal');
    if (modal && !modal.hidden) renderAchievements();
  }
  if (changes.cbStats) {
    cbStats = changes.cbStats.newValue || { wordsAdded: 0, correctionsApplied: 0 };
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

loadAll((lang) => {
  I18n.apply(lang);
  document.getElementById('languageSelect').value = lang;
  renderWordList();
  populateSettings();
});
