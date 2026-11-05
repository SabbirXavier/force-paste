<div align="center">

# ⚡ ForcePaste: Smart Paste & Key Shield

**The Universal Browser Freedom & Productivity Suite for All Major Browsers**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4f46e5.svg?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Version](https://img.shields.io/badge/Version-1.8.0-10b981.svg?style=flat-square)](https://github.com/SabbirXavier/force-paste/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Universal Browser Support](https://img.shields.io/badge/Universal-Chrome%20%7C%20Firefox%20%7C%20Brave%20%7C%20Edge%20%7C%20Opera-purple.svg?style=flat-square)](https://github.com/SabbirXavier/force-paste)

*A 100% free, open-source browser extension featuring force-pasting with human typing simulation, tab visibility/focus spoofing across multiple windows (Always Active Tab), 4-layer universal text selection & copy unlocking, screen-share stealth selection (invisible highlights), instant popup performance, customizable key mappings, Ghost Mode for screen capture protection, and an instant multi-language dictionary and thesaurus.*

<br/>

[![Download for Chrome / Chromium](https://img.shields.io/badge/Chrome%20%2F%20Brave%20%2F%20Edge-Direct%20Download-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com/SabbirXavier/force-paste/releases/latest/download/forcepaste-v1.8.0.zip)
&nbsp;&nbsp;
[![Download for Firefox](https://img.shields.io/badge/Firefox-Direct%20Download-FF7139?style=for-the-badge&logo=firefox&logoColor=white)](https://github.com/SabbirXavier/force-paste/releases/latest/download/forcepaste-v1.8.0.zip)

<br/>

[All Features](#-all-in-one-features) • [Installation](#-browser-installation-guides) • [How to Use](#-how-to-use) • [Under the Hood](#-how-it-works-zero-server-trace) • [Privacy Guarantee](#-privacy--security)

</div>

---

## 🌟 All-in-One Features

Every feature comes with an **individual toggle switch** and dedicated controls in the extension popup:

### ⚡ 1. ForcePaste & Keystroke Dynamics Engine
* **Cadence-Preserving Keystroke Dynamics:** Generates natural human-like per-character intervals (randomized between **50ms and 500ms**) while mathematically preserving your exact target Words Per Minute (WPM). Accurately incorporates cognitive pauses after sentences, clause pauses at commas and semicolons, Shift/symbol reaches, and fast lowercase digraphs.
* **Speed Profiles:** Select between **Instant (0ms)**, **Fast (~150 WPM)**, **Human Average (~50 WPM with natural jitter)**, or **Custom WPM (10 to 600 WPM)** with live millisecond delay preview.
* **Compact Dual-Icon Dock:** An unobtrusive floating toolbar with two compact icon buttons (`[📋]` Quick Paste & `[📝]` Edit/Stage Text) positioned right above active fields.
* **Persistent Staged Memory:** Paste or stage text once into the popup dialog; clicking `[📋]` or triggering the hotkey types that text on subsequent clicks without reopening the modal until cleared.
* **Input Engine:** Emulates authentic `keydown`, `beforeinput`, and `input` events, ensuring compatibility with standard forms, textareas, and rich `contenteditable` editors across React, Vue, Angular, and vanilla web apps.

### 👁️ 2. Multi-Window & Tab-Specific Always Active Tab (Visibility Spoofing)
* **Tricks Webpages into Believing the Tab is Continuously Focused & Visible:**
  * Overrides `document.visibilityState = 'visible'`
  * Overrides `document.hidden = false`, `webkitHidden = false`, and `mozHidden = false`
  * Overrides `document.hasFocus = () => true`
  * Suppresses tracking events in the capture phase: `visibilitychange`, `blur`, and `mouseleave`.
* **Multi-Window Tab Discovery:** The expandable accordion drawer detects all open tabs across **all separated browser windows** in the current user profile.
* **Window Headers & Focus Indicators:** Automatically groups tabs under section headers (`🪟 Current Window`, `🪟 Window 2`, etc.) when multiple windows exist, featuring `This Tab` and `Active` badges.
* **One-Click Window Switcher:** Clicking any tab row in the drawer instantly brings that specific window and tab into foreground focus.
* **Batch Controls:** One-click **All On**, **All Off**, and **Refresh (🔄)** actions apply across all open tabs simultaneously.
* **Clean State Synchronization:** Safely updates and cleans up tab IDs upon tab close without accidentally removing active background tabs in other windows.

### 🔓 3. 4-Layer Universal Text Selection & Robust Iframe Unblocker
Bypasses all four modern web protection mechanisms across the top frame and all nested `<iframe>`s (crucial for proctored exam portals and quiz LMS):
* **Stealth Selection Mode (Invisible Highlights for Screen Sharing):**
  * **Invisible / Zero-Highlight Selection (`transparent`):** Select, drag, and copy text completely normally with keyboard or mouse, but **NO visible blue highlight box** appears on screen, Zoom, Microsoft Teams, OBS Studio, screenshots, or display capture.
  * **Subtle Ghost Tint (`10% opacity`):** Ultra-faint tint visible to human eyes close to a monitor, but filtered out by low-bitrate screen recording codecs.
  * **Standard Blue:** High-contrast solid blue highlight for everyday browsing.
* **Layer 1: CSS Protections Neutralized**
  * Injects universal `user-select: text !important` across all DOM nodes and pseudo-elements.
  * Overrides `-webkit-touch-callout: default !important` without breaking interactive buttons, checkboxes, or radio options.
* **Layer 2: JavaScript Event Interception Neutralized**
  * **Neutralizes `removeAllRanges()` & `empty()`**: Hooks `Selection.prototype` so website scripts cannot wipe highlighted text on mouseup or selectionchange.
  * **Hooks `Event.prototype.preventDefault()`**: Blocks page scripts from cancelling `selectstart`, `copy`, `cut`, and `mousedown`.
  * **Suppresses Anti-Copy Listeners**: Intercepts `selectstart`, `dragstart`, `copy`, and `selectionchange` in the capture phase.
  * **Cleans Inline Attributes**: Strips `unselectable="on"`, `onselectstart="return false"`, and `oncopy` via continuous `MutationObserver`.
* **Layer 3: Structural & DOM Layout Neutralized**
  * **Non-Destructive Overlay Puncturing**: Neutralizes transparent full-screen barrier elements without interfering with interactive form inputs or radio buttons.
  * **Zero-Width Character Sanitizer**: Automatically cleans invisible noise characters (`\u200B`, `\u200C`, `\u200D`, `\uFEFF`, soft hyphens, etc.) when copying text.
* **Layer 4: Canvas & SVG Typography Support**
  * **Canvas Document Text Layers**: Makes hidden `.textLayer` overlays (in PDF.js, Google Docs, Scribd, Kindle) 100% visible and selectable.
  * **SVG Typography**: Enables native text selection across SVG `<text>`, `<tspan>`, and `<textPath>` elements.
* **Alt + C (Zero-Highlight Hover Copy)**: Press **Alt + C** anywhere to force-copy clean text. If nothing is highlighted, it automatically extracts text from the hovered element under your cursor without creating any visual selection box at all.

### ⌨️ 4. Editable Keyboard Shortcuts & Key Mapping
* **Live In-Popup Key Recorder:** Remap shortcuts by clicking any action box and pressing your desired key combination.
* **Customizable Actions:**
  * **Quick Paste / Force-Type:** Types staged or clipboard text into the active field *(Default: `Alt + V`)*
  * **Stop Typing / Abort Paste:** Halts ongoing character typing immediately *(Default: `Escape`)*
  * **Clear Staged & Copied Text:** Resets clipboard buffer and staged text *(Default: `Alt + X`)*
  * **Force Copy / Clean Extract:** Copies clean text or extracts text from hovered elements *(Default: `Alt + C`)*
  * **Toggle Ghost Mode:** Toggles screen-capture protection *(Default: `Alt + H`)*
* **Reset Button:** One-click `↺ Reset to Defaults` button quickly restores standard factory shortcuts.

### 📖 5. Instant Multi-Language Dictionary & Thesaurus
* **Floating Define Badge:** Select any word on any webpage, and a small dark pin badge appears near your cursor. The dictionary modal strictly remains hidden until you explicitly click `Define`.
* **Sleek Dark Theme Card:** Designed with a modern `#181d24` card aesthetic, `#3b82f6` accents, and crisp typography.
* **3 Clean Language Tabs:**
  * **`[ EN Def ]`**: English definitions from Oxford Languages & Datamuse with part-of-speech labels (Noun, Verb, Adjective) and sentence examples.
  * **`[ Hindi ]`**: Full Hindi meanings, romanization, and categorized definitions.
  * **`[ Bengali ]`**: Native Bengali meanings, phonetic romanization, and word categories.
* **Audio Pronunciation:** Built-in 🔊 speaker button plays authentic phonetic pronunciation with Web Speech API fallback.
* **Interactive Synonyms:** Clickable chips for synonyms and alternatives that copy directly to your clipboard on click.

### 👻 6. Ghost Mode & Native Capture-Proof Floating Overlay
* **100% Invisible to Display Capture, Window Capture & Tab Capture:**
  * **In-Browser Tab/Screen Capture Interception:** Hooks `navigator.mediaDevices.getDisplayMedia(...)` to automatically hide all extension UI, badges, and popups before video frames are captured or recorded by web proctors or meeting apps. Automatically enforces Invisible Selection mode so no colored highlight boxes appear on screen.
  * **Native Capture-Proof Floating Overlay (`ghost_overlay.bat`):** Runs a transparent, floating desktop teleprompter & auto-typer that utilizes Windows OS API `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` (0x11). It stays floating on top of your physical screen for your eyes only, but is **100% omitted from OBS Studio, Zoom, Teams, Discord, display capture, window capture, and screenshot tools (Snipping Tool / PrintScreen)**.
  * **🔄 Live Clipboard Teleprompter Sync:** Automatically detects newly copied text (`Alt + C`) and displays it inside the hardware-excluded floating window in real time.
  * **Zero Dependencies:** `ghost_overlay.py` runs natively using Python's built-in standard library (`tkinter` + `ctypes`).

### ⚡ 7. Instant Performance (< 15ms Popup Load)
* **Lazy DOM Loading:** Tab lists across multiple windows are only rendered when the drawer is explicitly expanded, preventing tab DOM thrashing and ensuring the extension popup opens instantly.
* **All-Frame Synchronization:** "Unblock All Safely" broadcasts commands to top-level frames and nested iframes simultaneously and stores preferences permanently in local extension storage.

---

## 🌐 Browser Installation Guides

ForcePaste works natively across **Chrome, Firefox, Brave, Edge, Opera, Vivaldi, and Arc**.

### 📥 1. Download
* Download the universal package: [**`forcepaste-v1.8.0.zip`**](https://github.com/SabbirXavier/force-paste/releases/latest/download/forcepaste-v1.8.0.zip)
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
4. Select the extracted folder (the directory containing `manifest.json`).

---

### 🦊 For Mozilla Firefox

1. Open Firefox and navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
2. Click **Load Temporary Add-on...**
3. Select `manifest.json` from the extracted folder.

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
* No tracking telemetry sent to the server (`fetch('/report')`)
* Native DevTools, context menus, and copy/paste operate cleanly.

---

## 🔒 Privacy & Security

* **100% Offline & Private:** Zero external server connections for core features, zero analytics, zero data logging.
* **No Storage of Copied Data:** Clipboard and staged content are stored strictly in your local browser memory.
* **Open Source:** Distributed freely under the MIT License.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
