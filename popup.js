'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const enabledToggle = document.getElementById('enabledToggle');
  const wordCountEl = document.getElementById('wordCount');
  const openOptionsBtn = document.getElementById('openOptions');
  const openSandboxBtn = document.getElementById('openSandbox');

  // Populate UI from storage
  chrome.storage.local.get(['enabled', 'wordMap'], (data) => {
    enabledToggle.checked = data.enabled !== false;
    wordCountEl.textContent = data.wordMap ? Object.keys(data.wordMap).length : 0;
  });

  // Toggle the extension on/off
  enabledToggle.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: enabledToggle.checked });
  });

  // Open the options/word-list page
  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Open the sandbox in a new tab
  openSandboxBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('sandbox.html') });
  });

  // Keep word count in sync while popup is open
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.wordMap) {
      wordCountEl.textContent = Object.keys(changes.wordMap.newValue || {}).length;
    }
  });
});
