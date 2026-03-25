'use strict';

let wordMap = {};

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function loadWordMap(callback) {
  chrome.storage.local.get('wordMap', (data) => {
    wordMap = data.wordMap || {};
    if (callback) callback();
  });
}

function saveWordMap(callback) {
  chrome.storage.local.set({ wordMap }, callback);
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
      ? 'No matching word pairs found.'
      : 'No word pairs added yet. Add your first correction above!';
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
                data-word="${escapeHtml(incorrect)}">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  }
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
    errorEl.textContent = 'Please enter the misspelled word.';
    errorEl.hidden = false;
    incorrectEl.focus();
    return;
  }
  if (!correct) {
    errorEl.textContent = 'Please enter the correction.';
    errorEl.hidden = false;
    correctEl.focus();
    return;
  }
  if (incorrect === correct.toLowerCase()) {
    errorEl.textContent = 'The misspelled word and its correction cannot be the same.';
    errorEl.hidden = false;
    return;
  }

  wordMap[incorrect] = correct;
  saveWordMap(() => {
    incorrectEl.value = '';
    correctEl.value = '';
    incorrectEl.focus();
    renderWordList(document.getElementById('searchInput').value);
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
      if (incorrect === correct.toLowerCase()) { skipped++; continue; }
      wordMap[incorrect] = correct;
      imported++;
    }

    saveWordMap(() => {
      renderWordList(document.getElementById('searchInput').value);
      const msg = `Imported ${imported} word pair(s).` +
        (skipped > 0 ? ` Skipped ${skipped} invalid row(s).` : '');
      alert(msg);
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
    alert('No word pairs to export.');
    return;
  }

  const rows = [['incorrect', 'correct'], ...entries];
  const csv = rows.map((row) => row.map(escapeCSV).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'corretor_branco_words.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// ---------------------------------------------------------------------------
// Event: Clear all
// ---------------------------------------------------------------------------

document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (Object.keys(wordMap).length === 0) {
    alert('The word list is already empty.');
    return;
  }
  if (confirm('Delete ALL word pairs? This cannot be undone.')) {
    wordMap = {};
    saveWordMap(() => renderWordList());
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

loadWordMap(() => renderWordList());
