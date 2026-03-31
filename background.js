// Context menu label per language
const MENU_LABELS = {
  pt: 'Adicionar como palavra com erro',
  en: 'Add as misspelled word',
  es: 'Añadir como palabra con error',
  fr: 'Ajouter comme mot incorrect',
  de: 'Als falsches Wort hinzufügen',
  zh: '添加为错误词汇',
};

function buildContextMenu(lang) {
  const title = MENU_LABELS[lang] || MENU_LABELS.pt;
  // removeAll first so re-registration never creates duplicates
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'cb-add-misspelled',
      title,
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

// Relay context menu click to the content script in the active tab
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'cb-add-misspelled') return;
  if (!info.selectionText || !tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, {
    action: 'showAddWordDialog',
    word: info.selectionText,
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg.action === 'openSandbox') {
    chrome.tabs.create({ url: chrome.runtime.getURL('sandbox.html') });
  }
});
