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

  // Load settings
  chrome.storage.local.get(null, (res) => {
    if (res) {
      settings = { ...settings, ...res };
      syncProbeFeatures();
      updateGhostModeDisplay();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      for (const [key, change] of Object.entries(changes)) {
        settings[key] = change.newValue;
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

    if (msg.type === "TOGGLE_UNBLOCK") {
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
      width: 330px;
      max-width: 92vw;
      max-height: 440px;
      background: #181d24;
      color: #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 14px 35px rgba(0,0,0,0.45);
      border: 1px solid #2d3748;
      padding: 14px 16px;
      display: none;
      font-size: 12px;
      overflow-y: auto;
      pointer-events: auto;
    }

    .fp-card-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .fp-oxford-label {
      font-size: 11px;
      color: #94a3b8;
    }

    .fp-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #2d3748;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }

    .fp-card-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .fp-speaker-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #3b82f6;
      border: none;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.1s ease;
      flex-shrink: 0;
    }

    .fp-speaker-btn:hover {
      background: #2563eb;
      transform: scale(1.08);
    }

    .fp-speaker-btn svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .fp-word-title {
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
    }

    .fp-lang-badge {
      font-size: 9.5px;
      font-weight: 700;
      background: #3b82f6;
      color: #ffffff;
      padding: 1px 6px;
      border-radius: 4px;
      text-transform: capitalize;
    }

    .fp-word-phonetic {
      font-size: 11px;
      color: #94a3b8;
      margin-left: 2px;
    }

    .fp-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 16px;
      cursor: pointer;
      line-height: 1;
      padding: 4px;
    }

    .fp-trans-box {
      margin-bottom: 8px;
      padding: 6px 10px;
      background: #1e293b;
      border-radius: 6px;
      border-left: 3px solid #3b82f6;
    }

    .fp-section-title {
      font-size: 12px;
      font-weight: 700;
      color: #60a5fa;
      margin-top: 10px;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .fp-part-of-speech {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 1px 6px;
      border-radius: 4px;
      background: #334155;
      color: #cbd5e1;
      margin-right: 6px;
    }

    .fp-definition-item {
      margin-bottom: 8px;
      line-height: 1.45;
      color: #cbd5e1;
      font-size: 12px;
    }

    .fp-example {
      font-size: 11px;
      font-style: italic;
      color: #94a3b8;
      margin-top: 2px;
      border-left: 2px solid #475569;
      padding-left: 6px;
    }

    .fp-synonyms-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 6px;
    }

    .fp-synonym-pill {
      background: #1e293b;
      color: #93c5fd;
      border: 1px solid #3b82f6;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.1s ease;
    }

    .fp-synonym-pill:hover {
      background: #3b82f6;
      color: #ffffff;
      transform: translateY(-1px);
    }

    .fp-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #2d3748;
    }

    .fp-see-all-btn {
      background: #27272a;
      color: #e4e4e7;
      border: 1px solid #3f3f46;
      border-radius: 14px;
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.12s ease;
    }

    .fp-see-all-btn:hover {
      background: #3f3f46;
      color: #ffffff;
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
    <div class="fp-card-topbar">
      <span class="fp-oxford-label">Definitions from <u>Oxford Languages</u></span>
      <button class="fp-close-btn" id="fp-card-close" title="Close">&times;</button>
    </div>
    <div class="fp-card-header">
      <div class="fp-card-title-row">
        <button class="fp-speaker-btn" title="Pronounce word" id="fp-card-speaker">
          <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
        </button>
        <div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="fp-word-title" id="fp-card-word">word</span>
            <span class="fp-lang-badge" id="fp-card-lang" style="display:none;"></span>
          </div>
          <span class="fp-word-phonetic" id="fp-card-phonetic">/phonetic/</span>
        </div>
      </div>
    </div>
    <div id="fp-card-content">
      <div style="color:#94a3b8;padding:8px 0;">Looking up definitions & translations...</div>
    </div>
    <div class="fp-card-footer">
      <button class="fp-see-all-btn" id="fp-card-see-all">See all definitions</button>
      <span style="font-size:10px;color:#64748b;font-style:italic;">ForcePaste Dictionary</span>
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

      let baseDelay = 200;
      const wpm = parseInt(settings.customWPM, 10) || 60;

      if (settings.speedMode === "instant") {
        baseDelay = 0;
      } else if (settings.speedMode === "custom") {
        baseDelay = Math.round(12000 / Math.max(10, Math.min(600, wpm)));
      } else if (settings.speedMode === "fast") {
        baseDelay = 12;
      } else if (settings.speedMode === "human") {
        baseDelay = 220;
      }

      for (let i = 0; i < text.length; i++) {
        if (abortTyping) break;

        const char = text[i];
        insertSingleCharacter(target, char);

        if (settings.speedMode === "instant") continue;

        let delay = baseDelay;
        if (settings.naturalJitter) {
          const variance = baseDelay * 0.25;
          const jitter = (Math.random() * variance * 2) - variance;
          delay = Math.max(5, delay + jitter);

          if (char === " ") delay += baseDelay * 0.2;
          else if ([".", ",", "!", "?", ";", ":", "\n"].includes(char)) delay += baseDelay * 0.5;

          if (i > 0 && i % 25 === 0 && Math.random() > 0.4) delay += baseDelay * 0.8;
        }

        await new Promise((r) => setTimeout(r, Math.max(5, delay)));
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

  // Keyboard Shortcuts:
  // Alt + V: Trigger ForcePaste
  // Alt + C: Trigger ForceCopy (clean text / extract from element)
  // Alt + H: Toggle Ghost Mode (Hide/Show on-screen UI from screen captures)
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.altKey && (e.key === "v" || e.key === "V" || e.code === "KeyV")) {
        const target = isEditable(document.activeElement) ? document.activeElement : activeElement;
        if (target) {
          e.preventDefault();
          e.stopPropagation();
          activeElement = target;
          performPaste();
        }
      }

      // Alt + C: Force Copy / Extract Text
      if (e.altKey && (e.key === "c" || e.key === "C" || e.code === "KeyC")) {
        e.preventDefault();
        e.stopPropagation();
        performForceCopy();
      }

      // Alt + H toggles Ghost Mode
      if (e.altKey && (e.key === "h" || e.key === "H" || e.code === "KeyH")) {
        e.preventDefault();
        settings.ghostMode = !settings.ghostMode;
        chrome.storage.local.set({ ghostMode: settings.ghostMode });
        updateGhostModeDisplay();
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
  let currentWordLang = "en";

  function pronounceWord(word) {
    if (currentAudioUrl) {
      const audio = new Audio(currentAudioUrl);
      audio.play().catch(() => speakWord(word, currentWordLang));
    } else {
      speakWord(word, currentWordLang);
    }
  }

  function speakWord(word, langCode = "en") {
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(word);
        const langConfig = LANG_MAP[langCode] || { bcp47: "en-US" };
        utter.lang = langConfig.bcp47 || "en-US";
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

  async function fetchWordDetails(word) {
    let result = {
      word: word,
      detectedLang: "en",
      langName: "English",
      translation: "",
      phonetic: "",
      audioUrl: null,
      definitions: [],
      synonyms: []
    };

    try {
      // 1. Google Multi-Language & Translation API
      const transRes = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(word)}`
      );
      if (transRes.ok) {
        const tData = await transRes.json();
        const detected = tData[2] || "en";
        result.detectedLang = detected;
        result.langName = LANG_MAP[detected]?.name || detected.toUpperCase();

        if (tData[0] && tData[0][0]) {
          result.translation = tData[0][0][0] || "";
        }
        if (tData[0] && tData[0][1]) {
          result.phonetic = tData[0][1][3] || "";
        }

        if (Array.isArray(tData[1])) {
          tData[1].forEach((item) => {
            if (item && item[0] && Array.isArray(item[1])) {
              item[1].slice(0, 3).forEach((meaning) => {
                result.definitions.push({
                  partOfSpeech: item[0],
                  definition: meaning,
                  example: ""
                });
              });
              result.synonyms.push(...item[1]);
            }
          });
        }
      }
    } catch (e) {}

    // 2. Query Oxford Dictionary API (for English or translation)
    const lookupTarget = result.detectedLang === "en" ? word : result.translation;
    if (lookupTarget) {
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lookupTarget)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const entry = data[0];
            if (!result.phonetic) {
              result.phonetic = entry.phonetic || (entry.phonetics?.find((p) => p.text)?.text) || "";
            }
            result.audioUrl = entry.phonetics?.find((p) => p.audio)?.audio || null;

            if (entry.meanings) {
              const oxfordDefs = [];
              entry.meanings.forEach((m) => {
                const part = m.partOfSpeech || "";
                m.definitions?.slice(0, 2).forEach((d) => {
                  oxfordDefs.push({
                    partOfSpeech: part,
                    definition: d.definition,
                    example: d.example || ""
                  });
                });
                if (m.synonyms) {
                  result.synonyms.push(...m.synonyms);
                }
              });
              if (oxfordDefs.length > 0) {
                result.definitions = oxfordDefs;
              }
            }
          }
        }
      } catch (e) {}
    }

    // 3. Supplement synonyms via Datamuse
    if (result.synonyms.length < 5 && lookupTarget) {
      try {
        const dmRes = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(lookupTarget)}&max=15`);
        if (dmRes.ok) {
          const dmData = await dmRes.json();
          if (Array.isArray(dmData)) {
            const extraSyns = dmData.map((item) => item.word);
            result.synonyms = Array.from(new Set([...result.synonyms, ...extraSyns]));
          }
        }
      } catch (e) {}
    }

    return result;
  }

  async function showVocabModal(word, x, y) {
    if (settings.ghostMode) return; // Don't show if in Ghost Mode

    mountHost();
    selectedWord = word;
    currentAudioUrl = null;
    currentWordLang = "en";

    const wordEl = shadow.querySelector("#fp-card-word");
    const langBadgeEl = shadow.querySelector("#fp-card-lang");
    const phoneticEl = shadow.querySelector("#fp-card-phonetic");
    const contentEl = shadow.querySelector("#fp-card-content");

    wordEl.textContent = word;
    if (langBadgeEl) langBadgeEl.style.display = "none";
    phoneticEl.textContent = "...";
    contentEl.innerHTML = `<div style="color:#94a3b8;padding:12px 0;">Searching Oxford definitions & translations...</div>`;

    const modalWidth = 330;
    let left = Math.min(Math.max(10, x), window.innerWidth - modalWidth - 20) + window.scrollX;
    let top = y + window.scrollY;

    vocabCard.style.left = `${left}px`;
    vocabCard.style.top = `${top}px`;
    vocabCard.style.display = "block";
    defineBadge.style.display = "none";

    const data = await fetchWordDetails(word);
    currentWordLang = data.detectedLang || "en";
    phoneticEl.textContent = data.phonetic ? `/${data.phonetic}/` : "";
    currentAudioUrl = data.audioUrl;

    if (langBadgeEl && data.detectedLang !== "en") {
      langBadgeEl.textContent = data.langName;
      langBadgeEl.style.display = "inline-block";
    }

    let html = "";

    // If foreign language, show meaning banner
    if (data.detectedLang !== "en" && data.translation && data.translation.toLowerCase() !== word.toLowerCase()) {
      html += `
        <div class="fp-trans-box">
          <div style="font-size:10px;color:#94a3b8;margin-bottom:2px;">English Translation</div>
          <div style="font-size:13px;font-weight:700;color:#60a5fa;">${data.translation}</div>
        </div>
      `;
    }

    if (data.definitions.length > 0) {
      html += `<div class="fp-section-title"><span>Definitions</span><span style="font-size:10px;color:#94a3b8;">${data.definitions.length} found</span></div>`;
      data.definitions.slice(0, 3).forEach((d) => {
        html += `
          <div class="fp-definition-item">
            <span class="fp-part-of-speech">${d.partOfSpeech}</span>
            ${d.definition}
            ${d.example ? `<div class="fp-example">"${d.example}"</div>` : ""}
          </div>
        `;
      });
    } else {
      html += `<div style="color:#94a3b8;margin-bottom:8px;">No direct dictionary definition found.</div>`;
    }

    if (data.synonyms.length > 0) {
      html += `
        <div class="fp-section-title">
          <span>Synonyms</span>
          <span style="font-size:10px;color:#94a3b8;">Click to copy / replace</span>
        </div>
        <div class="fp-synonyms-wrap">
      `;
      data.synonyms.slice(0, 16).forEach((s) => {
        html += `<span class="fp-synonym-pill" data-syn="${s}">${s}</span>`;
      });
      html += `</div>`;
    }

    contentEl.innerHTML = html;

    contentEl.querySelectorAll(".fp-synonym-pill").forEach((pill) => {
      pill.addEventListener("click", (e) => {
        e.stopPropagation();
        const syn = pill.dataset.syn;
        navigator.clipboard.writeText(syn);
        pill.textContent = `✓ Copied!`;
        pill.style.background = "#10b981";
        pill.style.borderColor = "#10b981";
        pill.style.color = "#ffffff";

        if (activeElement && isEditable(activeElement)) {
          insertSingleCharacter(activeElement, syn);
        }

        setTimeout(() => {
          pill.textContent = syn;
          pill.style.background = "#1e293b";
          pill.style.borderColor = "#3b82f6";
          pill.style.color = "#93c5fd";
        }, 1200);
      });
    });
  }

  shadow.querySelector("#fp-card-speaker").addEventListener("click", (e) => {
    e.stopPropagation();
    if (selectedWord) pronounceWord(selectedWord);
  });

  shadow.querySelector("#fp-card-close").addEventListener("click", (e) => {
    e.stopPropagation();
    vocabCard.style.display = "none";
  });

  const seeAllBtn = shadow.querySelector("#fp-card-see-all");
  if (seeAllBtn) {
    seeAllBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      vocabCard.style.display = "none";
      try {
        chrome.runtime.sendMessage({ type: "OPEN_VOCABULARY", word: selectedWord });
      } catch (err) {}
    });
  }

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

              defineBadge.onclick = (evt) => {
                evt.stopPropagation();
                showVocabModal(text, rect.left, rect.bottom + 10);
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
