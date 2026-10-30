<div align="center">

# ⚡ ForcePaste & Shield

**The Ultimate Anti-Block Paste Helper & Restriction Shield for Chromium Browsers**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4f46e5.svg?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Version](https://img.shields.io/badge/Version-1.3.0-10b981.svg?style=flat-square)](https://github.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Browsers](https://img.shields.io/badge/Compatible%20with-Chrome%20%7C%20Edge%20%7C%20Brave%20%7C%20Opera-orange?style=flat-square)](https://github.com)

*A 100% free, open-source browser extension that forces paste on any website by simulating natural human keystrokes, and safely neutralizes blocked right-clicks, F12, and shortcuts with zero server trace.*

[Quick Install](#-quick-install-free--no-store-fees) • [Features](#-features) • [How to Use](#-how-to-use) • [Under the Hood](#-how-it-works-zero-server-trace) • [Privacy Guarantee](#-privacy--security)

</div>

---

## 💥 What is ForcePaste?

Many test portals, exam platforms, banking sites, and educational services intentionally block users from pasting, inspecting elements, or using common shortcuts:
* ❌ Blocked <kbd>Ctrl</kbd> + <kbd>V</kbd> and cancelled `paste` events.
* ❌ Blocked Developer Tools (<kbd>F12</kbd>, <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd>).
* ❌ Disabled right-click context menus (`oncontextmenu = return false`).
* ❌ Disabled text selection and copying (`user-select: none`).

**ForcePaste bypasses all of them cleanly without triggering anti-cheat or server alerts:**
1. **Force-Paste via Simulated Keystrokes:** Rather than fighting `paste` events, it types your clipboard text character-by-character using genuine `keydown`, `beforeinput`, and `input` events at your chosen Words-Per-Minute (WPM) speed.
2. **Safe Local Neutralization:** Intercepts blocked keys and right-clicks in the browser's **Capture Phase**, rendering the website's blocking scripts completely blind and inert.

---

## ⭐ Features

### ⚡ 1. Force-Paste with Custom WPM Control
* **Manual Speed Selector:** Set your exact speed from **10 to 600 Words Per Minute** using the interactive slider or direct numeric input.
* **Proportional Human Jitter:** Applies a natural $\pm 25\%$ variation around your target WPM, complete with realistic micro-pauses after spaces and punctuation marks (`.`, `,`, `!`, `?`).
* **Universal Framework Support:** Works seamlessly with React, Vue, Angular, plain inputs, textareas, and rich `contenteditable` elements.

### 🛡️ 2. Restriction Inspector & Local Shield
* **Automatic Live Detection:** Automatically scans the active page and flags active blockers:
  * 🚫 <kbd>F12</kbd> & DevTools Key Combinations
  * 🚫 Right-Click Context Menu
  * 🚫 Copy / Cut / Paste Keystroke Blocks
  * 🚫 Text Highlighting & Selection (`user-select: none`)
  * 🚫 Drag & Drop Blockers
* **One-Click Unblock:** Neutralize each blocker individually or click **"Unblock All Safely"**.

### ⌨️ 3. The `Alt + V` Shortcut
* Press <kbd>Alt</kbd> + <kbd>V</kbd> inside any input or text field to instantly trigger typing.
* Bypasses the website's `isCtrl == true` trap because it never touches the <kbd>Ctrl</kbd> key!

### 📋 4. Privileged Offscreen Clipboard Reader
* Uses a dedicated Manifest V3 background offscreen document to fetch your clipboard text directly with **zero permission popups**.

---

## 🚀 Quick Install (Free — No Store Fees)

No Chrome Web Store account or payment needed. Install directly in your browser in under 30 seconds:

### Step 1: Download the Extension
* Download the ready-to-load package: [**`forcepaste-v1.3.0.zip`**](forcepaste-v1.3.0.zip)
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

---

## 🎯 How to Use

### Force-Pasting Text into Blocked Fields:
1. Copy any text (<kbd>Ctrl</kbd> + <kbd>C</kbd>).
2. Click inside any input or text field on the restricted webpage.
3. Either:
   * Click the floating **ForcePaste** badge near the input field, OR
   * Press <kbd>Alt</kbd> + <kbd>V</kbd> on your keyboard.
4. Watch ForcePaste type your text smoothly into the field at your configured WPM!

### Unblocking F12, Right-Click, and Shortcuts:
1. Click the **ForcePaste** icon in your browser toolbar.
2. Under the **🛡️ Page Restrictions** tab, review the detected blockers.
3. Click **"Unblock All Safely"** or toggle specific features.

---

## 🔬 How It Works (Zero Server Trace)

Most website anti-copy scripts listen on `document` in the **Bubble phase**:
```
User Event ──> [Capture Phase: window ──> document] ──> [Target] ──> [Bubble Phase: document.onkeydown]
                     ▲
                     │ ForcePaste intercepts HERE (e.stopImmediatePropagation())
                     │ The website's script NEVER receives the event!
```

Because ForcePaste catches the event in the **Capture phase** (`capture: true`), the website's blocking handler never receives the event at all:
* No console logs (`"Right click disabled"`)
* No cheating telemetry sent to the server (`fetch('/report')`)
* The browser natively opens DevTools or shows the context menu cleanly.

---

## 🔒 Privacy & Security

* **100% Offline:** Zero external server connections, zero APIs, zero third-party telemetry.
* **No Storage of Copied Data:** Clipboard content is read strictly in memory when you click Paste or press <kbd>Alt</kbd> + <kbd>V</kbd>, and is immediately discarded after typing.
* **No Account Required:** Free and open source under the MIT License.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
