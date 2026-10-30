// offscreen.js - Runs in extension context with unrestricted clipboard access

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "OFFSCREEN_READ_CLIPBOARD") {
    (async () => {
      let text = "";
      try {
        text = await navigator.clipboard.readText();
      } catch (err) {
        // Fallback: execCommand paste
        try {
          const buffer = document.getElementById("offscreen-buffer");
          buffer.value = "";
          buffer.focus();
          buffer.select();
          document.execCommand("paste");
          text = buffer.value;
        } catch (e) {
          text = "";
        }
      }
      sendResponse({ text });
    })();
    return true; // Keep message channel open for async response
  }
});
