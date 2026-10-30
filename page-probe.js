// page-probe.js - Runs in MAIN execution world to detect and safely neutralize event blockers
(() => {
  if (window.__HUMAN_TYPER_PROBE_INITIALIZED__) return;
  window.__HUMAN_TYPER_PROBE_INITIALIZED__ = true;

  // Active unblock state
  const unblockState = {
    f12: false,
    contextmenu: false,
    copypaste: false,
    selection: false,
    drag: false
  };

  // Detected restrictions state
  const detectedRestrictions = {
    f12: {
      id: "f12",
      name: "F12 & DevTools Shortcuts",
      blocked: false,
      details: "",
      unblocked: false
    },
    contextmenu: {
      id: "contextmenu",
      name: "Right-Click Context Menu",
      blocked: false,
      details: "",
      unblocked: false
    },
    copypaste: {
      id: "copypaste",
      name: "Copy, Cut & Paste Interception",
      blocked: false,
      details: "",
      unblocked: false
    },
    selection: {
      id: "selection",
      name: "Text Selection & Highlighting",
      blocked: false,
      details: "",
      unblocked: false
    },
    drag: {
      id: "drag",
      name: "Drag & Drop",
      blocked: false,
      details: "",
      unblocked: false
    }
  };

  // 1. Hook EventTarget.prototype.addEventListener to detect what the page attaches
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    try {
      const fnStr = typeof listener === "function" ? listener.toString() : "";

      if (type === "contextmenu") {
        detectedRestrictions.contextmenu.blocked = true;
        detectedRestrictions.contextmenu.details = "Page registered a 'contextmenu' event listener";
        notifyDetection();
      }

      if (type === "keydown" || type === "keyup") {
        if (
          fnStr.includes("123") ||
          fnStr.includes("F12") ||
          fnStr.includes("keyCode == 123") ||
          fnStr.includes("which == 123") ||
          fnStr.includes("isCtrl") ||
          fnStr.includes("ctrlKey")
        ) {
          detectedRestrictions.f12.blocked = true;
          detectedRestrictions.f12.details = "Page registered a keydown listener checking Keycode 123 (F12) or Ctrl modifiers";
          notifyDetection();
        }
        if (fnStr.includes("paste") || fnStr.includes("copy") || fnStr.includes("KeyC") || fnStr.includes("KeyV")) {
          detectedRestrictions.copypaste.blocked = true;
          detectedRestrictions.copypaste.details = "Page intercepts keyboard copy/paste keystrokes";
          notifyDetection();
        }
      }

      if (type === "copy" || type === "cut" || type === "paste") {
        detectedRestrictions.copypaste.blocked = true;
        detectedRestrictions.copypaste.details = `Page registered a '${type}' event listener`;
        notifyDetection();
      }

      if (type === "selectstart") {
        detectedRestrictions.selection.blocked = true;
        detectedRestrictions.selection.details = "Page registered a 'selectstart' listener";
        notifyDetection();
      }

      if (type === "dragstart") {
        detectedRestrictions.drag.blocked = true;
        detectedRestrictions.drag.details = "Page registered a 'dragstart' listener";
        notifyDetection();
      }
    } catch (e) {}

    return originalAddEventListener.apply(this, arguments);
  };

  // 2. Scan property handlers (window.oncontextmenu, document.onkeydown, etc.)
  function scanPropertyBlockers() {
    try {
      // Check Context Menu
      const ctxBlocked =
        (typeof window.oncontextmenu === "function") ||
        (typeof document.oncontextmenu === "function") ||
        (document.body && typeof document.body.oncontextmenu === "function");

      if (ctxBlocked) {
        detectedRestrictions.contextmenu.blocked = true;
        detectedRestrictions.contextmenu.details = "Page set oncontextmenu to cancel right-clicks";
      }

      // Check F12 / Keydown
      const kdFn = document.onkeydown || window.onkeydown;
      if (typeof kdFn === "function") {
        const kdStr = kdFn.toString();
        if (
          kdStr.includes("123") ||
          kdStr.includes("F12") ||
          kdStr.includes("isCtrl") ||
          kdStr.includes("which == 17") ||
          kdStr.includes("keyCode == 17")
        ) {
          detectedRestrictions.f12.blocked = true;
          detectedRestrictions.f12.details = "Page set onkeydown checking Keycode 123 (F12) or Ctrl (17)";
        }
        if (kdStr.includes("isCtrl") || kdStr.includes("Ctrl") || kdStr.includes("paste")) {
          detectedRestrictions.copypaste.blocked = true;
          detectedRestrictions.copypaste.details = "Page set onkeydown suppressing Ctrl shortcuts (Ctrl+C, Ctrl+V)";
        }
      }

      // Check oncopy / onpaste
      if (document.oncopy || window.oncopy || document.onpaste || window.onpaste) {
        detectedRestrictions.copypaste.blocked = true;
        detectedRestrictions.copypaste.details = "Page set oncopy or onpaste handlers";
      }

      // Check onselectstart
      if (document.onselectstart || (document.body && document.body.onselectstart)) {
        detectedRestrictions.selection.blocked = true;
        detectedRestrictions.selection.details = "Page set onselectstart handler to disable text selection";
      }

      // Check CSS user-select: none
      if (document.body) {
        const bodyStyle = window.getComputedStyle(document.body);
        const htmlStyle = window.getComputedStyle(document.documentElement);
        if (bodyStyle.userSelect === "none" || bodyStyle.webkitUserSelect === "none" ||
            htmlStyle.userSelect === "none" || htmlStyle.webkitUserSelect === "none") {
          detectedRestrictions.selection.blocked = true;
          detectedRestrictions.selection.details = "Page CSS applies 'user-select: none' across elements";
        }
      }

      // Check ondragstart
      if (document.ondragstart || (document.body && document.body.ondragstart)) {
        detectedRestrictions.drag.blocked = true;
        detectedRestrictions.drag.details = "Page set ondragstart handler";
      }

      notifyDetection();
    } catch (e) {}
  }

  // 3. CAPTURE PHASE INTERCEPTION (Safe Local Unblocking)
  // This is the core magic: By handling and stopping propagation in the capture phase,
  // the page's event listeners NEVER receive the event.
  // Hence, any telemetry, cheat-logging, or alert script on the page never executes!

  // Unblock F12 / DevTools
  window.addEventListener("keydown", (e) => {
    if (!unblockState.f12) return;

    const isF12 = e.key === "F12" || e.keyCode === 123 || e.which === 123;
    const isDevTools = e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes((e.key || "").toUpperCase());
    const isViewSource = e.ctrlKey && (e.key === "u" || e.key === "U");

    if (isF12 || isDevTools || isViewSource) {
      // Stop the website's blocking handler from receiving or canceling this event!
      e.stopImmediatePropagation();
    }
  }, true); // CAPTURE: runs before website listeners

  // Unblock Right Click
  window.addEventListener("contextmenu", (e) => {
    if (!unblockState.contextmenu) return;

    // Stop the website's blocking handler from canceling the context menu
    e.stopImmediatePropagation();
  }, true); // CAPTURE

  // Unblock Clipboard (Copy / Cut / Paste)
  ["copy", "cut", "paste"].forEach((evtType) => {
    window.addEventListener(evtType, (e) => {
      if (!unblockState.copypaste) return;
      e.stopImmediatePropagation();
    }, true);
  });

  // Also prevent website onkeydown from canceling Ctrl+C / Ctrl+V / Ctrl+A
  window.addEventListener("keydown", (e) => {
    if (!unblockState.copypaste) return;

    if (e.ctrlKey || e.metaKey) {
      const k = (e.key || "").toLowerCase();
      if (["c", "v", "x", "a"].includes(k)) {
        e.stopImmediatePropagation();
      }
    }
  }, true);

  // Unblock Selection
  window.addEventListener("selectstart", (e) => {
    if (!unblockState.selection) return;
    e.stopImmediatePropagation();
  }, true);

  // Unblock Drag
  window.addEventListener("dragstart", (e) => {
    if (!unblockState.drag) return;
    e.stopImmediatePropagation();
  }, true);

  // Apply CSS overrides when selection is unblocked
  function applySelectionCSS(enable) {
    let el = document.getElementById("__ht_unblock_selection_style__");
    if (enable) {
      if (!el) {
        el = document.createElement("style");
        el.id = "__ht_unblock_selection_style__";
        el.textContent = `
          * {
            -webkit-user-select: auto !important;
            -moz-user-select: auto !important;
            -ms-user-select: auto !important;
            user-select: auto !important;
          }
        `;
        (document.head || document.documentElement).appendChild(el);
      }
    } else {
      if (el) el.remove();
    }
  }

  // Apply property cleaning when context menu is unblocked
  function applyContextMenuClean(enable) {
    if (enable) {
      try {
        window.oncontextmenu = null;
        document.oncontextmenu = null;
        if (document.body) document.body.oncontextmenu = null;
      } catch (e) {}
    }
  }

  function applyF12Clean(enable) {
    if (enable) {
      try {
        // If document.onkeydown is intercepting 123/17, replace with safe pass-through
        if (document.onkeydown) {
          const original = document.onkeydown;
          document.onkeydown = function (e) {
            if (e && (e.which === 123 || e.keyCode === 123 || e.which === 17)) return true;
            return original.apply(this, arguments);
          };
        }
      } catch (e) {}
    }
  }

  // Notify Content Script of detected restrictions
  function notifyDetection() {
    window.postMessage({
      type: "HT_RESTRICTIONS_UPDATE",
      restrictions: detectedRestrictions
    }, "*");
  }

  // Listen for unblock toggle commands from content script
  window.addEventListener("message", (e) => {
    if (!e.data || e.data.type !== "HT_SET_UNBLOCK_STATE") return;

    const { key, unblock } = e.data;
    if (key === "all") {
      Object.keys(unblockState).forEach((k) => {
        unblockState[k] = unblock;
        if (detectedRestrictions[k]) {
          detectedRestrictions[k].unblocked = unblock;
        }
      });
      applySelectionCSS(unblock);
      applyContextMenuClean(unblock);
      applyF12Clean(unblock);
    } else if (unblockState[key] !== undefined) {
      unblockState[key] = unblock;
      if (detectedRestrictions[key]) {
        detectedRestrictions[key].unblocked = unblock;
      }
      if (key === "selection") applySelectionCSS(unblock);
      if (key === "contextmenu") applyContextMenuClean(unblock);
      if (key === "f12") applyF12Clean(unblock);
    }

    notifyDetection();
  });

  // Run scans at multiple lifecycles
  scanPropertyBlockers();
  document.addEventListener("DOMContentLoaded", scanPropertyBlockers);
  window.addEventListener("load", scanPropertyBlockers);
  setInterval(scanPropertyBlockers, 1500); // Periodic check for late-loading scripts
})();
