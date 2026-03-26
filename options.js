'use strict';

let wordMap = {};
let settings = { autoCapitalize: false, blacklistedDomains: [] };

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function loadAll(callback) {
  chrome.storage.local.get(['wordMap', 'settings'], (data) => {
    wordMap = data.wordMap || {};
    settings = data.settings || { autoCapitalize: false, blacklistedDomains: [] };
    if (callback) callback();
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
      ? 'Nenhum par de palavras encontrado.'
      : 'Ainda não foram adicionados pares de palavras. Adicione a primeira correção acima!';
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
                data-word="${escapeHtml(incorrect)}">Eliminar</button>
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
    errorEl.textContent = 'Por favor, introduza a palavra com erro.';
    errorEl.hidden = false;
    incorrectEl.focus();
    return;
  }
  if (!correct) {
    errorEl.textContent = 'Por favor, introduza a correção.';
    errorEl.hidden = false;
    correctEl.focus();
    return;
  }
  if (incorrect === correct) {
    errorEl.textContent = 'A palavra com erro e a sua correção não podem ser iguais.';
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
// Event: Clear all
// ---------------------------------------------------------------------------

document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (Object.keys(wordMap).length === 0) {
    alert('A lista de palavras já está vazia.');
    return;
  }
  if (confirm('Eliminar TODOS os pares de palavras? Esta ação não pode ser desfeita.')) {
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
    btn.textContent = '✓ Guardado';
    setTimeout(() => { btn.textContent = 'Guardar'; }, 1500);
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
      const msg = `Importado(s) ${imported} par(es) de palavras.` +
        (skipped > 0 ? ` Ignorada(s) ${skipped} linha(s) inválida(s).` : '');
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
    alert('Não há pares de palavras para exportar.');
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
// Init
// ---------------------------------------------------------------------------

loadAll(() => {
  renderWordList();
  populateSettings();
});

