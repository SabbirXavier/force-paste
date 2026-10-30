<div align="center">

# 🛡️ HumanTyper & Shield

**Smart Auto-Paste & Restriction Inspector for Chromium Browsers**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4f46e5.svg?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Version](https://img.shields.io/badge/Version-1.3.0-10b981.svg?style=flat-square)](https://github.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Browsers](https://img.shields.io/badge/Compatible%20with-Chrome%20%7C%20Edge%20%7C%20Brave%20%7C%20Opera-orange?style=flat-square)](https://github.com)

*A 100% free, open-source browser extension that types clipboard text like a natural human to bypass copy/paste blockers, and safely unblocks F12, right-click, and shortcuts with zero server trace.*

[Installation](#-installation-free--no-store-fee) • [Key Features](#-key-features) • [How to Use](#-how-to-use) • [Under the Hood](#-how-it-works-zero-server-trace) • [Privacy Guarantee](#-privacy--security)

</div>

---

## 💡 Why HumanTyper?

Many educational portals, examination platforms, and corporate forms use aggressive scripts to:
* Block <kbd>Ctrl</kbd> + <kbd>V</kbd> and paste events.
* Block developer tools (<kbd>F12</kbd>, <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd>).
* Disable right-click context menus (`oncontextmenu = return false`).
* Disable text selection and copying (`user-select: none`).

**HumanTyper solves this cleanly without fighting the website's code:**
1. **Types character-by-character** generating genuine `keydown`, `beforeinput`, and `input` events at your chosen Words-Per-Minute (WPM) speed.
2. **Neutralizes restrictions in the browser's Capture Phase** so the website's anti-cheat scripts are never even triggered.

---

## ⭐ Key Features

### ⌨️ 1. Smart Human Auto-Typer with Custom WPM
* **Manual WPM Control:** Set your exact typing speed from **10 to 600 Words Per Minute** with a live slider and number box.
* **Organic Timing & Jitter:** Applies natural $\pm 25\%$ variation around your target WPM, with human-like pauses after spaces and punctuation marks.
* **Framework Support:** Fully compatible with React, Vue, Angular, plain inputs, textareas, and rich `contenteditable` elements.

### 🛡️ 2. Restriction Inspector & Safe Local Shield
* **Automatic Detection:** Live scanner detects what the page is blocking:
  * 🚫 <kbd>F12</kbd> & DevTools Key Combinations
  * 🚫 Right-Click Context Menu
  * 🚫 Copy / Cut / Paste Keystrokes
  * 🚫 Text Highlighting & Selection (`user-select: none`)
  * 🚫 Drag & Drop Operations
* **Safe Local Unblocking:** Neutralize each blocker individually or click **"Unblock All Safely"**.

### ⚡ 3. The `Alt + V` Shortcut
* Press <kbd>Alt</kbd> + <kbd>V</kbd> inside any field to trigger human typing instantly.
* Bypasses the website's `isCtrl == true` keystroke blocker because it never touches the <kbd>Ctrl</kbd> key.

### 📋 4. Privileged Offscreen Clipboard Reader
* Uses a dedicated Manifest V3 background offscreen document to read your clipboard text directly with **zero permission prompts**.

---

## 🚀 Installation (Free — No Store Fee)

You do **not** need to pay $5 to the Chrome Web Store. You can install it directly in your browser in under 30 seconds:

### Step 1: Download the Extension
* Download the ready-to-use package: [**`humantyper-v1.3.0-store-ready.zip`**](humantyper-v1.3.0-store-ready.zip)
* Extract (unzip) the file into a folder on your computer.

### Step 2: Load into Your Browser
1. Open the Extensions management page:
   * **Google Chrome:** `chrome://extensions`
   * **Microsoft Edge:** `edge://extensions`
   * **Brave Browser:** `brave://extensions`
   * **Opera:** `opera://extensions`
2. Turn ON **Developer mode** (toggle in the top-right corner).
3. Click the **Load unpacked** button (top-left).
4. Select the unzipped folder containing `manifest.json`.

That's it! The **HumanTyper & Shield** icon will appear in your browser toolbar.

---

## 🎯 How to Use

### Typing Text into Restricted Fields:
1. Copy any text (<kbd>Ctrl</kbd> + <kbd>C</kbd>).
2. Click inside any input or text field on the website.
3. Either:
   * Click the floating **Paste** badge near the input field, OR
   * Press <kbd>Alt</kbd> + <kbd>V</kbd> on your keyboard.
4. Watch HumanTyper type your text smoothly at your chosen WPM!

### Unblocking Restricted Shortcuts & Right-Click:
1. Click the **HumanTyper** icon in your browser toolbar.
2. Under the **🛡️ Page Restrictions** tab, review any red indicators showing what the site blocked.
3. Click **"Unblock All Safely"** or toggle specific features.

---

## 🔬 How It Works (Zero Server Trace)

Most website anti-copy scripts listen at the `document` level in the **Bubble phase**:
```
User Event ──> [Capture Phase: window ──> document] ──> [Target] ──> [Bubble Phase: document.onkeydown]
                     ▲
                     │ HumanTyper intercepts HERE (e.stopImmediatePropagation())
                     │ The website's script NEVER receives the event!
```

Because HumanTyper catches the event in the **Capture phase** (`capture: true`), the website's blocking handler never receives the event at all:
* No console logs (`"Right click disabled"`)
* No cheating telemetry sent to the server (`fetch('/report')`)
* The browser natively opens DevTools or shows the context menu cleanly.

---

## 🔒 Privacy & Security

* **100% Offline:** Zero external server connections, zero APIs, zero third-party telemetry.
* **No Storage of Copied Data:** Clipboard content is read strictly in memory when you click Paste or press <kbd>Alt</kbd> + <kbd>V</kbd>, and is immediately discarded after typing.
* **No Account Required:** Free and open source under the MIT License.

---

## 🤝 Contributing

Contributions, bug reports, and feature suggestions are welcome!
1. Fork this repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
