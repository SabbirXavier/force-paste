<div align="center">

# ⚡ ForcePaste & Shield (All-in-One Power Tool)

**The Universal Browser Freedom & Productivity Suite for All Major Browsers**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4f46e5.svg?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Version](https://img.shields.io/badge/Version-1.4.0-10b981.svg?style=flat-square)](https://github.com/SabbirXavier/force-paste/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Universal Browser Support](https://img.shields.io/badge/Universal-Chrome%20%7C%20Firefox%20%7C%20Brave%20%7C%20Edge%20%7C%20Opera-purple.svg?style=flat-square)](https://github.com/SabbirXavier/force-paste)

*A 100% free, open-source browser extension featuring force-pasting with human typing simulation, tab visibility/focus spoofing (Always Active), text selection & copy unlocking, text staging, and an instant vocabulary/thesaurus helper.*

<br/>

[![Download for Chrome / Chromium](https://img.shields.io/badge/Chrome%20%2F%20Brave%20%2F%20Edge-Direct%20Download-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com/SabbirXavier/force-paste/releases/latest/download/forcepaste-v1.4.0.zip)
&nbsp;&nbsp;
[![Download for Firefox](https://img.shields.io/badge/Firefox-Direct%20Download-FF7139?style=for-the-badge&logo=firefox&logoColor=white)](https://github.com/SabbirXavier/force-paste/releases/latest/download/forcepaste-v1.4.0.zip)

<br/>

[All Features](#-all-in-one-features) • [Installation](#-browser-installation-guides) • [How to Use](#-how-to-use) • [Under the Hood](#-how-it-works-zero-server-trace) • [Privacy Guarantee](#-privacy--security)

</div>

---

## 🌟 All-in-One Features

Every feature comes with an **individual toggle switch** in the extension popup:

### ⚡ 1. ForcePaste & Human Typing Engine
* **Force Paste via Keystrokes:** Simulates organic `keydown`, `beforeinput`, and `input` events to bypass website copy/paste blockers.
* **Manual WPM Speed Control:** Set exact typing speed from **10 to 600 Words Per Minute** with live millisecond delay display.
* **Proportional Human Jitter:** Natural $\pm 25\%$ variation around your target speed with micro-pauses after spaces and punctuation marks.
* **Alt + V Keyboard Shortcut:** Instantly triggers auto-typing into whichever input field is currently focused.

### 📝 2. Prepared Text Staging & Arranger
* **Long Text Workspace:** A dedicated scratchpad inside the extension popup where you can paste, edit, and organize long text before inserting it.
* **Word & Character Counters:** Real-time counters showing word and character metrics.
* **One-Click Insert:** Click **"⚡ Type into Field"** to stream your staged text directly into the focused field on the page.

### 👁️ 3. Always Active Window (Visibility & Focus Spoofing)
* **Tricks Webpages into Thinking the Tab is Never Hidden:**
  * Overrides `document.visibilityState = 'visible'`
  * Overrides `document.hidden = false`
  * Overrides `document.webkitHidden = false` & `document.mozHidden = false`
  * Overrides `document.hasFocus = () => true`
* **Suppresses Tracking Events in Capture Phase:**
  * `visibilitychange`, `webkitvisibilitychange`, `mozvisibilitychange`
  * `blur` (window and document blur)
  * `mouseleave` (simulating mouse pointer staying inside window)
* **Common Uses:** Keeps video players, audio streams, web timers, and background resource loading running continuously even when switching tabs or minimizing.

### 🔓 4. Force Enable Text Select & Copy
* **Unlocks Stubborn Text:** Forces text selection on websites that disable highlighting or context-menu copying.
* **CSS & Event Unblocker:** Overrides `user-select: none`, nullifies `onselectstart`, and suppresses `selectstart` and `copy` cancellations.

### 📖 5. Instant Vocabulary & Thesaurus Helper
* **Floating Define Badge:** Select any word on any webpage, and a small dark pin badge appears near your cursor.
* **Quick Reference Definitions:** Clear meanings with part-of-speech labels (Noun, Verb, Adjective) and real sentence examples.
* **Comprehensive Synonyms & Antonyms:** Click any synonym to instantly copy it to your clipboard (or replace the selected word if inside an input field).
* **Audio Pronunciation:** Built-in 🔊 speaker button plays accurate phonetic pronunciation.
* **Toolbar Search Box:** Look up any word directly from the extension popup without leaving your tab.
* **Right-Click Integration:** Highlight a word, right-click, and select *"ForcePaste: Define & Synonyms for '%s'"*.

---

## 🌐 Browser Installation Guides

ForcePaste works natively across **Chrome, Firefox, Brave, Edge, Opera, Vivaldi, and Arc**.

### 📥 1. Download
* Download the universal package: [**`forcepaste-v1.4.0.zip`**](https://github.com/SabbirXavier/force-paste/releases/latest/download/forcepaste-v1.4.0.zip)
* Extract (unzip) the file into a folder on your computer.

---

### 🌐 For Chrome, Brave, Edge, Opera, Vivaldi, Arc

1. Open your browser's extension manager:
   * **Google Chrome:** `chrome://extensions`
   * **Brave Browser:** `brave://extensions`
   * **Microsoft Edge:** `edge://extensions`
   * **Opera:** `opera://extensions`
2. Turn ON **Developer mode** (toggle in the top-right corner).
3. Click the **Load unpacked** button (top-left).
4. Select the extracted `forcepaste` folder (the folder containing `manifest.json`).

---

### 🦊 For Mozilla Firefox

1. Open Firefox and navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
2. Click **Load Temporary Add-on...**
3. Select `manifest.json` from the extracted folder or the downloaded `forcepaste-v1.4.0.zip` file directly.

---

## 🔬 How It Works (Zero Server Trace)

Most website anti-copy scripts listen on `document` in the **Bubble phase**:
```
User Event ──> [Capture Phase: window ──> document] ──> [Target] ──> [Bubble Phase: document.onkeydown]
                     ▲
                     │ ForcePaste intercepts HERE (e.stopImmediatePropagation())
                     │ The website's script NEVER receives the event!
```

Because ForcePaste catches events in the **Capture phase** (`capture: true`), the website's blocking handler never receives the event at all:
* No console logs (`"Right click disabled"`)
* No cheating telemetry sent to the server (`fetch('/report')`)
* Native DevTools, context menus, and copy/paste operate cleanly.

---

## 🔒 Privacy & Security

* **100% Offline & Private:** Zero external server connections for core features, zero analytics, zero data logging.
* **No Storage of Copied Data:** Clipboard and staged content are stored strictly in your local browser memory.
* **Open Source:** Distributed freely under the MIT License.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
