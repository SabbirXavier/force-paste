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

  // =========================================================================
  // UNIVERSAL SELECTION & ANTI-COPY NEUTRALIZERS (MAIN WORLD)
  // =========================================================================

  // 1. Hook Selection.prototype.removeAllRanges & empty
  // Stops anti-copy scripts from programmatically wiping user's text selection
  const origRemoveAllRanges = Selection.prototype.removeAllRanges;
  const origEmpty = Selection.prototype.empty;

  Selection.prototype.removeAllRanges = function () {
    if (featureState.selection) {
      if (this.rangeCount > 0 && !this.isCollapsed) {
        const text = this.toString();
        if (text && text.trim().length > 0) {
          return; // Protect active user selection from script wipe!
        }
      }
    }
    try {
      return origRemoveAllRanges.apply(this, arguments);
    } catch (e) {
      return undefined;
    }
  };

  if (origEmpty) {
    Selection.prototype.empty = function () {
      if (featureState.selection) {
        if (this.rangeCount > 0 && !this.isCollapsed) {
          const text = this.toString();
          if (text && text.trim().length > 0) {
            return;
          }
        }
      }
      try {
        return origEmpty.apply(this, arguments);
      } catch (e) {
        return undefined;
      }
    };
  }

  // 2. Hook Event.prototype.preventDefault
  // Stops page scripts from cancelling selectstart, copy, cut, or drag selection on mousedown
  const origPreventDefault = Event.prototype.preventDefault;
  Event.prototype.preventDefault = function () {
    if (featureState.selection) {
      if (this.type === "selectstart" || this.type === "copy" || this.type === "cut" || this.type === "dragstart") {
        return; // Never allow website to cancel text selection or copy!
      }
      if (this.type === "mousedown" && this.button === 0) {
        const t = this.target;
        const isFormInteractive = t && t.closest && t.closest("input, textarea, select, button");
        if (!isFormInteractive) {
          return; // Allow text selection initiation
        }
      }
    }
    try {
      return origPreventDefault.apply(this, arguments);
    } catch (e) {
      return undefined;
    }
  };

  // 3. Property descriptor protections for event blockers
  function protectEventProperty(obj, prop) {
    if (!obj) return;
    try {
      let internalVal = null;
      Object.defineProperty(obj, prop, {
        get: () => (featureState.selection ? null : internalVal),
        set: (val) => {
          if (featureState.selection && typeof val === "function") {
            const s = val.toString();
            if (s.includes("false") || s.includes("preventDefault") || s.includes("empty") || s.includes("removeAllRanges")) {
              internalVal = null;
              return;
            }
          }
          internalVal = val;
        },
        configurable: true
      });
    } catch (e) {}
  }

  protectEventProperty(Document.prototype, "onselectstart");
  protectEventProperty(Document.prototype, "oncopy");
  protectEventProperty(Document.prototype, "oncut");
  protectEventProperty(Document.prototype, "onmousedown");
  protectEventProperty(Window.prototype, "onselectstart");
  protectEventProperty(Window.prototype, "oncopy");
  if (typeof HTMLElement !== "undefined" && HTMLElement.prototype) {
    protectEventProperty(HTMLElement.prototype, "onselectstart");
    protectEventProperty(HTMLElement.prototype, "oncopy");
    protectEventProperty(HTMLElement.prototype, "oncut");
    protectEventProperty(HTMLElement.prototype, "onmousedown");
    protectEventProperty(HTMLElement.prototype, "oncontextmenu");
  }

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
    // 0. Guard against Permissions Policy violation for deprecated 'unload' event
    if (type === "unload") {
      try {
        if (document.permissionsPolicy && typeof document.permissionsPolicy.allowsFeature === "function") {
          if (!document.permissionsPolicy.allowsFeature("unload")) {
            return;
          }
        } else {
          return;
        }
      } catch (e) {
        return;
      }
    }

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

    try {
      return originalAddEventListener.apply(this, arguments);
    } catch (err) {
      try {
        return originalAddEventListener.call(this, type, listener, options);
      } catch (err2) {
        return undefined;
      }
    }
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

  // Copy / Cut / Paste capture phase
  ["copy", "cut", "paste"].forEach((evtType) => {
    window.addEventListener(
      evtType,
      (e) => {
        if (!featureState.copypaste && !featureState.selection) return;
        e.stopImmediatePropagation();
      },
      true
    );
    document.addEventListener(
      evtType,
      (e) => {
        if (!featureState.copypaste && !featureState.selection) return;
        e.stopImmediatePropagation();
      },
      true
    );
  });

  window.addEventListener(
    "keydown",
    (e) => {
      if (!featureState.copypaste && !featureState.selection) return;
      if (e.ctrlKey || e.metaKey) {
        const k = (e.key || "").toLowerCase();
        if (["c", "v", "x", "a"].includes(k)) {
          e.stopImmediatePropagation();
        }
      }
    },
    true
  );

  // Selection & Drag Capture Phase
  ["selectstart"].forEach((evtType) => {
    window.addEventListener(
      evtType,
      (e) => {
        if (!featureState.selection) return;
        e.stopImmediatePropagation();
      },
      true
    );
    document.addEventListener(
      evtType,
      (e) => {
        if (!featureState.selection) return;
        e.stopImmediatePropagation();
      },
      true
    );
  });

  // Stop page listeners on selectionchange from wiping user's text selection
  document.addEventListener(
    "selectionchange",
    (e) => {
      if (!featureState.selection) return;
      e.stopImmediatePropagation();
    },
    true
  );

  window.addEventListener(
    "dragstart",
    (e) => {
      if (!featureState.drag && !featureState.selection) return;
      e.stopImmediatePropagation();
    },
    true
  );

  // Dynamic Transparent Overlay Puncturing & Mousedown Protection
  window.addEventListener(
    "mousedown",
    (e) => {
      if (!featureState.selection) return;

      const target = e.target;
      if (target && target !== document.body && target !== document.documentElement) {
        // If element is empty or purely transparent overlay, puncture it!
        const text = (target.innerText || target.textContent || "").trim();
        if (text.length === 0 && target.children.length === 0) {
          const style = window.getComputedStyle(target);
          if (style.position === "absolute" || style.position === "fixed") {
            target.style.setProperty("pointer-events", "none", "important");
          }
        }
      }
    },
    true
  );

  // 4. SCREEN / WINDOW / TAB CAPTURE INTERCEPTOR (getDisplayMedia Hook)
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function") {
    const origGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia = async function (constraints) {
      // Hide all in-tab extension badges before screen, window, or tab capture stream starts
      const hostEl = document.getElementById("__forcepaste_host__");
      if (hostEl) {
        hostEl.style.setProperty("display", "none", "important");
      }

      try {
        const stream = await origGetDisplayMedia(constraints);
        const track = stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
        if (track) {
          track.addEventListener("ended", () => {
            if (hostEl && !featureState.ghostMode) {
              hostEl.style.removeProperty("display");
            }
          });
        }
        return stream;
      } catch (err) {
        if (hostEl && !featureState.ghostMode) {
          hostEl.style.removeProperty("display");
        }
        throw err;
      }
    };
  }

  // 5. ALWAYS ACTIVE WINDOW (VISIBILITY & FOCUS SPOOFING)
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
  let selectionObserver = null;
  let stealthSelectionMode = "standard"; // "standard" (normal), "invisible" (screen share proof), or "subtle"

  function scrubElementProtections(root = document) {
    if (!featureState.selection) return;
    try {
      const selector = '[unselectable], [onselectstart], [onmousedown], [oncopy], [oncut], [style*="user-select"]';
      const elements = root.querySelectorAll ? root.querySelectorAll(selector) : [];
      elements.forEach((el) => {
        el.removeAttribute("unselectable");
        el.removeAttribute("onselectstart");
        el.removeAttribute("oncopy");
        el.removeAttribute("oncut");
        if (el.style) {
          if (el.style.userSelect === "none" || el.style.webkitUserSelect === "none") {
            el.style.removeProperty("user-select");
            el.style.removeProperty("-webkit-user-select");
          }
        }
      });
    } catch (e) {}
  }

  function startSelectionObserver() {
    if (selectionObserver || !window.MutationObserver) return;
    try {
      selectionObserver = new MutationObserver((mutations) => {
        if (!featureState.selection) return;
        for (const m of mutations) {
          if (m.type === "childList") {
            m.addedNodes.forEach((node) => {
              if (node.nodeType === 1) scrubElementProtections(node);
            });
          } else if (m.type === "attributes") {
            if (["unselectable", "onselectstart", "oncopy", "style"].includes(m.attributeName)) {
              scrubElementProtections(m.target);
            }
          }
        }
      });
      if (document.body) {
        selectionObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["unselectable", "onselectstart", "oncopy", "style"]
        });
      }
    } catch (e) {}
  }

  function applySelectionCSS(enable, mode) {
    if (mode) stealthSelectionMode = mode;
    let el = document.getElementById("__forcepaste_unblock_selection_style__");
    if (enable) {
      let selectionCSS = "";
      if (stealthSelectionMode === "invisible") {
        // 100% Invisible Selection Highlight: Completely hides blue boxes from screen share, OBS, Zoom, Teams, and recordings
        selectionCSS = `
          ::selection {
            background-color: transparent !important;
            color: inherit !important;
            text-shadow: none !important;
          }
          ::-moz-selection {
            background-color: transparent !important;
            color: inherit !important;
            text-shadow: none !important;
          }
        `;
      } else if (stealthSelectionMode === "subtle") {
        // Subtle Ghost Tint: Faint 10% opacity, visible to human eye close to screen, compressed away on video streams
        selectionCSS = `
          ::selection {
            background-color: rgba(59, 130, 246, 0.12) !important;
            color: inherit !important;
            text-shadow: none !important;
          }
          ::-moz-selection {
            background-color: rgba(59, 130, 246, 0.12) !important;
            color: inherit !important;
            text-shadow: none !important;
          }
        `;
      } else {
        // Standard High-Contrast Blue
        selectionCSS = `
          ::selection {
            background-color: #3b82f6 !important;
            color: #ffffff !important;
            text-shadow: none !important;
          }
          ::-moz-selection {
            background-color: #3b82f6 !important;
            color: #ffffff !important;
            text-shadow: none !important;
          }
        `;
      }

      const fullCSS = `
        /* Category 1: Universal CSS text selection enablement */
        html, body, *, *::before, *::after {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
          user-select: text !important;
          -webkit-touch-callout: default !important;
        }

        ${selectionCSS}

        /* Category 2: Neutralize transparent full-screen overlay blockers without breaking interactive controls */
        [class*="overlay"]:not(button):not(input):not(label):not(a):not(select):not(textarea),
        [class*="shield"]:not(button):not(input):not(label):not(a):not(select):not(textarea),
        [class*="protect"]:not(button):not(input):not(label):not(a):not(select):not(textarea),
        [class*="watermark"]:not(button):not(input):not(label):not(a):not(select):not(textarea),
        [class*="anti-copy"], [id*="anti-copy"],
        [id*="overlay"]:not(button):not(input):not(label):not(a):not(select):not(textarea),
        [id*="shield"]:not(button):not(input):not(label):not(a):not(select):not(textarea) {
          pointer-events: none !important;
        }

        /* Category 3: Document and Canvas text layers (PDF.js, Scribd, Google Docs, Kindle) */
        .textLayer, [class*="textLayer"], [class*="TextLayer"],
        .textLayer *, [class*="textLayer"] *, [class*="TextLayer"] * {
          opacity: 0.9 !important;
          pointer-events: auto !important;
          -webkit-user-select: text !important;
          user-select: text !important;
        }

        /* Category 4: SVG Typography vector text selection */
        svg text, svg tspan, svg textPath {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          user-select: text !important;
          pointer-events: auto !important;
          cursor: text !important;
        }
      `;

      if (!el) {
        el = document.createElement("style");
        el.id = "__forcepaste_unblock_selection_style__";
        el.textContent = fullCSS;
        (document.head || document.documentElement).appendChild(el);
      } else {
        el.textContent = fullCSS;
      }

      // Nullify inline blockers
      try {
        document.onselectstart = null;
        if (document.body) {
          document.body.onselectstart = null;
          document.body.style.userSelect = "text";
        }
      } catch (e) {}

      scrubElementProtections(document);
      startSelectionObserver();
    } else {
      if (el) el.remove();
      if (selectionObserver) {
        selectionObserver.disconnect();
        selectionObserver = null;
      }
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

  let f12CleanInstalled = false;
  function applyF12Clean(enable) {
    if (enable && !f12CleanInstalled) {
      f12CleanInstalled = true;
      window.addEventListener(
        "keydown",
        (e) => {
          if (!featureState.f12) return;
          const isF12 = e.which === 123 || e.keyCode === 123 || e.key === "F12";
          const isDevToolsCombo =
            (e.ctrlKey || e.metaKey) &&
            e.shiftKey &&
            (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67 || e.key === "I" || e.key === "J" || e.key === "C");
          if (isF12 || isDevToolsCombo) {
            e.stopImmediatePropagation();
          }
        },
        true
      );
    }
  }

  let notifyTimer = null;
  let lastNotifiedJSON = "";
  function notifyDetection() {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      try {
        const payload = JSON.stringify({
          r: detectedRestrictions,
          f: featureState
        });
        if (payload === lastNotifiedJSON) return; // Prevent infinite message loop
        lastNotifiedJSON = payload;

        window.postMessage(
          {
            type: "HT_RESTRICTIONS_UPDATE",
            restrictions: detectedRestrictions,
            featureState: featureState
          },
          "*"
        );
      } catch (e) {}
    }, 200);
  }

  // Listen for control messages from content script
  window.addEventListener("message", (e) => {
    if (!e.data || (e.data.type !== "HT_SET_UNBLOCK_STATE" && e.data.type !== "HT_SET_STEALTH_SELECTION")) return;

    if (e.data.type === "HT_SET_STEALTH_SELECTION") {
      stealthSelectionMode = e.data.mode || "standard";
      if (stealthSelectionMode === "invisible" || stealthSelectionMode === "subtle" || featureState.selection) {
        applySelectionCSS(true, stealthSelectionMode);
      } else {
        applySelectionCSS(false, stealthSelectionMode);
      }
      return;
    }

    const { key, unblock, stealthSelectionMode: incomingMode } = e.data;
    if (incomingMode) {
      stealthSelectionMode = incomingMode;
    }

    const isStealthActive = stealthSelectionMode === "invisible" || stealthSelectionMode === "subtle";

    if (key === "all") {
      Object.keys(featureState).forEach((k) => {
        featureState[k] = unblock;
        if (detectedRestrictions[k]) {
          detectedRestrictions[k].unblocked = unblock;
        }
      });
      applySelectionCSS(unblock || isStealthActive, stealthSelectionMode);
      applyContextMenuClean(unblock);
      applyF12Clean(unblock);
      enableAlwaysActive(unblock);
    } else if (key === "alwaysActive") {
      enableAlwaysActive(unblock);
    } else if (key === "selection") {
      featureState.selection = unblock;
      featureState.copypaste = unblock;
      if (detectedRestrictions.selection) detectedRestrictions.selection.unblocked = unblock;
      if (detectedRestrictions.copypaste) detectedRestrictions.copypaste.unblocked = unblock;
      applySelectionCSS(unblock || isStealthActive, stealthSelectionMode);
      if (unblock) applyContextMenuClean(true);
    } else if (featureState[key] !== undefined) {
      featureState[key] = unblock;
      if (detectedRestrictions[key]) {
        detectedRestrictions[key].unblocked = unblock;
      }
      if (key === "selection") applySelectionCSS(unblock || isStealthActive, stealthSelectionMode);
      if (key === "contextmenu") applyContextMenuClean(unblock);
      if (key === "f12") applyF12Clean(unblock);
      if (key === "copypaste") applySelectionCSS(unblock || isStealthActive, stealthSelectionMode);
    }

    // Do NOT call notifyDetection() synchronously here:
    // Calling notifyDetection() here creates an immediate ping-pong loop with content script autoUnblock!
  });

  scanPropertyBlockers();
  document.addEventListener("DOMContentLoaded", scanPropertyBlockers);
  window.addEventListener("load", scanPropertyBlockers);
  setInterval(scanPropertyBlockers, 1500);
})();
