// Service Worker for HumanTyper & Shield

chrome.runtime.onInstalled.addListener(async () => {
  const currentSettings = await chrome.storage.local.get([
    "enabled",
    "speedMode",
    "customWPM",
    "baseDelay",
    "showFloatingIcon",
    "naturalJitter"
  ]);

  const defaultSettings = {
    enabled: true,
    speedMode: "custom", // 'custom', 'human', 'fast', 'instant'
    customWPM: 60,
    baseDelay: 25, // ms
    showFloatingIcon: true,
    naturalJitter: true
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
});

// Ensure offscreen document exists for unrestricted clipboard access
async function ensureOffscreenDocument() {
  if (chrome.offscreen?.hasDocument) {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (hasDoc) return;
  } else if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"]
    });
    if (contexts && contexts.length > 0) return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.CLIPBOARD],
      justification: "Read clipboard text directly for automated typing"
    });
  } catch (err) {
    // If it already exists or error, continue
  }
}

// Handle clipboard reading request from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "READ_CLIPBOARD_BG") {
    (async () => {
      try {
        await ensureOffscreenDocument();
        const resp = await chrome.runtime.sendMessage({
          type: "OFFSCREEN_READ_CLIPBOARD"
        });
        sendResponse({ text: resp?.text || "" });
      } catch (err) {
        sendResponse({ text: "" });
      }
    })();
    return true; // Keep channel open
  }
});

// Handle Alt+V keyboard shortcut command
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
