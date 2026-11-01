// page-probe.js - Runs in MAIN execution world to detect and safely neutralize event blockers,
// spoof visibility/focus (Always Active Tab), and force-enable selection and copying.
(() => {
  if (window.__FORCEPASTE_PROBE_INITIALIZED__) return;
  window.__FORCEPASTE_PROBE_INITIALIZED__ = true;

  // Active unblock & feature states
  const featureState = {
    f12: false,
    contextmenu: false,
    copypaste: false,
    selection: false,
    drag: false,
    alwaysActive: false
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
    },
    alwaysActive: {
      id: "alwaysActive",
      name: "Always Active Tab (Visibility Spoof)",
      blocked: false,
      details: "Spoofs document.visibilityState, hidden, hasFocus & blocks blur/visibilitychange",
      unblocked: false
    }
  };

  // 1. Hook EventTarget.prototype.addEventListener to monitor what the page attaches
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
          detectedRestrictions.f12.details = "Page registered keydown listener checking F12 (123) or Ctrl modifiers";
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

      if (type === "visibilitychange" || type === "webkitvisibilitychange" || type === "mozvisibilitychange" || type === "blur") {
        detectedRestrictions.alwaysActive.blocked = true;
        detectedRestrictions.alwaysActive.details = `Page registered '${type}' listener to detect background tab switching`;
        notifyDetection();
      }
    } catch (e) {}

    return originalAddEventListener.apply(this, arguments);
  };

  // 2. Scan property handlers
  function scanPropertyBlockers() {
    try {
      const ctxBlocked =
        typeof window.oncontextmenu === "function" ||
        typeof document.oncontextmenu === "function" ||
        (document.body && typeof document.body.oncontextmenu === "function");

      if (ctxBlocked) {
        detectedRestrictions.contextmenu.blocked = true;
        detectedRestrictions.contextmenu.details = "Page set oncontextmenu to cancel right-clicks";
      }

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

      if (document.oncopy || window.oncopy || document.onpaste || window.onpaste) {
        detectedRestrictions.copypaste.blocked = true;
        detectedRestrictions.copypaste.details = "Page set oncopy or onpaste handlers";
      }

      if (document.onselectstart || (document.body && document.body.onselectstart)) {
        detectedRestrictions.selection.blocked = true;
        detectedRestrictions.selection.details = "Page set onselectstart handler to disable text selection";
      }

      if (document.body) {
        const bodyStyle = window.getComputedStyle(document.body);
        const htmlStyle = window.getComputedStyle(document.documentElement);
        if (
          bodyStyle.userSelect === "none" ||
          bodyStyle.webkitUserSelect === "none" ||
          htmlStyle.userSelect === "none" ||
          htmlStyle.webkitUserSelect === "none"
        ) {
          detectedRestrictions.selection.blocked = true;
          detectedRestrictions.selection.details = "Page CSS applies 'user-select: none' across elements";
        }
      }

      if (document.ondragstart || (document.body && document.body.ondragstart)) {
        detectedRestrictions.drag.blocked = true;
        detectedRestrictions.drag.details = "Page set ondragstart handler";
      }

      if (typeof window.onblur === "function" || typeof document.onvisibilitychange === "function") {
        detectedRestrictions.alwaysActive.blocked = true;
      }

      notifyDetection();
    } catch (e) {}
  }

  // 3. CAPTURE PHASE INTERCEPTION

  // F12 / DevTools
  window.addEventListener(
    "keydown",
    (e) => {
      if (!featureState.f12) return;
      const isF12 = e.key === "F12" || e.keyCode === 123 || e.which === 123;
      const isDevTools = e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes((e.key || "").toUpperCase());
      const isViewSource = e.ctrlKey && (e.key === "u" || e.key === "U");

      if (isF12 || isDevTools || isViewSource) {
        e.stopImmediatePropagation();
      }
    },
    true
  );

  // Right Click
  window.addEventListener(
    "contextmenu",
    (e) => {
      if (!featureState.contextmenu) return;
      e.stopImmediatePropagation();
    },
    true
  );

  // Copy / Cut / Paste
  ["copy", "cut", "paste"].forEach((evtType) => {
    window.addEventListener(
      evtType,
      (e) => {
        if (!featureState.copypaste) return;
        e.stopImmediatePropagation();
      },
      true
    );
  });

  window.addEventListener(
    "keydown",
    (e) => {
      if (!featureState.copypaste) return;
      if (e.ctrlKey || e.metaKey) {
        const k = (e.key || "").toLowerCase();
        if (["c", "v", "x", "a"].includes(k)) {
          e.stopImmediatePropagation();
        }
      }
    },
    true
  );

  // Selection & Drag
  window.addEventListener(
    "selectstart",
    (e) => {
      if (!featureState.selection) return;
      e.stopImmediatePropagation();
    },
    true
  );

  window.addEventListener(
    "dragstart",
    (e) => {
      if (!featureState.drag) return;
      e.stopImmediatePropagation();
    },
    true
  );

  // 4. ALWAYS ACTIVE WINDOW (VISIBILITY & FOCUS SPOOFING)
  // Overrides document.visibilityState, hidden, webkitHidden, mozHidden, hasFocus
  // and blocks visibilitychange, webkitvisibilitychange, mozvisibilitychange, blur, mouseleave

  // Store original descriptors
  const origVisibilityState = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
  const origHidden = Object.getOwnPropertyDescriptor(Document.prototype, "hidden");
  const origWebkitHidden = Object.getOwnPropertyDescriptor(Document.prototype, "webkitHidden");
  const origMozHidden = Object.getOwnPropertyDescriptor(Document.prototype, "mozHidden");
  const origHasFocus = Document.prototype.hasFocus;

  function enableAlwaysActive(enable) {
    featureState.alwaysActive = enable;
    detectedRestrictions.alwaysActive.unblocked = enable;

    if (enable) {
      try {
        // Override visibility properties on Document.prototype
        Object.defineProperty(Document.prototype, "visibilityState", {
          get: () => "visible",
          configurable: true
        });
        Object.defineProperty(Document.prototype, "hidden", {
          get: () => false,
          configurable: true
        });
        Object.defineProperty(Document.prototype, "webkitHidden", {
          get: () => false,
          configurable: true
        });
        Object.defineProperty(Document.prototype, "mozHidden", {
          get: () => false,
          configurable: true
        });
        Document.prototype.hasFocus = () => true;

        // Also define on document instance for older sites
        try {
          Object.defineProperty(document, "visibilityState", { get: () => "visible", configurable: true });
          Object.defineProperty(document, "hidden", { get: () => false, configurable: true });
          document.hasFocus = () => true;
        } catch (e) {}

        // Clear window.onblur and window.onmouseleave
        if (typeof window.onblur === "function") {
          window._savedOnBlur = window.onblur;
          window.onblur = null;
        }
      } catch (err) {}
    } else {
      // Revert to original descriptors
      try {
        if (origVisibilityState) Object.defineProperty(Document.prototype, "visibilityState", origVisibilityState);
        if (origHidden) Object.defineProperty(Document.prototype, "hidden", origHidden);
        if (origWebkitHidden) Object.defineProperty(Document.prototype, "webkitHidden", origWebkitHidden);
        if (origMozHidden) Object.defineProperty(Document.prototype, "mozHidden", origMozHidden);
        if (origHasFocus) Document.prototype.hasFocus = origHasFocus;

        if (window._savedOnBlur) {
          window.onblur = window._savedOnBlur;
        }
      } catch (err) {}
    }
  }

  // Intercept visibilitychange, blur, mouseleave events in capture phase
  const visibilityEvents = [
    "visibilitychange",
    "webkitvisibilitychange",
    "mozvisibilitychange",
    "blur",
    "mouseleave"
  ];

  visibilityEvents.forEach((evtType) => {
    window.addEventListener(
      evtType,
      (e) => {
        if (!featureState.alwaysActive) return;
        // Suppress event completely so site thinks tab is permanently active
        e.stopImmediatePropagation();
        e.preventDefault();
      },
      true // Capture phase: catches before page listeners
    );

    document.addEventListener(
      evtType,
      (e) => {
        if (!featureState.alwaysActive) return;
        e.stopImmediatePropagation();
        e.preventDefault();
      },
      true
    );
  });

  // 5. FORCE SELECT & COPY ENGINE
  function applySelectionCSS(enable) {
    let el = document.getElementById("__forcepaste_unblock_selection_style__");
    if (enable) {
      if (!el) {
        el = document.createElement("style");
        el.id = "__forcepaste_unblock_selection_style__";
        el.textContent = `
          *, *::before, *::after {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            user-select: text !important;
            -webkit-touch-callout: default !important;
            pointer-events: auto !important;
          }
          ::selection {
            background-color: #3b82f6 !important;
            color: #ffffff !important;
          }
        `;
        (document.head || document.documentElement).appendChild(el);
      }

      // Nullify inline blockers
      try {
        document.onselectstart = null;
        if (document.body) {
          document.body.onselectstart = null;
          document.body.style.userSelect = "text";
        }
      } catch (e) {}
    } else {
      if (el) el.remove();
    }
  }

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

  function notifyDetection() {
    window.postMessage(
      {
        type: "HT_RESTRICTIONS_UPDATE",
        restrictions: detectedRestrictions,
        featureState: featureState
      },
      "*"
    );
  }

  // Listen for control messages from content script
  window.addEventListener("message", (e) => {
    if (!e.data || e.data.type !== "HT_SET_UNBLOCK_STATE") return;

    const { key, unblock } = e.data;
    if (key === "all") {
      Object.keys(featureState).forEach((k) => {
        featureState[k] = unblock;
        if (detectedRestrictions[k]) {
          detectedRestrictions[k].unblocked = unblock;
        }
      });
      applySelectionCSS(unblock);
      applyContextMenuClean(unblock);
      applyF12Clean(unblock);
      enableAlwaysActive(unblock);
    } else if (key === "alwaysActive") {
      enableAlwaysActive(unblock);
    } else if (featureState[key] !== undefined) {
      featureState[key] = unblock;
      if (detectedRestrictions[key]) {
        detectedRestrictions[key].unblocked = unblock;
      }
      if (key === "selection") applySelectionCSS(unblock);
      if (key === "contextmenu") applyContextMenuClean(unblock);
      if (key === "f12") applyF12Clean(unblock);
    }

    notifyDetection();
  });

  scanPropertyBlockers();
  document.addEventListener("DOMContentLoaded", scanPropertyBlockers);
  window.addEventListener("load", scanPropertyBlockers);
  setInterval(scanPropertyBlockers, 1500);
})();
