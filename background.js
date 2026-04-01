// Context menu label per language
const MENU_LABELS = {
  pt: 'Adicionar como palavra com erro',
  en: 'Add as misspelled word',
  es: 'Añadir como palabra con error',
  fr: 'Ajouter comme mot incorrect',
  de: 'Als falsches Wort hinzufügen',
  zh: '添加为错误词汇',
};


const LOOKUP_LABELS = {
  pt: 'Procurar definição',
  en: 'Look up definition',
  es: 'Buscar definición',
  fr: 'Rechercher la définition',
  de: 'Definition nachschlagen',
  zh: '查找释义',
};

// Languages handled by dictionaryapi.dev (subset used by this extension).
// Keep in sync with the identical constant in options.js (separate execution context).
const DICT_API_LANGS = new Set(['en', 'es', 'fr', 'de']);

// Parse a dicionario-aberto.net response (array of { word, xml }) into the
// dictionaryapi.dev-like shape used by all rendering code: [{ phonetics, meanings }]
// An identical copy of this function lives in options.js (separate execution context).
function normalizeDicionarioAberto(apiData) {
  if (!Array.isArray(apiData) || !apiData[0]) return null;
  const xmlStr = apiData[0].xml || '';

  // Strip all XML tags then remove any stray angle brackets that remain
  // (e.g. from malformed/incomplete tags). Decode entities with &amp; last
  // to avoid double-decoding sequences like &amp;lt;.
  // NOTE: The decoded text is only ever assigned to DOM textContent (never
  // innerHTML), so any resulting '<' characters are display-safe.
  function xmlToText(s) {
    return s
      .replace(/<[^>]*>/g, '')    // strip complete tags
      .replace(/</g, '')          // remove any stray <
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')     // amp last: prevents double-decoding
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Part of speech: <pos>…</pos> or <gram type="pos">…</gram>
  const posMatch = xmlStr.match(/<pos[^>]*>([\s\S]*?)<\/pos>/) ||
                   xmlStr.match(/<gram[^>]*type="pos"[^>]*>([\s\S]*?)<\/gram>/);
  const pos = posMatch ? xmlToText(posMatch[1]) : '';

  // Definitions: all <def>…</def> blocks
  const defs = [];
  for (const m of xmlStr.matchAll(/<def[^>]*>([\s\S]*?)<\/def>/g)) {
    const text = xmlToText(m[1]);
    if (text) defs.push({ definition: text });
    if (defs.length === 4) break;
  }

  if (!defs.length) return null;
  return [{ phonetics: [], meanings: [{ partOfSpeech: pos, definitions: defs }] }];
}

function buildContextMenu(lang) {
  const addTitle    = MENU_LABELS[lang]   || MENU_LABELS.pt;
  const lookupTitle = LOOKUP_LABELS[lang] || LOOKUP_LABELS.en;
  // removeAll first so re-registration never creates duplicates
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'cb-add-misspelled',
      title: addTitle,
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'cb-lookup-word',
      title: lookupTitle,
      contexts: ['selection'],
    });
  });
}

// Initialize default storage values on first install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['wordMap', 'enabled', 'settings', 'language'], (data) => {
    const updates = {};
    if (!data.wordMap) updates.wordMap = {};
    if (data.enabled === undefined) updates.enabled = true;
    if (!data.settings) {
      updates.settings = { autoCapitalize: false, blacklistedDomains: [] };
    }
    if (!data.language) updates.language = 'pt';
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
    buildContextMenu(data.language || updates.language || 'pt');
  });
});

// Service workers can be terminated; rebuild the menu on each browser start
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get('language', (data) => {
    buildContextMenu(data.language || 'pt');
  });
});

// Keep context menu title in sync when the user switches language
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.language) {
    buildContextMenu(changes.language.newValue || 'pt');
  }
});

// Relay context menu clicks to the content script in the active tab
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.selectionText || !tab || !tab.id) return;
  if (info.menuItemId === 'cb-add-misspelled') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'showAddWordDialog',
      word: info.selectionText,
    });
  } else if (info.menuItemId === 'cb-lookup-word') {
    chrome.storage.local.get('language', (data) => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'showDefinitionLookup',
        word: info.selectionText,
        lang: data.language || 'pt',
      });
    });
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'openSandbox') {
    chrome.tabs.create({ url: chrome.runtime.getURL('sandbox.html') });
    return false;
  }
  if (msg.action === 'lookupWordApi') {
    const word = msg.word || '';
    const lang = msg.lang || 'pt';

    // Portuguese: dicionario-aberto.net returns { word, xml }[]
    if (lang === 'pt') {
      const url = `https://api.dicionario-aberto.net/word/${encodeURIComponent(word)}`;
      fetch(url)
        .then((res) => {
          if (!res.ok) return sendResponse({ ok: false, status: res.status });
          return res.json().then((data) => {
            const normalized = normalizeDicionarioAberto(data);
            sendResponse(normalized ? { ok: true, data: normalized } : { ok: false, status: 404 });
          });
        })
        .catch(() => sendResponse({ ok: false, status: 0 }));
      return true;
    }

    // Chinese and other languages without a supported API: skip, show fallback
    if (!DICT_API_LANGS.has(lang)) {
      sendResponse({ ok: false, status: 0 });
      return false;
    }

    // English, Spanish, French, German: dictionaryapi.dev
    const url = `https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(word)}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) return sendResponse({ ok: false, status: res.status });
        return res.json().then((data) => sendResponse({ ok: true, data }));
      })
      .catch(() => sendResponse({ ok: false, status: 0 }));
    return true; // keep message channel open for async response
  }
});
