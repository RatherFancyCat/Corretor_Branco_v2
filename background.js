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
  });
});
