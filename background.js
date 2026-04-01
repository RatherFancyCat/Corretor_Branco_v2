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

// Language codes supported by dictionaryapi.dev
const DICT_API_LANGS = new Set(['en', 'hi', 'es', 'fr', 'de', 'it', 'ko', 'ar', 'tr', 'ru', 'ja']);

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
    const lang = DICT_API_LANGS.has(msg.lang) ? msg.lang : 'en';
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
