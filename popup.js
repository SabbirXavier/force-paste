// popup.js - Manages Restriction Inspector and Typer Settings

document.addEventListener("DOMContentLoaded", async () => {
  // Tabs navigation
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");
    });
  });

  // Typer Controls
  const toggleTyperEnabled = document.getElementById("toggle-typer-enabled");
  const toggleFloatingIcon = document.getElementById("toggle-floating-icon");
  const toggleJitter = document.getElementById("toggle-jitter");
  const selectSpeed = document.getElementById("select-speed");
  const customWpmBox = document.getElementById("custom-wpm-box");
  const rangeWpm = document.getElementById("range-wpm");
  const numWpm = document.getElementById("num-wpm");
  const wpmStats = document.getElementById("wpm-stats");
  const testField = document.getElementById("test-field");

  // Shield Controls
  const btnUnblockAll = document.getElementById("btn-unblock-all");
  const summaryText = document.getElementById("summary-text");
  const overallDot = document.getElementById("overall-dot");
  const overallText = document.getElementById("overall-text");

  const restrictionKeys = ["f12", "contextmenu", "copypaste", "selection", "drag"];
  const toggles = {};
  const dots = {};
  const descs = {};

  restrictionKeys.forEach((key) => {
    toggles[key] = document.getElementById(`toggle-${key}`);
    dots[key] = document.getElementById(`dot-${key}`);
    descs[key] = document.getElementById(`desc-${key}`);
  });

  // Load Settings from Storage
  const settings = await chrome.storage.local.get([
    "enabled",
    "showFloatingIcon",
    "naturalJitter",
    "speedMode",
    "customWPM"
  ]);

  toggleTyperEnabled.checked = settings.enabled ?? true;
  toggleFloatingIcon.checked = settings.showFloatingIcon ?? true;
  toggleJitter.checked = settings.naturalJitter ?? true;
  selectSpeed.value = settings.speedMode || "custom";

  let currentWPM = Number(settings.customWPM) || 60;
  if (currentWPM < 10) currentWPM = 10;
  if (currentWPM > 600) currentWPM = 600;

  function updateWpmDisplay(wpm) {
    const delay = Math.round(12000 / wpm);
    wpmStats.textContent = `${wpm} WPM (~${delay}ms/char)`;
    rangeWpm.value = Math.min(300, Math.max(15, wpm));
    numWpm.value = wpm;
  }

  function handleSpeedModeChange() {
    if (selectSpeed.value === "custom") {
      customWpmBox.style.display = "block";
    } else {
      // Keep visible or dim if not custom
      customWpmBox.style.display = "block";
    }
  }

  updateWpmDisplay(currentWPM);
  handleSpeedModeChange();

  // Typer change listeners
  toggleTyperEnabled.addEventListener("change", () => {
    chrome.storage.local.set({ enabled: toggleTyperEnabled.checked });
  });

  toggleFloatingIcon.addEventListener("change", () => {
    chrome.storage.local.set({ showFloatingIcon: toggleFloatingIcon.checked });
  });

  toggleJitter.addEventListener("change", () => {
    chrome.storage.local.set({ naturalJitter: toggleJitter.checked });
  });

  selectSpeed.addEventListener("change", () => {
    chrome.storage.local.set({ speedMode: selectSpeed.value });
    handleSpeedModeChange();
  });

  // Sync WPM Range Slider
  rangeWpm.addEventListener("input", () => {
    const val = parseInt(rangeWpm.value, 10);
    updateWpmDisplay(val);
    chrome.storage.local.set({ customWPM: val });
  });

  // Sync WPM Number Input
  numWpm.addEventListener("input", () => {
    let val = parseInt(numWpm.value, 10);
    if (!isNaN(val) && val >= 10 && val <= 600) {
      updateWpmDisplay(val);
      chrome.storage.local.set({ customWPM: val });
    }
  });

  numWpm.addEventListener("blur", () => {
    let val = parseInt(numWpm.value, 10);
    if (isNaN(val) || val < 10) val = 10;
    if (val > 600) val = 600;
    updateWpmDisplay(val);
    chrome.storage.local.set({ customWPM: val });
  });

  // Playground simulation inside popup
  testField.addEventListener("keydown", async (e) => {
    if (e.altKey && (e.key === "v" || e.key === "V")) {
      e.preventDefault();
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return;

        testField.value = "";
        const mode = selectSpeed.value;
        const jitter = toggleJitter.checked;
        const wpm = parseInt(numWpm.value, 10) || 60;

        let baseDelay = Math.round(12000 / wpm);
        if (mode === "fast") baseDelay = 12;
        if (mode === "human") baseDelay = 220;

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          testField.value += char;

          if (mode === "instant") continue;

          let delay = baseDelay;
          if (jitter) {
            const variance = baseDelay * 0.25;
            delay += (Math.random() * variance * 2) - variance;
            if (char === " ") delay += (baseDelay * 0.2);
            if ([".", ",", "!", "?"].includes(char)) delay += (baseDelay * 0.5);
          }
          await new Promise((r) => setTimeout(r, Math.max(5, delay)));
        }
      } catch (err) {}
    }
  });

  // Query Current Tab for Restrictions
  let activeTabId = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id;
  } catch (e) {}

  async function refreshRestrictions() {
    if (!activeTabId) {
      summaryText.textContent = "Unable to inspect background tabs.";
      return;
    }

    try {
      const resp = await chrome.tabs.sendMessage(activeTabId, { type: "GET_PAGE_RESTRICTIONS" });
      const restrictions = resp?.restrictions;

      if (!restrictions) {
        summaryText.textContent = "No restrictions detected on this page (clean).";
        overallDot.className = "indicator-dot clear";
        overallText.textContent = "Clean Page";
        return;
      }

      let blockedCount = 0;
      let unblockedCount = 0;

      restrictionKeys.forEach((key) => {
        const item = restrictions[key];
        if (!item) return;

        if (item.blocked) blockedCount++;
        if (item.unblocked) unblockedCount++;

        toggles[key].checked = item.unblocked;

        if (item.unblocked) {
          dots[key].className = "indicator-dot unblocked";
          descs[key].innerHTML = `<span style="color:#059669;font-weight:600;">✓ Unblocked locally</span> (Page code silenced in capture phase)`;
        } else if (item.blocked) {
          dots[key].className = "indicator-dot blocked";
          descs[key].innerHTML = `<span style="color:#dc2626;font-weight:600;">Blocked:</span> ${item.details || "Detected active blocker"}`;
        } else {
          dots[key].className = "indicator-dot clear";
          descs[key].textContent = "No restriction detected for this action.";
        }
      });

      if (blockedCount > 0) {
        if (unblockedCount === blockedCount) {
          summaryText.textContent = `All ${blockedCount} detected restriction(s) are neutralized locally.`;
          overallDot.className = "indicator-dot unblocked";
          overallText.textContent = "Protected";
        } else {
          summaryText.textContent = `Detected ${blockedCount} active blocker(s) on this page.`;
          overallDot.className = "indicator-dot blocked";
          overallText.textContent = `${blockedCount} Blocked`;
        }
      } else {
        summaryText.textContent = "No active event restrictions detected on this page.";
        overallDot.className = "indicator-dot clear";
        overallText.textContent = "Clean Page";
      }
    } catch (err) {
      summaryText.textContent = "Navigate to a webpage to inspect active restrictions.";
    }
  }

  restrictionKeys.forEach((key) => {
    toggles[key].addEventListener("change", async () => {
      const isUnblock = toggles[key].checked;
      if (activeTabId) {
        await chrome.tabs.sendMessage(activeTabId, {
          type: "TOGGLE_UNBLOCK",
          key: key,
          unblock: isUnblock
        });
        setTimeout(refreshRestrictions, 100);
      }
    });
  });

  btnUnblockAll.addEventListener("click", async () => {
    if (activeTabId) {
      await chrome.tabs.sendMessage(activeTabId, {
        type: "TOGGLE_UNBLOCK",
        key: "all",
        unblock: true
      });
      setTimeout(refreshRestrictions, 100);
    }
  });

  refreshRestrictions();
});
