// Service Worker for ForcePaste & Shield
// Cross-browser compatibility for Chrome, Firefox, Brave, Edge, Opera, Vivaldi, Arc

chrome.runtime.onInstalled.addListener(async () => {
  const currentSettings = await chrome.storage.local.get([
    "enabled",
    "speedMode",
    "customWPM",
    "baseDelay",
    "showFloatingIcon",
    "naturalJitter",
    "alwaysActive",
    "forceSelect",
    "ghostMode",
    "vocabHelper",
    "stagedText",
    "lastStagedText"
  ]);

  const defaultSettings = {
    enabled: true,
    speedMode: "custom", // 'custom', 'human', 'fast', 'instant'
    customWPM: 60,
    baseDelay: 25, // ms
    showFloatingIcon: true,
    naturalJitter: true,
    alwaysActive: false,
    forceSelect: false,
    ghostMode: false,
    vocabHelper: true,
    stagedText: "",
    lastStagedText: ""
  };

  const toSet = {};
  for (const [key, value] of Object.entries(defaultSettings)) {
    if (currentSettings[key] === undefined) {
      toSet[key] = value;
    }
  }

  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }

  // Create context menus for vocabulary lookup and forced text copying
  if (chrome.contextMenus) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "forcepaste_define",
        title: "ForcePaste: Define & Synonyms for '%s'",
        contexts: ["selection"]
      });
      chrome.contextMenus.create({
        id: "forcepaste_copy_element",
        title: "ForcePaste: Extract & Copy Clean Text (Alt+C)",
        contexts: ["all"]
      });
    });
  }
});

// Handle Context Menu click
if (chrome.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "forcepaste_define" && tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: "SHOW_DEFINITION",
          word: (info.selectionText || "").trim()
        });
      } catch (err) {
        console.warn("Could not send definition command to tab:", err);
      }
    } else if (info.menuItemId === "forcepaste_copy_element" && tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: "EXTRACT_ELEMENT_TEXT"
        });
      } catch (err) {
        console.warn("Could not send extract command to tab:", err);
      }
    }
  });
}

// Ensure offscreen document exists for Chromium browsers
async function ensureOffscreenDocument() {
  if (typeof chrome === "undefined" || !chrome.offscreen) return;

  if (chrome.offscreen?.hasDocument) {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (hasDoc) return;
  } else if (chrome.runtime?.getContexts) {
    try {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"]
      });
      if (contexts && contexts.length > 0) return;
    } catch (e) {}
  }

  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.CLIPBOARD],
      justification: "Read clipboard text directly for automated typing"
    });
  } catch (err) {}
}

// Handle clipboard reading request from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "READ_CLIPBOARD_BG") {
    (async () => {
      try {
        if (typeof chrome !== "undefined" && chrome.offscreen && chrome.offscreen.createDocument) {
          await ensureOffscreenDocument();
          const resp = await chrome.runtime.sendMessage({
            type: "OFFSCREEN_READ_CLIPBOARD"
          });
          sendResponse({ text: resp?.text || "" });
        } else {
          // Firefox / non-offscreen browsers: content script reads navigator.clipboard directly
          sendResponse({ text: "" });
        }
      } catch (err) {
        sendResponse({ text: "" });
      }
    })();
    return true; // Keep channel open
  }
});

// Handle Keyboard shortcut commands (Alt+V and Alt+H)
if (chrome.commands?.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === "human_paste") {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_PASTE" });
        }
      } catch (err) {
        console.warn("Could not send command to active tab:", err);
      }
    } else if (command === "force_copy") {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_ELEMENT_TEXT" });
        }
      } catch (err) {
        console.warn("Could not send extract command to active tab:", err);
      }
    } else if (command === "toggle_ghost_mode") {
      try {
        const { ghostMode } = await chrome.storage.local.get(["ghostMode"]);
        const newMode = !ghostMode;
        await chrome.storage.local.set({ ghostMode: newMode });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_GHOST_MODE", ghostMode: newMode });
        }
      } catch (err) {
        console.warn("Could not toggle ghost mode command:", err);
      }
    }
  });
}
