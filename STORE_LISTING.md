# Chrome Web Store & Edge Add-ons Listing Assets

This document contains all the store copy, descriptions, permission justifications, and metadata for **ForcePaste**.

---

## 1. Store Metadata

* **Extension Name:** `ForcePaste: Smart Paste & Key Shield` *(35 / 45 characters)*
* **Short Description:** `Force paste into blocked fields with human typing simulation, tab visibility spoofing, copy unblocking, and dictionary.` *(124 / 132 characters)*
* **Category:** `Productivity` or `Accessibility`
* **Language:** `English`
* **Price:** `Free`

---

## 2. Detailed Description (Paste into Developer Console)

```markdown
Tired of websites blocking Ctrl+V, right-click context menus, text selection, or developer shortcuts when filling forms? 

ForcePaste is a high-performance productivity tool that pastes text via organic character-by-character keystrokes into any field—simulating natural human cadence to bypass paste restrictions without triggering page errors or anti-tamper scripts.

It also features a tab-specific Always Active visibility spoofer across all open windows, a 4-layer universal text selection and copy shield, customizable keyboard shortcuts, and an instant multi-language dictionary and thesaurus.

━━━━━━━━━━━━━━━━━━━━━━━━━━
⭐ KEY FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━

⌨️ SMART HUMAN AUTO-TYPER WITH CADENCE-PRESERVING ENGINE
• Set your exact typing speed in Words Per Minute (WPM) using a slider or numeric input (10 to 600 WPM).
• Advanced Keystroke Dynamics Engine: dynamically randomizes character intervals between 50ms and 500ms (accounting for sentence boundaries, punctuation pauses, shift/number reaches, and fast digraphs) while strictly maintaining your set target WPM.
• Four speed modes: Instant (0ms), Fast (~150 WPM), Human Average (~50 WPM with natural jitter), and Custom WPM.
• Persistent Text Staging: Paste or edit text once into the staging drawer or floating dock to stream it whenever invoked.
• Works with standard inputs, textareas, and rich contenteditable editors across React, Vue, Angular, and vanilla web apps.

👁️ ALWAYS ACTIVE TAB (VISIBILITY & FOCUS SPOOFER)
• Tricks web pages into believing background tabs are continuously focused and visible.
• Multi-Window Discovery: Discovers and manages open tabs across all separated browser windows in your current profile.
• One-Click Window Switcher: Click any tab in the drawer to bring its window and tab into active focus.
• Individual tab switches with batch actions (All On, All Off, Refresh).
• Overrides document.visibilityState, document.hidden, and document.hasFocus, suppressing blur and visibilitychange events.

🔓 4-LAYER UNIVERSAL TEXT SELECTION & ROBUST IFRAME UNBLOCKER
• Stealth Selection Mode: 3 customizable highlight styles—Invisible / Zero-Highlight (100% invisible on screen shares, Zoom, Teams, and recordings while remaining copyable), Subtle Ghost Tint (ultra-faint 10% opacity), or Standard High-Contrast Blue.
• Alt + C Zero-Highlight Hover Copy: Instantly extract and copy text from any hovered question or element without creating any visual selection box.
• All-Frame Unblocking: Propagates unblock state to nested iframes (critical for exam systems and quiz LMS).
• Layer 1 (CSS Neutralizer): Injects universal user-select overrides without breaking interactive buttons, checkboxes, or radio options.
• Layer 2 (Event Shield): Neutralizes removeAllRanges(), empty(), and preventDefault() event blockers on selectstart, copy, cut, and mousedown.
• Layer 3 (DOM Sanitation): Automatically punctures invisible transparent overlay blockers and sanitizes zero-width junk characters.
• Layer 4 (Document Support): Unlocks hidden text layers in web document readers (PDF.js, Google Docs, Scribd) and SVG typography.

⌨️ FULLY EDITABLE KEYBOARD SHORTCUTS
• Remap any shortcut directly in the extension popup with live key recording:
  - Quick Paste / Force-Type (Default: Alt + V)
  - Stop Typing / Abort Paste (Default: Escape)
  - Clear Staged & Copied Text (Default: Alt + X)
  - Force Copy / Clean Extract (Default: Alt + C)
  - Toggle Ghost Mode (Default: Alt + H)
• Includes a one-click Reset to Defaults option.

📖 INSTANT MULTI-LANGUAGE DICTIONARY & THESAURUS
• Floating Define badge appears near highlighted text; opens on demand with zero accidental popups.
• Sleek dark theme interface with 3 clean tabs: English Definitions (Oxford + Datamuse), Hindi Translations, and Bengali Translations.
• Phonetic transcriptions and one-click audio speaker pronunciation with Web Speech fallback.
• Interactive synonym and alternative chips that copy to clipboard on click.

👻 GHOST MODE & SCREEN CAPTURE PROTECTION
• Web Proctoring Interception: Hooks navigator.mediaDevices.getDisplayMedia to hide all extension badges and UI elements before video frames are captured during tab or screen sharing.
• Optional Windows OS-level Desktop Overlay (ghost_overlay.bat) utilizing SetWindowDisplayAffinity for 100% invisible display, window, and tab capture protection, featuring real-time Live Clipboard Teleprompter sync.

🔒 100% PRIVATE & OFFLINE
• Zero telemetry, zero analytics, zero external servers, and zero ads.
• All processing occurs entirely locally within your browser.

━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 HOW TO USE
━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Copy text to your clipboard or stage it inside the extension popup.
2. Click inside any target input field.
3. Either click the compact floating dock icon or press Alt + V.
4. Watch ForcePaste type your text into the field at your desired speed!
```

---

## 3. Chrome Web Store Permission Justifications

When submitting your extension in the **Privacy** tab of the Chrome Developer Dashboard, Google requires an explicit explanation for every permission. Use the exact answers below:

### `clipboardRead`
> **Justification:**  
> "Required to read the text that the user has copied to their clipboard when they explicitly click the 'Paste' floating button or trigger the configured keyboard shortcut, allowing the extension to simulate keystrokes into the active input field."

### `offscreen`
> **Justification:**  
> "Required in Manifest V3 to host an offscreen document for accessing the Clipboard API asynchronously, ensuring reliable clipboard reading when the user triggers the typing action without disrupting the active page."

### `storage`
> **Justification:**  
> "Required to save user preferences locally, including preferred typing speed (custom WPM), custom keyboard shortcut mappings, tab-specific Always Active selections, floating dock display preferences, and unblock settings."

### `activeTab`
> **Justification:**  
> "Required to detect focused input elements, calculate coordinates for the unobtrusive floating dock, and type characters into the currently active tab when invoked by the user."

### `tabs`
> **Justification:**  
> "Required to query open tabs across browser windows so the user can manage and toggle the Always Active visibility spoofer for specific tabs, and to update active window/tab focus when a tab is selected from the drawer."

### `contextMenus`
> **Justification:**  
> "Required to add right-click context menu options for quick dictionary lookup ('ForcePaste: Define & Synonyms') and instant text extraction from protected webpage elements ('Force Copy Element Text')."

---

## 4. Single Purpose Description
> "An accessibility and productivity tool that allows users to paste text via simulated keystrokes into input fields that block standard clipboard shortcuts, while locally restoring standard browser event controls, text selection, and tab focus."
