# Chrome Web Store & Edge Add-ons Listing Assets

This document contains all the copy, descriptions, permission justifications, and metadata for **ForcePaste**.

---

## 1. Store Metadata

* **Extension Name:** `ForcePaste: Smart Paste & Key Shield` *(35 / 45 characters)*
* **Short Description:** `Force paste into blocked fields with human typing simulation. Safely restores F12, right-click, and shortcuts locally.` *(119 / 132 characters)*
* **Category:** `Productivity` or `Accessibility`
* **Language:** `English`
* **Price:** `Free`

---

## 2. Detailed Description (Paste into Chrome Web Store Developer Console)

```markdown
Tired of websites blocking Ctrl+V, right-click menus, text selection, or developer shortcuts when filling forms? 

HumanTyper is a smart productivity assistant that types your clipboard text character-by-character into any field—simulating natural human keystrokes to bypass copy/paste restrictions without triggering page errors or anti-tamper scripts.

It also features a built-in Restriction Inspector that detects what the current page is blocking (F12, right-click, clipboard, text selection) and allows you to safely unblock them locally with zero server trace.

━━━━━━━━━━━━━━━━━━━━━━━━━━
⭐ KEY FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━

⌨️ SMART HUMAN AUTO-TYPER WITH MANUAL WPM
• Manually set your exact typing speed in Words Per Minute (WPM) using a live slider and number input (e.g. 40 WPM, 65 WPM, 120 WPM, up to 600 WPM).
• Simulates organic keystrokes (keydown, beforeinput, input, keyup) with realistic human timing variations (natural jitter and micro-pauses after spaces and punctuation).
• Three quick speed profiles available: Custom WPM, Human Average (~50 WPM), Fast (~150 WPM), or Instant (0ms).
• Works seamlessly with modern frontend frameworks (React, Vue, Angular), standard inputs, textareas, and rich contenteditable fields.

🛡️ RESTRICTION INSPECTOR & LOCAL SHIELD
• Live page scan: Automatically checks if the site is intercepting F12, Ctrl combinations, right-clicks, text highlighting, or drag-and-drop.
• Safe Capture-Phase Neutralization: Neutralizes event blockers before website scripts run. No cheat detection, error logs, or telemetry are ever sent to remote servers.
• Toggle each restriction individually or click "Unblock All Safely".

⚡ SPEED SHORTCUT: ALT + V
• Press Alt + V inside any active field to instantly trigger automated typing from your clipboard without ever touching the Ctrl key.

📋 ZERO-PROMPT CLIPBOARD INTEGRATION
• Powered by a dedicated background offscreen worker to read your clipboard text securely without repetitive browser permission popups.

🔒 100% PRIVATE & OFFLINE
• Zero data collection. No tracking, no analytics, no external servers, and no ads.
• All processing happens 100% locally on your computer.

━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 HOW TO USE
━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Copy any text to your clipboard as usual (Ctrl + C).
2. Click inside any input or text field on the target website.
3. Either:
   • Click the floating "Paste" badge near the field, OR
   • Press Alt + V on your keyboard.
4. Watch HumanTyper type your text smoothly into the field at your chosen WPM!

To customize your speed:
1. Click the HumanTyper icon in your browser toolbar.
2. Select "Custom Words Per Minute" and adjust the slider or type your target WPM.
```

---

## 3. Chrome Web Store Permission Justifications

When submitting your extension in the **Privacy** tab of the Chrome Developer Dashboard, Google requires an explicit explanation for every permission. Use the exact answers below:

### `clipboardRead`
> **Justification:**  
> "Required to read the text that the user has copied to their clipboard when they explicitly click the 'Paste' floating button or press the Alt+V keyboard shortcut, allowing the extension to simulate keystrokes into the active input field."

### `offscreen`
> **Justification:**  
> "Required in Manifest V3 to host an offscreen document for accessing the standard Clipboard API asynchronously, ensuring reliable clipboard reading when the user triggers the typing action without disrupting the active page."

### `storage`
> **Justification:**  
> "Required to save user preferences locally, including preferred typing speed (custom WPM), whether the floating badge is visible, natural typing jitter toggles, and local unblock preferences."

### `activeTab`
> **Justification:**  
> "Required to detect focused input elements, calculate coordinates for the unobtrusive floating paste badge, and type characters into the currently active tab when invoked by the user."

---

## 4. Single Purpose Description
> "An accessibility and productivity tool that allows users to paste text via simulated keystrokes into input fields that block standard clipboard shortcuts, while locally restoring standard browser event controls."
