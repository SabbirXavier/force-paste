// ForcePaste & Shield Content Script
// Handles Compact Dual-Icon Bar, Staged Text Memory, Ghost Mode (Hidden from Screen Capture),
// Vocabulary/Thesaurus Helper, and Unblocking Controllers.

(() => {
  if (window.__FORCEPASTE_CONTENT_INITIALIZED__) return;
  window.__FORCEPASTE_CONTENT_INITIALIZED__ = true;

  // Settings cache
  let settings = {
    enabled: true,
    speedMode: "custom", // custom, human, fast, instant
    baseDelay: 25,
    customWPM: 60,
    showFloatingIcon: true,
    naturalJitter: true,
    autoUnblock: false,
    alwaysActive: false,
    forceSelect: false,
    vocabHelper: true,
    ghostMode: false,
    lastStagedText: ""
  };

  // State
  let activeElement = null;
  let isTyping = false;
  let abortTyping = false;
  let hideTimeout = null;
  let currentRestrictions = null;
  let selectedWord = "";
  let myTabId = null;

  // Ask background for our tab ID and tab-specific Always Active state
  async function checkTabAlwaysActive() {
    try {
      const resp = await chrome.runtime.sendMessage({ type: "CHECK_TAB_ALWAYS_ACTIVE" });
      if (resp && resp.tabId) {
        myTabId = resp.tabId;
        settings.alwaysActive = !!resp.alwaysActive;
        window.postMessage({ type: "HT_SET_UNBLOCK_STATE", key: "alwaysActive", unblock: !!settings.alwaysActive }, "*");
      }
    } catch (e) {}
  }

  // Load settings
  chrome.storage.local.get(null, (res) => {
    if (res) {
      settings = { ...settings, ...res };
      checkTabAlwaysActive();
      syncProbeFeatures();
      updateGhostModeDisplay();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      for (const [key, change] of Object.entries(changes)) {
        if (key !== "alwaysActive") {
          settings[key] = change.newValue;
        }
      }
      if (changes.alwaysActiveTabIds && myTabId) {
        const activeIds = changes.alwaysActiveTabIds.newValue || [];
        const isMyTabActive = Array.isArray(activeIds) && activeIds.includes(myTabId);
        if (settings.alwaysActive !== isMyTabActive) {
          settings.alwaysActive = isMyTabActive;
          window.postMessage({ type: "HT_SET_UNBLOCK_STATE", key: "alwaysActive", unblock: isMyTabActive }, "*");
        }
      }
      syncProbeFeatures();
      if (!settings.showFloatingIcon || !settings.enabled || settings.ghostMode) {
        hideButton();
      }
      if (changes.ghostMode !== undefined) {
        updateGhostModeDisplay();
      }
    }
  });

  function syncProbeFeatures() {
    window.postMessage({ type: "HT_SET_UNBLOCK_STATE", key: "alwaysActive", unblock: !!settings.alwaysActive }, "*");
    window.postMessage({ type: "HT_SET_UNBLOCK_STATE", key: "selection", unblock: !!settings.forceSelect }, "*");
  }

  // Listen for restrictions updates from page-probe.js (MAIN world)
  window.addEventListener("message", (e) => {
    if (!e.data || e.data.type !== "HT_RESTRICTIONS_UPDATE") return;
    currentRestrictions = e.data.restrictions;

    if (settings.autoUnblock) {
      window.postMessage({ type: "HT_SET_UNBLOCK_STATE", key: "all", unblock: true }, "*");
    }
  });

  // Handle messages from Popup or Background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "GET_PAGE_RESTRICTIONS") {
      sendResponse({ restrictions: currentRestrictions });
      return true;
    }

    if (msg.type === "SET_TAB_ALWAYS_ACTIVE") {
      settings.alwaysActive = !!msg.enabled;
      window.postMessage({
        type: "HT_SET_UNBLOCK_STATE",
        key: "alwaysActive",
        unblock: !!msg.enabled
      }, "*");
      sendResponse({ success: true, enabled: settings.alwaysActive });
      return true;
    }

    if (msg.type === "TOGGLE_UNBLOCK") {
      if (msg.key === "alwaysActive") {
        settings.alwaysActive = !!msg.unblock;
      }
      window.postMessage({
        type: "HT_SET_UNBLOCK_STATE",
        key: msg.key,
        unblock: msg.unblock
      }, "*");
      sendResponse({ success: true });
      return true;
    }

    if (msg.type === "TOGGLE_GHOST_MODE") {
      settings.ghostMode = !!msg.ghostMode;
      updateGhostModeDisplay();
      sendResponse({ success: true, ghostMode: settings.ghostMode });
      return true;
    }

    if (msg.type === "TRIGGER_PASTE") {
      performPaste();
      sendResponse({ success: true });
      return true;
    }

    if (msg.type === "STOP_TYPING") {
      if (isTyping) {
        abortTyping = true;
        showToast("⏹ Typing stopped");
      }
      sendResponse({ success: true });
      return true;
    }

    if (msg.type === "CLEAR_STAGED_TEXT") {
      settings.lastStagedText = "";
      settings.stagedText = "";
      chrome.storage.local.set({ lastStagedText: "", stagedText: "" });
      showToast("🗑️ Copied text & staging cleared");
      sendResponse({ success: true });
      return true;
    }

    if (msg.type === "TYPE_STAGED_TEXT") {
      const target = activeElement || (isEditable(document.activeElement) ? document.activeElement : null);
      if (target && msg.text) {
        settings.lastStagedText = msg.text;
        chrome.storage.local.set({ lastStagedText: msg.text });
        typeTextIntoElement(target, msg.text);
      }
      sendResponse({ success: true });
      return true;
    }

    if (msg.type === "SHOW_DEFINITION") {
      if (msg.word) {
        showVocabModal(msg.word, window.innerWidth / 2 - 160, 100);
      }
      sendResponse({ success: true });
      return true;
    }

    if (msg.type === "EXTRACT_ELEMENT_TEXT") {
      performForceCopy();
      sendResponse({ success: true });
      return true;
    }
  });

  // Create isolated Shadow DOM Host
  const host = document.createElement("div");
  host.id = "__forcepaste_host__";
  host.style.all = "initial";
  const shadow = host.attachShadow({ mode: "open" });

  // Styles inside Shadow DOM
  const style = document.createElement("style");
  style.textContent = `
    * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    /* Compact Dual-Icon Floating Dock */
    #ht-button-container {
      position: absolute;
      z-index: 2147483647;
      display: none;
      align-items: center;
      gap: 3px;
      padding: 3px;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
      transition: opacity 0.15s ease, transform 0.15s ease;
      opacity: 0;
      transform: translateY(2px) scale(0.96);
      user-select: none;
    }

    #ht-button-container.ht-visible {
      display: flex;
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .ht-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 25px;
      height: 25px;
      padding: 0;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      color: #ffffff;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: all 0.12s ease;
    }

    .ht-icon-btn:hover {
      background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
      transform: scale(1.08);
    }

    .ht-icon-btn.ht-secondary {
      background: #334155;
    }

    .ht-icon-btn.ht-secondary:hover {
      background: #475569;
    }

    .ht-icon-btn.ht-stop {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }

    .ht-icon-btn svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
      flex-shrink: 0;
    }

    /* Fallback prompt dialog */
    #ht-dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(2px);
      z-index: 2147483647;
      display: none;
      align-items: center;
      justify-content: center;
    }

    #ht-dialog {
      background: #ffffff;
      padding: 18px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
      width: 350px;
      max-width: 92vw;
      color: #1f2937;
    }

    #ht-dialog h3 {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    #ht-dialog p {
      margin: 0 0 10px 0;
      font-size: 11.5px;
      color: #4b5563;
      line-height: 1.4;
    }

    #ht-dialog textarea {
      width: 100%;
      height: 90px;
      border: 1.5px solid #c7d2fe;
      border-radius: 8px;
      padding: 10px;
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      outline: none;
      color: #1f2937;
      background: #fafafa;
    }

    .ht-dialog-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 12px;
      gap: 6px;
    }

    .ht-dialog-actions-right {
      display: flex;
      gap: 6px;
    }

    .ht-dialog-actions button {
      padding: 6px 11px;
      font-size: 11.5px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .ht-btn-clip {
      background: #ede9fe;
      color: #5b21b6;
      border: 1px solid #ddd6fe;
    }

    .ht-btn-clip:hover {
      background: #ddd6fe;
    }

    .ht-btn-clear {
      background: #fee2e2;
      color: #dc2626;
    }

    .ht-btn-cancel {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }

    .ht-btn-cancel:hover {
      background: #e2e8f0;
    }

    .ht-btn-confirm {
      background: #582be8;
      color: #ffffff;
    }

    .ht-btn-confirm:hover {
      background: #4c1d95;
    }

    /* Vocabulary Helper UI */
    #fp-define-badge {
      position: absolute;
      z-index: 2147483647;
      display: none;
      align-items: center;
      gap: 4px;
      padding: 4px 9px;
      height: 24px;
      background: #111827;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      border-radius: 12px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.3);
      cursor: pointer;
      border: 1px solid rgba(255,255,255,0.2);
      transition: transform 0.12s ease;
      user-select: none;
      pointer-events: auto;
    }

    #fp-define-badge:hover {
      background: #1f2937;
      transform: scale(1.05);
    }

    #fp-define-badge svg {
      width: 12px;
      height: 12px;
      fill: #a5b4fc;
    }

    #fp-vocab-card {
      position: absolute;
      z-index: 2147483647;
      width: 320px;
      max-width: 92vw;
      max-height: 440px;
      background: #ffffff;
      color: #1e293b;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.14);
      border: 1px solid #e2e8f0;
      padding: 14px 16px;
      display: none;
      font-size: 13px;
      overflow-y: auto;
      pointer-events: auto;
    }

    .fp-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .fp-card-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .fp-word-title {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
    }

    .fp-speaker-btn {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.12s ease;
      flex-shrink: 0;
    }

    .fp-speaker-btn:hover {
      background: #e2e8f0;
      transform: scale(1.08);
    }

    .fp-speaker-btn svg {
      width: 14px;
      height: 14px;
      fill: #2563eb;
    }

    .fp-lang-pill {
      font-size: 11px;
      font-weight: 700;
      background: #e0f2fe;
      color: #0369a1;
      padding: 2px 7px;
      border-radius: 6px;
      letter-spacing: 0.3px;
    }

    .fp-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
      padding: 2px;
      transition: color 0.1s ease;
    }

    .fp-close-btn:hover {
      color: #0f172a;
    }

    /* 3 Clean Language Tabs: EN Def, Hindi, Bengali (No Assamese) */
    .fp-lang-tabs {
      display: flex;
      background: #f1f5f9;
      padding: 3px;
      border-radius: 8px;
      gap: 3px;
      margin: 8px 0 12px 0;
    }

    .fp-lang-tab {
      flex: 1;
      text-align: center;
      background: transparent;
      color: #64748b;
      font-size: 12px;
      font-weight: 600;
      padding: 5px 8px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .fp-lang-tab:hover {
      color: #1e293b;
      background: rgba(255, 255, 255, 0.5);
    }

    .fp-lang-tab.active {
      background: #ffffff;
      color: #dc2626;
      font-weight: 700;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .fp-tab-pane {
      display: none;
    }

    .fp-tab-pane.active {
      display: block;
    }

    .fp-pos-label {
      font-size: 11px;
      font-weight: 700;
      font-style: italic;
      color: #334155;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .fp-def-body {
      font-size: 13px;
      color: #1e293b;
      line-height: 1.5;
      margin-bottom: 8px;
    }

    .fp-trans-headline {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .fp-trans-rom {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 8px;
      font-style: italic;
    }

    .fp-dict-group {
      margin-bottom: 6px;
      font-size: 12px;
      line-height: 1.45;
      color: #334155;
    }

    .fp-dict-group b {
      color: #0f172a;
      text-transform: capitalize;
    }

    .fp-synonyms-section {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
    }

    .fp-syn-label {
      font-size: 10.5px;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 4px;
    }

    .fp-synonym-pill {
      display: inline-block;
      background: #f8fafc;
      color: #334155;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 500;
      margin: 2px;
      cursor: pointer;
      transition: all 0.1s ease;
    }

    .fp-synonym-pill:hover {
      background: #3b82f6;
      color: #ffffff;
      border-color: #3b82f6;
    }
  `;

  // UI elements inside shadow root
  const container = document.createElement("div");
  container.id = "ht-button-container";

  // Icon 1: Quick Paste Button (No text, compact!)
  const pasteBtn = document.createElement("button");
  pasteBtn.className = "ht-icon-btn";
  pasteBtn.title = "ForcePaste stored text or clipboard (Alt+V)";
  pasteBtn.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4 0.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>
  `;

  // Icon 2: Edit/Stage Text Button (Opens Pop-up)
  const editBtn = document.createElement("button");
  editBtn.className = "ht-icon-btn ht-secondary";
  editBtn.title = "Set / Edit Text to Type";
  editBtn.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
  `;

  container.appendChild(pasteBtn);
  container.appendChild(editBtn);

  // Modal dialog
  const dialogOverlay = document.createElement("div");
  dialogOverlay.id = "ht-dialog-overlay";
  dialogOverlay.innerHTML = `
    <div id="ht-dialog">
      <h3>
        <svg style="width:16px;height:16px;fill:#6366f1;" viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4 0.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>
        ForcePaste - Auto-Type Text
      </h3>
      <p style="margin:0 0 8px 0;font-size:11.5px;color:#475569;">Paste text below (Ctrl+V works here) or click <b>Paste from Clipboard</b>:</p>
      <textarea id="ht-modal-textarea" placeholder="Paste text here (Ctrl+V works)..."></textarea>
      <div class="ht-dialog-actions">
        <button class="ht-btn-clip" id="ht-btn-fetch-clip" title="Paste from clipboard">📋 Paste from Clipboard</button>
        <div class="ht-dialog-actions-right">
          <button class="ht-btn-cancel" id="ht-btn-cancel-modal">Cancel</button>
          <button class="ht-btn-confirm" id="ht-btn-confirm-modal">Start Typing</button>
        </div>
      </div>
    </div>
  `;

  const isolatedEvents = ["keydown", "keyup", "keypress", "contextmenu", "copy", "paste", "cut", "mousedown", "mouseup"];
  isolatedEvents.forEach((evt) => {
    dialogOverlay.addEventListener(evt, (e) => e.stopPropagation(), true);
  });

  // Vocabulary Helper Elements
  const defineBadge = document.createElement("div");
  defineBadge.id = "fp-define-badge";
  defineBadge.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>
    <span>Define</span>
  `;

  const vocabCard = document.createElement("div");
  vocabCard.id = "fp-vocab-card";
  vocabCard.innerHTML = `
    <div class="fp-card-header">
      <div class="fp-card-title-row">
        <span class="fp-word-title" id="fp-card-word">word</span>
        <button class="fp-speaker-btn" title="Pronounce word" id="fp-card-speaker">
          <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
        </button>
        <span class="fp-lang-pill" id="fp-card-lang">EN</span>
      </div>
      <button class="fp-close-btn" id="fp-card-close" title="Close">&times;</button>
    </div>

    <!-- 3 Language Tabs: English, Hindi, Bengali (No Assamese) -->
    <div class="fp-lang-tabs" id="fp-lang-tabs">
      <button class="fp-lang-tab active" data-tab="en" id="fp-tab-en">EN Def</button>
      <button class="fp-lang-tab" data-tab="hi" id="fp-tab-hi">Hindi</button>
      <button class="fp-lang-tab" data-tab="bn" id="fp-tab-bn">Bengali</button>
    </div>

    <!-- Tab Panes -->
    <div id="fp-pane-en" class="fp-tab-pane active">
      <div id="fp-content-en" style="color:#64748b;font-size:12px;padding:8px 0;">Looking up English definition...</div>
    </div>
    <div id="fp-pane-hi" class="fp-tab-pane">
      <div id="fp-content-hi" style="color:#64748b;font-size:12px;padding:8px 0;">Looking up Hindi meaning...</div>
    </div>
    <div id="fp-pane-bn" class="fp-tab-pane">
      <div id="fp-content-bn" style="color:#64748b;font-size:12px;padding:8px 0;">Looking up Bengali meaning...</div>
    </div>
  `;

  // Notification Toast element
  const toast = document.createElement("div");
  toast.id = "fp-toast";
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(-10px);
    background: #0f172a;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    padding: 7px 16px;
    border-radius: 20px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.15);
    z-index: 2147483647;
    pointer-events: none;
    transition: opacity 0.18s ease, transform 0.18s ease;
    opacity: 0;
    display: none;
  `;

  shadow.appendChild(style);
  shadow.appendChild(container);
  shadow.appendChild(dialogOverlay);
  shadow.appendChild(defineBadge);
  shadow.appendChild(vocabCard);
  shadow.appendChild(toast);

  let toastTimer = null;
  function showToast(msg) {
    if (settings.ghostMode) return;
    mountHost();
    toast.textContent = msg;
    toast.style.display = "block";
    setTimeout(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(-50%) translateY(0)";
    }, 10);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(-10px)";
      setTimeout(() => {
        toast.style.display = "none";
      }, 200);
    }, 2200);
  }

  const mountHost = () => {
    if (!document.documentElement.contains(host)) {
      (document.body || document.documentElement).appendChild(host);
    }
    if (settings.ghostMode) {
      host.style.setProperty("display", "none", "important");
    }
  };

  function updateGhostModeDisplay() {
    if (settings.ghostMode) {
      host.style.setProperty("display", "none", "important");
      if (typeof container !== "undefined" && container) container.classList.remove("ht-visible");
      if (typeof dialogOverlay !== "undefined" && dialogOverlay) dialogOverlay.style.display = "none";
      if (typeof defineBadge !== "undefined" && defineBadge) defineBadge.style.display = "none";
      if (typeof vocabCard !== "undefined" && vocabCard) vocabCard.style.display = "none";
      if (typeof toast !== "undefined" && toast) toast.style.display = "none";
    } else {
      host.style.removeProperty("display");
      if (activeElement && isEditable(activeElement) && settings.enabled && settings.showFloatingIcon && !isTyping) {
        updateButtonPosition(activeElement);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountHost);
  } else {
    mountHost();
  }

  function isEditable(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el instanceof HTMLTextAreaElement) return true;
    if (el instanceof HTMLInputElement) {
      const excluded = ["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"];
      return !excluded.includes((el.type || "").toLowerCase());
    }
    return el.isContentEditable || el.getAttribute("contenteditable") === "true";
  }

  function updateButtonPosition(target) {
    // If Ghost Mode is active, NEVER show on-screen UI
    if (settings.ghostMode) {
      hideButton();
      return;
    }

    if (!target || !document.contains(target)) {
      hideButton();
      return;
    }

    const rect = target.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hideButton();
      return;
    }

    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    // Compact dock width is ~58px
    const isSmall = rect.height < 32 || rect.width < 100;
    let top, left;

    if (isSmall) {
      top = scrollY + rect.top - 32;
      if (top < scrollY + 4) top = scrollY + rect.bottom + 4;
      left = scrollX + rect.right - 62;
    } else {
      top = scrollY + rect.top + 3;
      left = scrollX + rect.right - 64;
    }

    if (left < scrollX + 4) left = scrollX + 4;

    container.style.top = `${top}px`;
    container.style.left = `${left}px`;
    container.classList.add("ht-visible");
  }

  function hideButton() {
    container.classList.remove("ht-visible");
  }

  document.addEventListener(
    "focusin",
    (e) => {
      if (dialogOverlay.style.display === "flex") return;
      if (e.target && isEditable(e.target)) {
        activeElement = e.target;
        if (hideTimeout) clearTimeout(hideTimeout);
        if (settings.enabled && settings.showFloatingIcon && !settings.ghostMode && !isTyping) {
          mountHost();
          updateButtonPosition(activeElement);
        }
      }
    },
    true
  );

  document.addEventListener(
    "focusout",
    (e) => {
      hideTimeout = setTimeout(() => {
        if (!isTyping && dialogOverlay.style.display !== "flex") {
          hideButton();
        }
      }, 350);
    },
    true
  );

  window.addEventListener(
    "scroll",
    () => {
      if (activeElement && container.classList.contains("ht-visible")) {
        requestAnimationFrame(() => updateButtonPosition(activeElement));
      }
    },
    { passive: true }
  );

  window.addEventListener(
    "resize",
    () => {
      if (activeElement && container.classList.contains("ht-visible")) {
        requestAnimationFrame(() => updateButtonPosition(activeElement));
      }
    },
    { passive: true }
  );

  container.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (hideTimeout) clearTimeout(hideTimeout);
  });

  // Cadence-Preserving Keystroke Dynamics Engine
  // Generates randomized human-like per-character delays (50ms - 500ms) while exactly maintaining overall target WPM
  function calculateHumanDelays(text, targetWpm, naturalJitter = true) {
    if (!text || text.length === 0) return [];
    const N = text.length;

    // 1 word = 5 characters. Total target duration = (N / 5) * (60000 / targetWpm) = (N * 12000) / targetWpm
    const targetAverageDelay = Math.round(12000 / Math.max(10, Math.min(600, targetWpm)));
    const totalTargetDuration = N * targetAverageDelay;

    if (!naturalJitter) {
      return new Array(N).fill(targetAverageDelay);
    }

    const weights = new Array(N);
    for (let i = 0; i < N; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : "";

      // 3-sample central limit distribution (natural bell curve around 1.0)
      const r1 = Math.random(), r2 = Math.random(), r3 = Math.random();
      let weight = (r1 + r2 + r3) / 1.5;
      weight = Math.max(0.35, Math.min(2.2, weight));

      // Natural pauses for punctuation and thought transitions
      if ([".", "!", "?", "\n"].includes(char)) {
        weight *= 2.3; // End of sentence cognitive pause
      } else if ([",", ";", ":", "-", "—"].includes(char)) {
        weight *= 1.7; // Clause boundary pause
      } else if (char === " ") {
        weight *= 1.35; // Inter-word transition
      }

      // Reaching for Shift / numbers / complex symbols
      if (/[A-Z]/.test(char)) {
        weight *= 1.3;
      } else if (/[0-9]/.test(char)) {
        weight *= 1.25;
      } else if (/[@#$%^&*()_+={}\[\]|\\<>\/~`"']/.test(char)) {
        weight *= 1.45;
      }

      // Sentence inception pause (first character after sentence end)
      if (i > 0 && [".", "!", "?", "\n"].includes(prevChar) && char !== " ") {
        weight *= 1.6;
      }

      // Random micro-hesitation or thinking pause every ~20 characters
      if (i > 0 && i % 20 === 0 && Math.random() < 0.35) {
        weight *= 1.8;
      }

      // Fast digraphs: consecutive common lowercase letters in finger flow
      if (/[a-z]/.test(char) && /[a-z]/.test(prevChar)) {
        weight *= 0.85;
      }

      weights[i] = weight;
    }

    // Normalize weights to match target total duration
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const scalingFactor = totalTargetDuration / totalWeight;
    let rawDelays = weights.map((w) => w * scalingFactor);

    // Physiological human boundaries (50ms - 500ms for typical speeds)
    const minDelay = Math.max(15, Math.min(50, Math.round(targetAverageDelay * 0.25)));
    const maxDelay = Math.max(180, Math.min(550, Math.round(targetAverageDelay * 2.5)));

    let sumDelays = 0;
    const clampedDelays = new Array(N);
    for (let i = 0; i < N; i++) {
      clampedDelays[i] = Math.max(minDelay, Math.min(maxDelay, rawDelays[i]));
      sumDelays += clampedDelays[i];
    }

    // Redistribute residual clamping delta to maintain exact target average WPM
    const diff = totalTargetDuration - sumDelays;
    const perCharAdjustment = diff / N;
    for (let i = 0; i < N; i++) {
      clampedDelays[i] = Math.max(minDelay, Math.round(clampedDelays[i] + perCharAdjustment));
    }

    return clampedDelays;
  }

  // Typing engine
  async function typeTextIntoElement(target, text) {
    if (!target || !text) return;
    isTyping = true;
    abortTyping = false;

    pasteBtn.classList.add("ht-stop");
    pasteBtn.title = "Stop typing (Escape)";
    pasteBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>`;

    try {
      target.focus();

      let effectiveWpm = 60;
      if (settings.speedMode === "custom") {
        effectiveWpm = parseInt(settings.customWPM, 10) || 60;
      } else if (settings.speedMode === "human") {
        effectiveWpm = 50; // Human Average (~50 WPM)
      } else if (settings.speedMode === "fast") {
        effectiveWpm = 150; // Fast (~150 WPM)
      }

      if (settings.speedMode === "instant") {
        for (let i = 0; i < text.length; i++) {
          if (abortTyping) break;
          insertSingleCharacter(target, text[i]);
        }
      } else {
        const delays = calculateHumanDelays(text, effectiveWpm, settings.naturalJitter);
        for (let i = 0; i < text.length; i++) {
          if (abortTyping) break;
          insertSingleCharacter(target, text[i]);
          await new Promise((r) => setTimeout(r, delays[i]));
        }
      }

      target.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    } finally {
      isTyping = false;
      abortTyping = false;
      pasteBtn.classList.remove("ht-stop");
      pasteBtn.title = "ForcePaste stored text or clipboard (Alt+V)";
      pasteBtn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4 0.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>
      `;
      if (activeElement) {
        updateButtonPosition(activeElement);
      }
    }
  }

  function insertSingleCharacter(target, char) {
    const code = char.length === 1 ? `Key${char.toUpperCase()}` : "Enter";
    const keyCode = char.charCodeAt(0);

    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: char,
        code: code,
        keyCode: keyCode,
        which: keyCode,
        charCode: keyCode,
        bubbles: true,
        composed: true,
        cancelable: true
      })
    );

    target.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        composed: true,
        cancelable: true,
        inputType: "insertText",
        data: char
      })
    );

    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, char);
    } catch (e) {
      inserted = false;
    }

    if (!inserted && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const val = target.value;
      const nextVal = val.slice(0, start) + char + val.slice(end);

      const proto = Object.getPrototypeOf(target);
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(target, nextVal);
      } else {
        target.value = nextVal;
      }

      const nextPos = start + char.length;
      if (typeof target.setSelectionRange === "function") {
        target.setSelectionRange(nextPos, nextPos);
      }

      target.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          composed: true,
          inputType: "insertText",
          data: char
        })
      );
    } else if (!inserted && target.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(char);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        target.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            composed: true,
            inputType: "insertText",
            data: char
          })
        );
      }
    }

    target.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: char,
        code: code,
        keyCode: keyCode,
        which: keyCode,
        charCode: keyCode,
        bubbles: true,
        composed: true,
        cancelable: true
      })
    );
  }

  async function fetchClipboardText() {
    try {
      const resp = await chrome.runtime.sendMessage({ type: "READ_CLIPBOARD_BG" });
      if (resp && typeof resp.text === "string" && resp.text.length > 0) {
        return resp.text;
      }
    } catch (err) {}

    try {
      const text = await navigator.clipboard.readText();
      if (text) return text;
    } catch (err) {}

    return "";
  }

  // Perform paste action
  async function performPaste() {
    if (isTyping) {
      abortTyping = true;
      return;
    }

    const target = activeElement || (isEditable(document.activeElement) ? document.activeElement : null);
    if (!target) return;

    // 1. If user previously entered text into the modal, REUSE IT directly! No popup!
    if (settings.lastStagedText && settings.lastStagedText.trim().length > 0) {
      await typeTextIntoElement(target, settings.lastStagedText);
      return;
    }

    // 2. Otherwise try reading from clipboard directly
    const text = await fetchClipboardText();
    if (text && text.trim().length > 0) {
      await typeTextIntoElement(target, text);
      return;
    }

    // 3. Only if both are empty do we open the input dialog
    showSetTextDialog(target);
  }

  function showSetTextDialog(target) {
    if (settings.ghostMode) return; // Never show on-screen UI if in Ghost Mode

    const textarea = dialogOverlay.querySelector("#ht-modal-textarea");
    const fetchBtn = dialogOverlay.querySelector("#ht-btn-fetch-clip");
    const clearBtn = dialogOverlay.querySelector("#ht-btn-clear-stored");
    const cancelBtn = dialogOverlay.querySelector("#ht-btn-cancel-modal");
    const confirmBtn = dialogOverlay.querySelector("#ht-btn-confirm-modal");

    textarea.value = settings.lastStagedText || "";
    dialogOverlay.style.display = "flex";
    setTimeout(() => textarea.focus(), 60);

    const close = () => {
      dialogOverlay.style.display = "none";
      if (target) target.focus();
    };

    fetchBtn.onclick = async (e) => {
      e.stopPropagation();
      const clipText = await fetchClipboardText();
      if (clipText) {
        textarea.value = clipText;
      }
    };

    if (clearBtn) {
      clearBtn.onclick = (e) => {
        e.stopPropagation();
        textarea.value = "";
        settings.lastStagedText = "";
        chrome.storage.local.set({ lastStagedText: "", stagedText: "" });
      };
    }

    cancelBtn.onclick = (e) => {
      e.stopPropagation();
      close();
    };

    confirmBtn.onclick = (e) => {
      e.stopPropagation();
      const text = textarea.value;
      close();
      if (text && text.length > 0) {
        // Remember this text so future clicks paste directly without opening pop-up!
        settings.lastStagedText = text;
        chrome.storage.local.set({ lastStagedText: text, stagedText: text });
        if (target) {
          typeTextIntoElement(target, text);
        }
      }
    };
  }

  // Click on Icon 1: Quick Paste
  pasteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    performPaste();
  });

  // Click on Icon 2: Open Edit Modal
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const target = activeElement || (isEditable(document.activeElement) ? document.activeElement : null);
    showSetTextDialog(target);
  });

  // Track hovered element for Force Text Extract & Copy
  let lastHoveredElement = null;
  document.addEventListener(
    "mouseover",
    (e) => {
      if (e.target && !host.contains(e.target)) {
        lastHoveredElement = e.target;
      }
    },
    { passive: true }
  );

  function copyTextFallback(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {}
    ta.remove();
  }

  function performForceCopy() {
    let textToCopy = "";
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      textToCopy = sel.toString();
    } else {
      const el = lastHoveredElement || (isEditable(document.activeElement) ? document.activeElement : null);
      if (el && el !== document.body && el !== document.documentElement) {
        textToCopy = el.innerText || el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || "";
      }
    }

    if (textToCopy && textToCopy.trim().length > 0) {
      // Strip zero-width spaces, soft hyphens, byte order marks, and invisible noise
      const clean = textToCopy
        .replace(/[\u200B\u200C\u200D\uFEFF\u00AD\u2060\u200E\u200F]/g, "")
        .replace(/\u00A0/g, " ");

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(clean).then(() => {
          showToast("📋 Clean text copied!");
        }).catch(() => {
          copyTextFallback(clean);
          showToast("📋 Clean text copied!");
        });
      } else {
        copyTextFallback(clean);
        showToast("📋 Clean text copied!");
      }
    } else {
      showToast("ℹ️ Highlight text or hover an element to copy");
    }
  }

  // Native Copy Sanitizer: automatically cleans zero-width spaces & noise characters
  document.addEventListener(
    "copy",
    (e) => {
      if (!settings.forceSelect) return;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const rawText = sel.toString();
        if (rawText && rawText.length > 0) {
          const cleanText = rawText
            .replace(/[\u200B\u200C\u200D\uFEFF\u00AD\u2060\u200E\u200F]/g, "")
            .replace(/\u00A0/g, " ");

          if (e.clipboardData) {
            e.clipboardData.setData("text/plain", cleanText);
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        }
      }
    },
    true
  );

  // Customizable Keyboard Shortcuts Engine
  const defaultShortcuts = {
    paste: { key: "v", alt: true, ctrl: false, shift: false, meta: false, display: "Alt + V" },
    stop: { key: "Escape", alt: false, ctrl: false, shift: false, meta: false, display: "Escape" },
    clear: { key: "k", alt: true, ctrl: false, shift: false, meta: false, display: "Alt + K" },
    copy: { key: "c", alt: true, ctrl: false, shift: false, meta: false, display: "Alt + C" },
    ghost: { key: "h", alt: true, ctrl: false, shift: false, meta: false, display: "Alt + H" }
  };
  let activeShortcuts = { ...defaultShortcuts };

  chrome.storage.local.get(["customShortcuts"], (res) => {
    if (res && res.customShortcuts) {
      activeShortcuts = { ...defaultShortcuts, ...res.customShortcuts };
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.customShortcuts) {
      activeShortcuts = { ...defaultShortcuts, ...(changes.customShortcuts.newValue || {}) };
    }
  });

  function matchesShortcut(e, shortcut) {
    if (!shortcut || !shortcut.key) return false;
    const matchAlt = !!shortcut.alt === !!e.altKey;
    const matchCtrl = !!shortcut.ctrl === !!e.ctrlKey;
    const matchShift = !!shortcut.shift === !!e.shiftKey;
    const matchMeta = !!shortcut.meta === !!e.metaKey;

    const keyLower = shortcut.key.toLowerCase();
    const eKeyLower = (e.key || "").toLowerCase();
    const eCodeLower = (e.code || "").toLowerCase();

    const matchKey =
      eKeyLower === keyLower ||
      eCodeLower === `key${keyLower}` ||
      eCodeLower === `digit${keyLower}` ||
      eCodeLower === keyLower;

    return matchAlt && matchCtrl && matchShift && matchMeta && matchKey;
  }

  document.addEventListener(
    "keydown",
    (e) => {
      // 1. Stop Typing (Abort / Cancel)
      if (matchesShortcut(e, activeShortcuts.stop)) {
        if (isTyping) {
          e.preventDefault();
          e.stopPropagation();
          abortTyping = true;
          showToast("⏹ Typing stopped");
          return;
        }
      }

      // 2. Clear Copied & Staged Text
      if (matchesShortcut(e, activeShortcuts.clear)) {
        e.preventDefault();
        e.stopPropagation();
        settings.lastStagedText = "";
        settings.stagedText = "";
        chrome.storage.local.set({ lastStagedText: "", stagedText: "" });
        showToast("🗑️ Copied text & staging cleared");
        return;
      }

      // 3. Quick Paste / Force-Type
      if (matchesShortcut(e, activeShortcuts.paste)) {
        const target = isEditable(document.activeElement) ? document.activeElement : activeElement;
        if (target) {
          e.preventDefault();
          e.stopPropagation();
          activeElement = target;
          performPaste();
          return;
        }
      }

      // 4. Force Copy / Clean Extract
      if (matchesShortcut(e, activeShortcuts.copy)) {
        e.preventDefault();
        e.stopPropagation();
        performForceCopy();
        return;
      }

      // 5. Toggle Ghost Mode
      if (matchesShortcut(e, activeShortcuts.ghost)) {
        e.preventDefault();
        e.stopPropagation();
        settings.ghostMode = !settings.ghostMode;
        chrome.storage.local.set({ ghostMode: settings.ghostMode });
        updateGhostModeDisplay();
        showToast(settings.ghostMode ? "👻 Ghost Mode ON" : "👁️ Ghost Mode OFF");
        return;
      }
    },
    true
  );

  // Capture-phase event protection against anti-copy scripts and exams
  ["copy", "cut", "selectstart", "contextmenu"].forEach((evtType) => {
    window.addEventListener(
      evtType,
      (e) => {
        if (settings.forceSelect || settings.autoUnblock) {
          e.stopPropagation();
        }
      },
      true
    );
  });

  // =========================================================================
  // UNIVERSAL MULTI-LANGUAGE VOCABULARY & TRANSLATION ENGINE
  // =========================================================================

  const LANG_MAP = {
    en: { name: "English", bcp47: "en-US" },
    as: { name: "Assamese", bcp47: "as-IN" },
    bn: { name: "Bengali", bcp47: "bn-IN" },
    hi: { name: "Hindi", bcp47: "hi-IN" },
    es: { name: "Spanish", bcp47: "es-ES" },
    fr: { name: "French", bcp47: "fr-FR" },
    de: { name: "German", bcp47: "de-DE" },
    it: { name: "Italian", bcp47: "it-IT" },
    pt: { name: "Portuguese", bcp47: "pt-BR" },
    ru: { name: "Russian", bcp47: "ru-RU" },
    ja: { name: "Japanese", bcp47: "ja-JP" },
    ko: { name: "Korean", bcp47: "ko-KR" },
    zh: { name: "Chinese", bcp47: "zh-CN" },
    ar: { name: "Arabic", bcp47: "ar-SA" },
    ta: { name: "Tamil", bcp47: "ta-IN" },
    te: { name: "Telugu", bcp47: "te-IN" },
    ur: { name: "Urdu", bcp47: "ur-PK" },
    gu: { name: "Gujarati", bcp47: "gu-IN" },
    mr: { name: "Marathi", bcp47: "mr-IN" },
    kn: { name: "Kannada", bcp47: "kn-IN" },
    ml: { name: "Malayalam", bcp47: "ml-IN" },
    pa: { name: "Punjabi", bcp47: "pa-IN" },
    ne: { name: "Nepali", bcp47: "ne-NP" },
    id: { name: "Indonesian", bcp47: "id-ID" },
    vi: { name: "Vietnamese", bcp47: "vi-VN" },
    tr: { name: "Turkish", bcp47: "tr-TR" }
  };

  let currentAudioUrl = null;
  let currentActiveTab = "en"; // "en", "hi", "bn"
  let cachedMultiData = null;

  function speakWord(word, langCode = "en-US") {
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(word);
        utter.lang = langCode || "en-US";
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const matchedVoice = voices.find((v) =>
            v.lang.toLowerCase().startsWith((langCode || "en").toLowerCase().slice(0, 2))
          );
          if (matchedVoice) utter.voice = matchedVoice;
        }
        window.speechSynthesis.speak(utter);
      } catch (e) {}
    }
  }

  async function fetchMultiLanguageVocab(rawWord) {
    const cleanWord = rawWord.trim().replace(/^[\s,.;:!?'"()\[\]]+|[\s,.;:!?'"()\[\]]+$/g, "") || rawWord.trim();

    const [enTrans, hiTrans, bnTrans, enDict] = await Promise.all([
      // English Translation / detection
      fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(cleanWord)}`)
        .then((r) => r.json())
        .catch(() => null),
      // Hindi Translation & Dictionary
      fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=hi&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(cleanWord)}`)
        .then((r) => r.json())
        .catch(() => null),
      // Bengali Translation & Dictionary
      fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=bn&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(cleanWord)}`)
        .then((r) => r.json())
        .catch(() => null),
      // Oxford English Dictionary
      fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`)
        .then((r) => r.json())
        .catch(() => null)
    ]);

    // Parse English
    let enDefs = [];
    let enSyns = [];
    let enPhonetic = "";
    let enAudio = null;

    if (Array.isArray(enDict) && enDict.length > 0) {
      const entry = enDict[0];
      enPhonetic = entry.phonetic || (entry.phonetics?.find((p) => p.text)?.text) || "";
      enAudio = entry.phonetics?.find((p) => p.audio)?.audio || null;
      if (entry.meanings) {
        entry.meanings.forEach((m) => {
          const pos = m.partOfSpeech || "";
          m.definitions?.slice(0, 3).forEach((d) => {
            enDefs.push({
              pos: pos,
              def: d.definition,
              example: d.example || ""
            });
          });
          if (m.synonyms) enSyns.push(...m.synonyms);
        });
      }
    }

    // If Oxford had no definitions, fallback to Google translate meanings
    if (enDefs.length === 0 && enTrans) {
      const gTrans = enTrans[0]?.[0]?.[0] || cleanWord;
      const gRom = enTrans[0]?.[1]?.[3] || "";
      if (gRom) enPhonetic = gRom;

      if (Array.isArray(enTrans[1])) {
        enTrans[1].forEach((item) => {
          if (item && item[0] && Array.isArray(item[1])) {
            item[1].slice(0, 3).forEach((meaning) => {
              enDefs.push({
                pos: item[0],
                def: meaning,
                example: ""
              });
            });
            enSyns.push(...item[1]);
          }
        });
      }
      if (enDefs.length === 0 && gTrans) {
        enDefs.push({
          pos: "definition",
          def: gTrans,
          example: ""
        });
      }
    }

    // Supplement synonyms
    if (enSyns.length < 4) {
      try {
        const dm = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(cleanWord)}&max=12`).then((r) => r.json());
        if (Array.isArray(dm)) {
          enSyns = Array.from(new Set([...enSyns, ...dm.map((d) => d.word)]));
        }
      } catch (e) {}
    }

    // Parse Hindi
    let hiWord = hiTrans?.[0]?.[0]?.[0] || "";
    let hiRom = hiTrans?.[0]?.[1]?.[3] || "";
    let hiGroups = [];
    let hiSyns = [];
    if (Array.isArray(hiTrans?.[1])) {
      hiTrans[1].forEach((item) => {
        if (item && item[0] && Array.isArray(item[1])) {
          hiGroups.push({
            pos: item[0],
            words: item[1].slice(0, 6)
          });
          hiSyns.push(...item[1]);
        }
      });
    }

    // Parse Bengali
    let bnWord = bnTrans?.[0]?.[0]?.[0] || "";
    let bnRom = bnTrans?.[0]?.[1]?.[3] || "";
    let bnGroups = [];
    let bnSyns = [];
    if (Array.isArray(bnTrans?.[1])) {
      bnTrans[1].forEach((item) => {
        if (item && item[0] && Array.isArray(item[1])) {
          bnGroups.push({
            pos: item[0],
            words: item[1].slice(0, 6)
          });
          bnSyns.push(...item[1]);
        }
      });
    }

    return {
      word: cleanWord,
      en: {
        phonetic: enPhonetic,
        audio: enAudio,
        definitions: enDefs,
        synonyms: enSyns
      },
      hi: {
        word: hiWord,
        romanization: hiRom,
        groups: hiGroups,
        synonyms: hiSyns
      },
      bn: {
        word: bnWord,
        romanization: bnRom,
        groups: bnGroups,
        synonyms: bnSyns
      }
    };
  }

  function renderMultiVocab(data, activeTab = "en") {
    currentActiveTab = activeTab;
    cachedMultiData = data;

    const wordEl = shadow.querySelector("#fp-card-word");
    const contentEn = shadow.querySelector("#fp-content-en");
    const contentHi = shadow.querySelector("#fp-content-hi");
    const contentBn = shadow.querySelector("#fp-content-bn");

    wordEl.textContent = data.word;

    // 1. Render English Tab
    let enHtml = "";
    if (data.en.definitions.length > 0) {
      data.en.definitions.slice(0, 3).forEach((d) => {
        enHtml += `
          <div style="margin-bottom:8px;">
            ${d.pos ? `<div class="fp-pos-label">${d.pos}</div>` : ""}
            <div class="fp-def-body">${d.def}</div>
            ${d.example ? `<div style="font-size:11px;color:#64748b;font-style:italic;margin-top:2px;">"${d.example}"</div>` : ""}
          </div>
        `;
      });
    } else {
      enHtml = `<div style="color:#64748b;font-size:12px;">No definition found.</div>`;
    }

    if (data.en.synonyms.length > 0) {
      enHtml += `<div class="fp-synonyms-section"><div class="fp-syn-label">Synonyms (Click to copy):</div>`;
      data.en.synonyms.slice(0, 12).forEach((s) => {
        enHtml += `<span class="fp-synonym-pill" data-word="${s}">${s}</span>`;
      });
      enHtml += `</div>`;
    }
    contentEn.innerHTML = enHtml;

    // 2. Render Hindi Tab
    let hiHtml = "";
    if (data.hi.word) {
      hiHtml += `<div class="fp-trans-headline">${data.hi.word}</div>`;
      if (data.hi.romanization) {
        hiHtml += `<div class="fp-trans-rom">/${data.hi.romanization}/</div>`;
      }
      if (data.hi.groups.length > 0) {
        data.hi.groups.forEach((g) => {
          hiHtml += `<div class="fp-dict-group"><b>${g.pos}:</b> ${g.words.join(", ")}</div>`;
        });
      }
    } else {
      hiHtml = `<div style="color:#64748b;font-size:12px;">No Hindi translation found.</div>`;
    }
    if (data.hi.synonyms.length > 0) {
      hiHtml += `<div class="fp-synonyms-section"><div class="fp-syn-label">Alternatives:</div>`;
      data.hi.synonyms.slice(0, 10).forEach((s) => {
        hiHtml += `<span class="fp-synonym-pill" data-word="${s}">${s}</span>`;
      });
      hiHtml += `</div>`;
    }
    contentHi.innerHTML = hiHtml;

    // 3. Render Bengali Tab
    let bnHtml = "";
    if (data.bn.word) {
      bnHtml += `<div class="fp-trans-headline">${data.bn.word}</div>`;
      if (data.bn.romanization) {
        bnHtml += `<div class="fp-trans-rom">/${data.bn.romanization}/</div>`;
      }
      if (data.bn.groups.length > 0) {
        data.bn.groups.forEach((g) => {
          bnHtml += `<div class="fp-dict-group"><b>${g.pos}:</b> ${g.words.join(", ")}</div>`;
        });
      }
    } else {
      bnHtml = `<div style="color:#64748b;font-size:12px;">No Bengali translation found.</div>`;
    }
    if (data.bn.synonyms.length > 0) {
      bnHtml += `<div class="fp-synonyms-section"><div class="fp-syn-label">Alternatives:</div>`;
      data.bn.synonyms.slice(0, 10).forEach((s) => {
        bnHtml += `<span class="fp-synonym-pill" data-word="${s}">${s}</span>`;
      });
      bnHtml += `</div>`;
    }
    contentBn.innerHTML = bnHtml;

    // Add click listeners to synonym chips
    shadow.querySelectorAll(".fp-synonym-pill").forEach((chip) => {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        const w = chip.dataset.word;
        navigator.clipboard.writeText(w);
        const originalText = chip.textContent;
        chip.textContent = "✓ Copied";
        chip.style.background = "#10b981";
        chip.style.color = "#ffffff";
        setTimeout(() => {
          chip.textContent = originalText;
          chip.style.removeProperty("background");
          chip.style.removeProperty("color");
        }, 1200);
      });
    });

    // Switch to active tab view
    switchVocabTab(activeTab);
  }

  function switchVocabTab(tab) {
    currentActiveTab = tab;
    const tabEn = shadow.querySelector("#fp-tab-en");
    const tabHi = shadow.querySelector("#fp-tab-hi");
    const tabBn = shadow.querySelector("#fp-tab-bn");

    const paneEn = shadow.querySelector("#fp-pane-en");
    const paneHi = shadow.querySelector("#fp-pane-hi");
    const paneBn = shadow.querySelector("#fp-pane-bn");

    const langBadgeEl = shadow.querySelector("#fp-card-lang");

    [tabEn, tabHi, tabBn].forEach((t) => t?.classList.remove("active"));
    [paneEn, paneHi, paneBn].forEach((p) => p?.classList.remove("active"));

    if (tab === "en") {
      tabEn?.classList.add("active");
      paneEn?.classList.add("active");
      if (langBadgeEl) langBadgeEl.textContent = "EN";
    } else if (tab === "hi") {
      tabHi?.classList.add("active");
      paneHi?.classList.add("active");
      if (langBadgeEl) langBadgeEl.textContent = "HI";
    } else if (tab === "bn") {
      tabBn?.classList.add("active");
      paneBn?.classList.add("active");
      if (langBadgeEl) langBadgeEl.textContent = "BN";
    }
  }

  // Audio Speaker
  shadow.querySelector("#fp-card-speaker").addEventListener("click", (e) => {
    e.stopPropagation();
    if (!cachedMultiData) return;

    if (currentActiveTab === "en") {
      if (cachedMultiData.en.audio) {
        new Audio(cachedMultiData.en.audio).play().catch(() => speakWord(cachedMultiData.word, "en-US"));
      } else {
        speakWord(cachedMultiData.word, "en-US");
      }
    } else if (currentActiveTab === "hi") {
      const textToSpeak = cachedMultiData.hi.word || cachedMultiData.word;
      speakWord(textToSpeak, "hi-IN");
    } else if (currentActiveTab === "bn") {
      const textToSpeak = cachedMultiData.bn.word || cachedMultiData.word;
      speakWord(textToSpeak, "bn-IN");
    }
  });

  // Tab buttons
  shadow.querySelector("#fp-tab-en").addEventListener("click", (e) => {
    e.stopPropagation();
    switchVocabTab("en");
  });
  shadow.querySelector("#fp-tab-hi").addEventListener("click", (e) => {
    e.stopPropagation();
    switchVocabTab("hi");
  });
  shadow.querySelector("#fp-tab-bn").addEventListener("click", (e) => {
    e.stopPropagation();
    switchVocabTab("bn");
  });

  // Close button
  shadow.querySelector("#fp-card-close").addEventListener("click", (e) => {
    e.stopPropagation();
    vocabCard.style.display = "none";
    defineBadge.style.display = "none";
  });

  async function showVocabModal(word, badgeEl) {
    if (settings.ghostMode) return;
    mountHost();

    // Capture badge position then immediately hide define badge to avoid overlap
    let badgeRect = badgeEl && badgeEl.getBoundingClientRect ? badgeEl.getBoundingClientRect() : null;
    defineBadge.style.display = "none";

    const cleanWord = word.trim().replace(/^[\s,.;:!?'"()\[\]]+|[\s,.;:!?'"()\[\]]+$/g, "") || word.trim();
    selectedWord = cleanWord;

    const wordEl = shadow.querySelector("#fp-card-word");
    const langBadgeEl = shadow.querySelector("#fp-card-lang");
    wordEl.textContent = cleanWord;
    if (langBadgeEl) langBadgeEl.textContent = "EN";

    // Set initial loading states
    shadow.querySelector("#fp-content-en").innerHTML = `<div style="color:#64748b;font-size:12px;padding:8px 0;">Looking up English definition...</div>`;
    shadow.querySelector("#fp-content-hi").innerHTML = `<div style="color:#64748b;font-size:12px;padding:8px 0;">Looking up Hindi meaning...</div>`;
    shadow.querySelector("#fp-content-bn").innerHTML = `<div style="color:#64748b;font-size:12px;padding:8px 0;">Looking up Bengali meaning...</div>`;

    switchVocabTab("en");

    // Position card directly where badge was, with viewport awareness
    let modalWidth = 320;
    let modalHeight = 300;
    let left = badgeRect ? badgeRect.left + window.scrollX - 10 : window.innerWidth / 2 - 160;
    let top = badgeRect ? badgeRect.top + window.scrollY : 120 + window.scrollY;

    // If card overflows viewport at bottom, position it above selection
    if (badgeRect && (badgeRect.bottom + modalHeight > window.innerHeight) && (badgeRect.top - modalHeight > 10)) {
      top = badgeRect.top - modalHeight - 10 + window.scrollY;
    }

    if (left + modalWidth > window.innerWidth - 10 + window.scrollX) {
      left = window.innerWidth - modalWidth - 10 + window.scrollX;
    }
    if (left < 10 + window.scrollX) {
      left = 10 + window.scrollX;
    }

    vocabCard.style.left = `${left}px`;
    vocabCard.style.top = `${top}px`;
    vocabCard.style.display = "block";

    const data = await fetchMultiLanguageVocab(cleanWord);
    renderMultiVocab(data, "en");
  }

  // Highlight Text Trigger: Show ONLY the "Define" Badge until clicked!
  document.addEventListener("mouseup", (e) => {
    if (!settings.vocabHelper || settings.ghostMode) return;
    if (host.contains(e.target)) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : "";

      if (text && text.length >= 2 && text.length <= 60 && !text.includes("\n")) {
        const words = text.split(/\s+/);
        if (words.length <= 4) {
          try {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              const x = rect.left + rect.width / 2 - 25 + window.scrollX;
              const y = rect.bottom + 6 + window.scrollY;

              defineBadge.style.left = `${Math.max(10, x)}px`;
              defineBadge.style.top = `${y}px`;
              defineBadge.style.display = "flex";
              vocabCard.style.display = "none"; // DO NOT show modal until Define is clicked!

              defineBadge.onclick = (evt) => {
                evt.stopPropagation();
                showVocabModal(text, defineBadge);
              };
              return;
            }
          } catch (err) {}
        }
      }

      defineBadge.style.display = "none";
    }, 60);
  });

  document.addEventListener("mousedown", (e) => {
    if (!host.contains(e.target)) {
      vocabCard.style.display = "none";
      defineBadge.style.display = "none";
    }
  });
})();
