# Corretor Branco v2

A Chrome extension that corrects spelling mistakes **in real time** based on a fully customisable word list. Every text field, `<textarea>`, `contenteditable` element, and inline frame on every page is covered.

---

## Features

| Feature | Details |
|---|---|
| **Real-time correction** | Words are corrected the moment you finish typing them (after a space or punctuation) |
| **All text surfaces** | Works in `<input>`, `<textarea>`, `contenteditable` elements and iframes |
| **Custom word list** | Bring your own incorrect → correct pairs |
| **Import / Export CSV** | Bulk-load or back up your word list with a two-column CSV (`incorrect,correct`) |
| **Options page** | Add, delete, and search word pairs; clear all with one click |
| **Sandbox** | Dedicated test page with a live correction log and visible word list |
| **Enable / Disable toggle** | Turn the corrector on or off from the popup without losing your word list |

---

## Installation (unpacked / developer mode)

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the repository folder.
5. The Corretor Branco icon will appear in your toolbar.

---

## Usage

### Popup
Click the toolbar icon to:
- Toggle the corrector on/off.
- See how many word pairs are loaded.
- Open the **Options** page or the **Sandbox**.

### Options page
Open via the popup or `chrome://extensions → Corretor Branco → Extension options`.

- **Add a word pair** – type the misspelled word (stored lowercase) and its correction, then click **Add**.
- **Delete** – click the red **Delete** button next to any pair.
- **Search** – filter the list in real time.
- **Import CSV** – choose a UTF-8 CSV file with the header `incorrect,correct`.
- **Export CSV** – downloads `corretor_branco_words.csv`.
- **Clear All** – removes every word pair (with confirmation).

### Sandbox
Open via the popup. Type freely in the large text area; each correction is logged below with its timestamp.

---

## CSV format

```
incorrect,correct
teh,the
hte,the
recieve,receive
```

- First row is the header (`incorrect,correct`) – it is skipped on import.
- Keys are matched **case-insensitively**; the correction preserves the original word's casing pattern (ALL CAPS → ALL CAPS, Title Case → Title Case).
- Quoted values and embedded commas follow standard CSV rules.

---

## File structure

```
manifest.json       MV3 extension manifest
background.js       Service worker – initialises storage on install
content.js          Content script injected into every frame on every page
popup.html/js/css   Toolbar popup
options.html/js/css Word-list management page
sandbox.html/js/css Live-test page
icons/              Extension icons (16 × 16, 48 × 48, 128 × 128 PNG)
```
