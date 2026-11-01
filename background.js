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
    "vocabHelper",
    "stagedText"
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
    vocabHelper: true,
    stagedText: ""
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

  // Create context menu for vocabulary lookup
  if (chrome.contextMenus) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "forcepaste_define",
        title: "ForcePaste: Define & Synonyms for '%s'",
        contexts: ["selection"]
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

// Handle Alt+V keyboard shortcut command
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
    }
  });
}
