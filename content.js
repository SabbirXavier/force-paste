// HumanTyper Content Script - Bypasses Paste/DevTools blockers safely
(() => {
  if (window.__HUMAN_TYPER_CONTENT_INITIALIZED__) return;
  window.__HUMAN_TYPER_CONTENT_INITIALIZED__ = true;

  // Settings cache
  let settings = {
    enabled: true,
    speedMode: "custom", // custom, human, fast, instant
    baseDelay: 25,
    customWPM: 60,
    showFloatingIcon: true,
    naturalJitter: true,
    autoUnblock: false
  };

  // State
  let activeElement = null;
  let isTyping = false;
  let abortTyping = false;
  let hideTimeout = null;
  let currentRestrictions = null;

  // Load settings
  chrome.storage.local.get(null, (res) => {
    if (res) settings = { ...settings, ...res };
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      for (const [key, change] of Object.entries(changes)) {
        settings[key] = change.newValue;
      }
      if (!settings.showFloatingIcon || !settings.enabled) {
        hideButton();
      }
    }
  });

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

    if (msg.type === "TRIGGER_PASTE") {
      performPaste();
      sendResponse({ success: true });
      return true;
    }
  });

  // Create isolated Shadow DOM Host
  const host = document.createElement("div");
  host.id = "__human_typer_host__";
  host.style.all = "initial";
  const shadow = host.attachShadow({ mode: "open" });

  // Styles for the floating pill and modal
  const style = document.createElement("style");
  style.textContent = `
    * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    #ht-button-container {
      position: absolute;
      z-index: 2147483647;
      display: none;
      align-items: center;
      gap: 4px;
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

    .ht-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 9px;
      height: 26px;
      font-size: 11px;
      font-weight: 600;
      color: #ffffff;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1);
      transition: all 0.12s ease;
      line-height: 1;
    }

    .ht-btn:hover {
      background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
      box-shadow: 0 3px 8px rgba(79, 70, 229, 0.35);
      transform: translateY(-1px);
    }

    .ht-btn:active {
      transform: translateY(0);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .ht-btn.ht-stop {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }

    .ht-btn.ht-stop:hover {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      box-shadow: 0 3px 8px rgba(220, 38, 38, 0.35);
    }

    .ht-btn svg {
      width: 12px;
      height: 12px;
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
      width: 340px;
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
      font-size: 12px;
      color: #4b5563;
      line-height: 1.4;
    }

    #ht-dialog textarea {
      width: 100%;
      height: 85px;
      border: 1.5px solid #c7d2fe;
      border-radius: 8px;
      padding: 10px;
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      outline: none;
      user-select: auto !important;
      -webkit-user-select: auto !important;
      color: #1f2937;
      background: #fafafa;
    }

    #ht-dialog textarea:focus {
      border-color: #4f46e5;
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
    }

    .ht-dialog-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 12px;
    }

    .ht-dialog-actions-right {
      display: flex;
      gap: 8px;
    }

    .ht-dialog-actions button {
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: background 0.1s ease;
    }

    .ht-btn-clip {
      background: #e0e7ff;
      color: #4338ca;
    }

    .ht-btn-clip:hover {
      background: #c7d2fe;
    }

    .ht-btn-cancel {
      background: #f3f4f6;
      color: #374151;
    }

    .ht-btn-cancel:hover {
      background: #e5e7eb;
    }

    .ht-btn-confirm {
      background: #4f46e5;
      color: #ffffff;
    }

    .ht-btn-confirm:hover {
      background: #4338ca;
    }
  `;

  // UI elements inside shadow root
  const container = document.createElement("div");
  container.id = "ht-button-container";

  const pasteBtn = document.createElement("button");
  pasteBtn.className = "ht-btn";
  pasteBtn.title = "Paste with Human Typing (Alt+V)";
  pasteBtn.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4 0.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>
    <span class="ht-label">Paste</span>
  `;

  container.appendChild(pasteBtn);

  // Fallback modal dialog
  const dialogOverlay = document.createElement("div");
  dialogOverlay.id = "ht-dialog-overlay";
  dialogOverlay.innerHTML = `
    <div id="ht-dialog">
      <h3>
        <svg style="width:16px;height:16px;fill:#4f46e5;" viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4 0.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>
        Paste Text to Auto-Type
      </h3>
      <p>Paste text below (Ctrl+V works here) or click <b>Paste from Clipboard</b>:</p>
      <textarea id="ht-modal-textarea" placeholder="Paste text here (Ctrl+V works)..."></textarea>
      <div class="ht-dialog-actions">
        <button class="ht-btn-clip" id="ht-btn-fetch-clip">
          <svg style="width:12px;height:12px;fill:currentColor" viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4 0.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
          Paste from Clipboard
        </button>
        <div class="ht-dialog-actions-right">
          <button class="ht-btn-cancel">Cancel</button>
          <button class="ht-btn-confirm">Start Typing</button>
        </div>
      </div>
    </div>
  `;

  // Isolate dialog from website event listeners
  const isolatedEvents = [
    "keydown",
    "keyup",
    "keypress",
    "contextmenu",
    "copy",
    "paste",
    "cut",
    "mousedown",
    "mouseup"
  ];
  isolatedEvents.forEach((evt) => {
    dialogOverlay.addEventListener(evt, (e) => {
      e.stopPropagation();
    }, true);
  });

  shadow.appendChild(style);
  shadow.appendChild(container);
  shadow.appendChild(dialogOverlay);

  // Append host to DOM
  const mountHost = () => {
    if (!document.documentElement.contains(host)) {
      (document.body || document.documentElement).appendChild(host);
    }
  };

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

    const isSmall = rect.height < 32 || rect.width < 120;
    let top, left;

    if (isSmall) {
      top = scrollY + rect.top - 30;
      if (top < scrollY + 4) top = scrollY + rect.bottom + 4;
      left = scrollX + rect.right - 65;
    } else {
      top = scrollY + rect.top + 3;
      left = scrollX + rect.right - 70;
    }

    if (left < scrollX + 4) left = scrollX + 4;

    container.style.top = `${top}px`;
    container.style.left = `${left}px`;
    container.classList.add("ht-visible");
  }

  function hideButton() {
    container.classList.remove("ht-visible");
  }

  document.addEventListener("focusin", (e) => {
    if (dialogOverlay.style.display === "flex") return;
    if (e.target && isEditable(e.target)) {
      activeElement = e.target;
      if (hideTimeout) clearTimeout(hideTimeout);
      if (settings.enabled && settings.showFloatingIcon && !isTyping) {
        mountHost();
        updateButtonPosition(activeElement);
      }
    }
  }, true);

  document.addEventListener("focusout", (e) => {
    hideTimeout = setTimeout(() => {
      if (!isTyping && dialogOverlay.style.display !== "flex") {
        hideButton();
      }
    }, 350);
  }, true);

  window.addEventListener("scroll", () => {
    if (activeElement && container.classList.contains("ht-visible")) {
      requestAnimationFrame(() => updateButtonPosition(activeElement));
    }
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (activeElement && container.classList.contains("ht-visible")) {
      requestAnimationFrame(() => updateButtonPosition(activeElement));
    }
  }, { passive: true });

  container.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (hideTimeout) clearTimeout(hideTimeout);
  });

  // Typing engine with manual WPM support
  async function typeTextIntoElement(target, text) {
    if (!target || !text) return;
    isTyping = true;
    abortTyping = false;

    pasteBtn.classList.add("ht-stop");
    pasteBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
      <span class="ht-label">Stop</span>
    `;

    try {
      target.focus();

      // Compute base delay from WPM
      let baseDelay = 200; // default ~60 WPM
      const wpm = parseInt(settings.customWPM, 10) || 60;

      if (settings.speedMode === "instant") {
        baseDelay = 0;
      } else if (settings.speedMode === "custom") {
        // Standard formula: 1 word = 5 chars. Delay = 60,000 / (WPM * 5) = 12,000 / WPM
        baseDelay = Math.round(12000 / Math.max(10, Math.min(600, wpm)));
      } else if (settings.speedMode === "fast") {
        baseDelay = 12; // ~150-200 WPM
      } else if (settings.speedMode === "human") {
        baseDelay = 220; // ~50-55 WPM
      }

      for (let i = 0; i < text.length; i++) {
        if (abortTyping) break;

        const char = text[i];
        insertSingleCharacter(target, char);

        if (settings.speedMode === "instant") {
          continue;
        }

        let delay = baseDelay;

        if (settings.naturalJitter) {
          // Proportionate jitter (~25% variance around base delay)
          const variance = baseDelay * 0.25;
          const jitter = (Math.random() * variance * 2) - variance;
          delay = Math.max(5, delay + jitter);

          // Natural pauses on spaces and punctuation
          if (char === " ") {
            delay += (baseDelay * 0.2);
          } else if ([".", ",", "!", "?", ";", ":", "\n"].includes(char)) {
            delay += (baseDelay * 0.5);
          }

          // Random human micro-pause every ~25 characters
          if (i > 0 && i % 25 === 0 && Math.random() > 0.4) {
            delay += (baseDelay * 0.8);
          }
        }

        await new Promise((r) => setTimeout(r, Math.max(5, delay)));
      }

      target.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    } finally {
      isTyping = false;
      abortTyping = false;
      pasteBtn.classList.remove("ht-stop");
      pasteBtn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4 0.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>
        <span class="ht-label">Paste</span>
      `;
      if (activeElement) {
        updateButtonPosition(activeElement);
      }
    }
  }

  function insertSingleCharacter(target, char) {
    const code = char.length === 1 ? `Key${char.toUpperCase()}` : "Enter";
    const keyCode = char.charCodeAt(0);

    // 1. Dispatch keydown
    target.dispatchEvent(new KeyboardEvent("keydown", {
      key: char,
      code: code,
      keyCode: keyCode,
      which: keyCode,
      charCode: keyCode,
      bubbles: true,
      composed: true,
      cancelable: true
    }));

    // 2. Dispatch beforeinput
    target.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      composed: true,
      cancelable: true,
      inputType: "insertText",
      data: char
    }));

    // 3. Insert character
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

      target.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        composed: true,
        inputType: "insertText",
        data: char
      }));
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
        target.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          composed: true,
          inputType: "insertText",
          data: char
        }));
      }
    }

    // 4. Dispatch keyup
    target.dispatchEvent(new KeyboardEvent("keyup", {
      key: char,
      code: code,
      keyCode: keyCode,
      which: keyCode,
      charCode: keyCode,
      bubbles: true,
      composed: true,
      cancelable: true
    }));
  }

  // Universal clipboard reader
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

  async function performPaste() {
    if (isTyping) {
      abortTyping = true;
      return;
    }

    const target = activeElement || (isEditable(document.activeElement) ? document.activeElement : null);
    if (!target) return;

    const text = await fetchClipboardText();
    if (text) {
      await typeTextIntoElement(target, text);
    } else {
      showFallbackDialog(target);
    }
  }

  function showFallbackDialog(target) {
    const textarea = dialogOverlay.querySelector("#ht-modal-textarea");
    const fetchBtn = dialogOverlay.querySelector("#ht-btn-fetch-clip");
    const cancelBtn = dialogOverlay.querySelector(".ht-btn-cancel");
    const confirmBtn = dialogOverlay.querySelector(".ht-btn-confirm");

    textarea.value = "";
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
      } else {
        fetchBtn.textContent = "Clipboard empty!";
        setTimeout(() => {
          fetchBtn.innerHTML = `
            <svg style="width:12px;height:12px;fill:currentColor" viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4 0.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            Paste from Clipboard
          `;
        }, 1500);
      }
    };

    cancelBtn.onclick = (e) => {
      e.stopPropagation();
      close();
    };

    confirmBtn.onclick = (e) => {
      e.stopPropagation();
      const text = textarea.value;
      close();
      if (text && target) {
        typeTextIntoElement(target, text);
      }
    };
  }

  pasteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    performPaste();
  });

  document.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "v" || e.key === "V" || e.code === "KeyV")) {
      const target = isEditable(document.activeElement) ? document.activeElement : activeElement;
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        activeElement = target;
        performPaste();
      }
    }
  }, true);
})();
