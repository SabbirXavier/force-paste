// popup.js - Manages Shield, Typer, Text Staging, and Multi-Language Vocabulary Helper

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

  // Feature Toggles
  const headerAlwaysActive = document.getElementById("header-always-active");
  const descAlwaysActive = document.getElementById("desc-always-active");
  const toggleAlwaysActiveCurrent = document.getElementById("toggle-always-active-current");
  const alwaysActiveCountBadge = document.getElementById("always-active-count-badge");
  const chevronAlwaysActive = document.getElementById("chevron-always-active");
  const drawerAlwaysActive = document.getElementById("drawer-always-active");
  const tabDrawerTotalCount = document.getElementById("tab-drawer-total-count");
  const tabListContainer = document.getElementById("tab-list-container");
  const btnTabsEnableAll = document.getElementById("btn-tabs-enable-all");
  const btnTabsDisableAll = document.getElementById("btn-tabs-disable-all");
  const btnTabsRefresh = document.getElementById("btn-tabs-refresh");

  const toggleForceSelect = document.getElementById("toggle-force-select");
  const toggleGhostMode = document.getElementById("toggle-ghost-mode");
  const toggleVocabHelper = document.getElementById("toggle-vocab-helper");

  // Query Current Tab early
  let activeTabId = null;
  let activeTabUrl = "";
  let currentWindowId = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id || null;
    activeTabUrl = tab?.url || "";
    currentWindowId = tab?.windowId || null;
  } catch (e) {}

  // Safe messaging helper to prevent "Receiving end does not exist" crashes
  function isRestrictedUrl(url) {
    if (!url) return true;
    return (
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:") ||
      url.startsWith("view-source:") ||
      url.includes("chromewebstore.google.com") ||
      url.includes("chrome.google.com/webstore") ||
      url.includes("addons.mozilla.org")
    );
  }

  async function safeSendMessage(message) {
    if (!activeTabId) return null;
    if (activeTabUrl && isRestrictedUrl(activeTabUrl)) return null;
    try {
      return await chrome.tabs.sendMessage(activeTabId, message);
    } catch (err) {
      // Gracefully suppress when content scripts aren't running or tab is uninitialized
      return null;
    }
  }

  // Typer Controls
  const toggleTyperEnabled = document.getElementById("toggle-typer-enabled");
  const toggleFloatingIcon = document.getElementById("toggle-floating-icon");
  const toggleJitter = document.getElementById("toggle-jitter");
  const selectSpeed = document.getElementById("select-speed");
  const rangeWpm = document.getElementById("range-wpm");
  const numWpm = document.getElementById("num-wpm");
  const wpmStats = document.getElementById("wpm-stats");
  const testField = document.getElementById("test-field");

  // Shield Controls
  const btnUnblockAll = document.getElementById("btn-unblock-all");
  const summaryText = document.getElementById("summary-text");
  const overallDot = document.getElementById("overall-dot");
  const overallText = document.getElementById("overall-text");

  const restrictionKeys = ["f12", "contextmenu", "copypaste"];
  const toggles = {};
  const dots = {};
  const descs = {};

  restrictionKeys.forEach((key) => {
    toggles[key] = document.getElementById(`toggle-${key}`);
    dots[key] = document.getElementById(`dot-${key}`);
    descs[key] = document.getElementById(`desc-${key}`);
  });

  // Text Staging Controls
  const stagingTextarea = document.getElementById("staging-textarea");
  const stagingCounts = document.getElementById("staging-counts");
  const btnPasteToStaging = document.getElementById("btn-paste-to-staging");
  const btnClearStaging = document.getElementById("btn-clear-staging");
  const btnTypeStaged = document.getElementById("btn-type-staged");

  // Vocabulary Controls
  const vocabSearchInput = document.getElementById("vocab-search-input");
  const btnVocabSearch = document.getElementById("btn-vocab-search");
  const vocabResultBox = document.getElementById("vocab-result-box");
  const vocabWordDisplay = document.getElementById("vocab-word-display");
  const btnVocabSpeak = document.getElementById("btn-vocab-speak");
  const popupVocabLangBadge = document.getElementById("popup-vocab-lang-badge");
  const popupTabEn = document.getElementById("popup-tab-en");
  const popupTabHi = document.getElementById("popup-tab-hi");
  const popupTabBn = document.getElementById("popup-tab-bn");
  const popupPaneEn = document.getElementById("popup-pane-en");
  const popupPaneHi = document.getElementById("popup-pane-hi");
  const popupPaneBn = document.getElementById("popup-pane-bn");
  const vocabDefinitionsDisplay = document.getElementById("vocab-definitions-display");
  const vocabSynonymsDisplay = document.getElementById("vocab-synonyms-display");
  const popupHiDisplay = document.getElementById("popup-hi-display");
  const popupBnDisplay = document.getElementById("popup-bn-display");

  // Load Settings from Storage
  const settings = await chrome.storage.local.get([
    "enabled",
    "showFloatingIcon",
    "naturalJitter",
    "speedMode",
    "customWPM",
    "alwaysActiveTabIds",
    "forceSelect",
    "ghostMode",
    "vocabHelper",
    "stagedText",
    "lastStagedText"
  ]);

  toggleTyperEnabled.checked = settings.enabled ?? true;
  toggleFloatingIcon.checked = settings.showFloatingIcon ?? true;
  toggleJitter.checked = settings.naturalJitter ?? true;
  selectSpeed.value = settings.speedMode || "custom";

  toggleForceSelect.checked = settings.forceSelect ?? false;
  toggleGhostMode.checked = settings.ghostMode ?? false;
  toggleVocabHelper.checked = settings.vocabHelper ?? true;

  const initialStaged = settings.stagedText || settings.lastStagedText || "";
  if (initialStaged) {
    stagingTextarea.value = initialStaged;
    updateStagingCounts(initialStaged);
  }

  let currentWPM = Number(settings.customWPM) || 60;
  if (currentWPM < 10) currentWPM = 10;
  if (currentWPM > 600) currentWPM = 600;

  function updateWpmDisplay(wpm) {
    const delay = Math.round(12000 / wpm);
    wpmStats.textContent = `${wpm} WPM (~${delay}ms/char, randomized 50-500ms)`;
    rangeWpm.value = Math.min(300, Math.max(15, wpm));
    numWpm.value = wpm;
  }
  updateWpmDisplay(currentWPM);

  // --- Tab-Specific Always Active Logic ---
  let isAlwaysActiveDrawerOpen = false;

  function toggleAlwaysActiveDrawer(force) {
    isAlwaysActiveDrawerOpen = typeof force === "boolean" ? force : !isAlwaysActiveDrawerOpen;
    if (drawerAlwaysActive) {
      drawerAlwaysActive.style.display = isAlwaysActiveDrawerOpen ? "block" : "none";
    }
    if (chevronAlwaysActive) {
      chevronAlwaysActive.style.transform = isAlwaysActiveDrawerOpen ? "rotate(180deg)" : "rotate(0deg)";
    }
    if (isAlwaysActiveDrawerOpen) {
      renderAlwaysActiveTabs();
    }
  }

  headerAlwaysActive?.addEventListener("click", () => toggleAlwaysActiveDrawer());
  descAlwaysActive?.addEventListener("click", () => toggleAlwaysActiveDrawer());

  async function getActiveTabsAlwaysActive() {
    const res = await chrome.storage.local.get(["alwaysActiveTabIds"]);
    return Array.isArray(res.alwaysActiveTabIds) ? res.alwaysActiveTabIds : [];
  }

  async function saveActiveTabsAlwaysActive(ids) {
    await chrome.storage.local.set({ alwaysActiveTabIds: ids });
  }

  async function renderAlwaysActiveTabs() {
    if (!tabListContainer) return;

    try {
      // 1. Query all open tabs across all separated windows of current profile
      const openTabs = await chrome.tabs.query({});
      let activeIds = await getActiveTabsAlwaysActive();

      // 2. Clean up any closed / non-existent tabs from storage automatically
      const currentTabIdsSet = new Set(openTabs.map((t) => t.id));
      const cleanedIds = activeIds.filter((id) => currentTabIdsSet.has(id));
      if (cleanedIds.length !== activeIds.length) {
        activeIds = cleanedIds;
        await saveActiveTabsAlwaysActive(activeIds);
      }

      // Group tabs by windowId
      const windowMap = new Map();
      openTabs.forEach((tab) => {
        const wId = tab.windowId || 0;
        if (!windowMap.has(wId)) {
          windowMap.set(wId, []);
        }
        windowMap.get(wId).push(tab);
      });

      const totalWindows = windowMap.size;
      const totalTabs = openTabs.length;

      // 3. Update summary badges & counts
      const count = activeIds.length;
      if (alwaysActiveCountBadge) {
        if (count === 0) {
          alwaysActiveCountBadge.textContent = "Off";
          alwaysActiveCountBadge.classList.remove("active");
        } else {
          alwaysActiveCountBadge.textContent = `${count} Active`;
          alwaysActiveCountBadge.classList.add("active");
        }
      }

      if (tabDrawerTotalCount) {
        if (totalWindows > 1) {
          tabDrawerTotalCount.textContent = `(${totalTabs} in ${totalWindows} windows)`;
        } else {
          tabDrawerTotalCount.textContent = `(${totalTabs})`;
        }
      }

      // 4. Update Current Tab Quick Switch in Header
      if (toggleAlwaysActiveCurrent) {
        toggleAlwaysActiveCurrent.checked = activeTabId ? activeIds.includes(activeTabId) : false;
      }

      // 5. Build Tab Rows HTML
      tabListContainer.innerHTML = "";

      if (openTabs.length === 0) {
        tabListContainer.innerHTML = `<div style="color:#94a3b8;font-size:11px;text-align:center;padding:12px;">No open tabs detected</div>`;
        return;
      }

      // Order windows: currentWindowId first, then remaining windows
      const windowEntries = Array.from(windowMap.entries()).sort(([wA], [wB]) => {
        if (wA === currentWindowId) return -1;
        if (wB === currentWindowId) return 1;
        return wA - wB;
      });

      let windowIndex = 1;
      for (const [wId, tabsInWindow] of windowEntries) {
        const isCurrentWin = (wId === currentWindowId);
        const winTitle = isCurrentWin
          ? `Current Window (${tabsInWindow.length} tabs)`
          : `Window ${windowIndex + 1} (${tabsInWindow.length} tabs)`;
        if (!isCurrentWin) windowIndex++;

        // Add window section header when multiple windows are open
        if (totalWindows > 1) {
          const winHeader = document.createElement("div");
          winHeader.className = "tab-window-group-header";
          winHeader.innerHTML = `<span>🪟 ${winTitle}</span><span style="font-size:8.5px;color:#94a3b8;font-weight:500;">${isCurrentWin ? "This window" : "Separated window"}</span>`;
          tabListContainer.appendChild(winHeader);
        }

        // Sort tabs in this window: active current tab first, then the rest by index
        const sortedWindowTabs = [...tabsInWindow].sort((a, b) => {
          if (a.id === activeTabId) return -1;
          if (b.id === activeTabId) return 1;
          return a.index - b.index;
        });

        sortedWindowTabs.forEach((tab) => {
          const isCurrent = tab.id === activeTabId;
          const isTabActive = activeIds.includes(tab.id);

          let domain = "";
          try {
            if (tab.url) {
              const parsed = new URL(tab.url);
              domain = parsed.hostname || parsed.protocol;
            }
          } catch (e) {
            domain = "system page";
          }

          const titleText = tab.title || domain || "Untitled Tab";
          const faviconSrc = tab.favIconUrl || "icons/icon-16.png";

          const row = document.createElement("div");
          row.className = `tab-item-row${isTabActive ? " is-active" : ""}${isCurrent ? " is-current" : ""}`;
          row.title = "Click to focus this tab / window";

          const safeTitle = titleText.replace(/"/g, "&quot;");
          const safeUrl = (tab.url || "").replace(/"/g, "&quot;");

          row.innerHTML = `
            <img class="tab-item-favicon" src="${faviconSrc}" onerror="this.src='icons/icon-16.png'">
            <div class="tab-item-info">
              <div class="tab-item-title-row">
                <span class="tab-item-title" title="${safeTitle}">${safeTitle}</span>
                ${isCurrent ? `<span class="tab-badge-current">This Tab</span>` : (tab.active && totalWindows > 1 ? `<span class="tab-badge-win-active">Active</span>` : "")}
              </div>
              <div class="tab-item-url" title="${safeUrl}">${domain}</div>
            </div>
            <label class="switch-sm" title="Toggle Always Active for this tab" onclick="event.stopPropagation()">
              <input type="checkbox" class="tab-item-toggle" data-tab-id="${tab.id}" ${isTabActive ? "checked" : ""}>
              <span class="slider-sm"></span>
            </label>
          `;

          // Click on row (outside switch) brings window and tab to focus
          row.addEventListener("click", async () => {
            try {
              if (tab.windowId) {
                await chrome.windows.update(tab.windowId, { focused: true });
              }
              await chrome.tabs.update(tab.id, { active: true });
            } catch (err) {}
          });

          // Switch toggle listener for this tab
          const switchInput = row.querySelector(".tab-item-toggle");
          switchInput.addEventListener("change", async (e) => {
            e.stopPropagation();
            const isChecked = switchInput.checked;
            let currentIds = await getActiveTabsAlwaysActive();

            if (isChecked) {
              if (!currentIds.includes(tab.id)) currentIds.push(tab.id);
            } else {
              currentIds = currentIds.filter((id) => id !== tab.id);
            }

            await saveActiveTabsAlwaysActive(currentIds);

            // Notify the specific tab content script
            try {
              await chrome.tabs.sendMessage(tab.id, {
                type: "SET_TAB_ALWAYS_ACTIVE",
                enabled: isChecked
              });
            } catch (err) {}

            // Update row styling and counters
            if (isChecked) {
              row.classList.add("is-active");
            } else {
              row.classList.remove("is-active");
            }

            if (isCurrent && toggleAlwaysActiveCurrent) {
              toggleAlwaysActiveCurrent.checked = isChecked;
            }

            const newCount = currentIds.length;
            if (alwaysActiveCountBadge) {
              if (newCount === 0) {
                alwaysActiveCountBadge.textContent = "Off";
                alwaysActiveCountBadge.classList.remove("active");
              } else {
                alwaysActiveCountBadge.textContent = `${newCount} Active`;
                alwaysActiveCountBadge.classList.add("active");
              }
            }

            if (isCurrent) {
              setTimeout(refreshRestrictions, 150);
            }
          });

          tabListContainer.appendChild(row);
        });
      }
    } catch (err) {
      console.warn("Could not render always active tabs list:", err);
    }
  }

  // Toggle Current Tab Switch in Header
  toggleAlwaysActiveCurrent?.addEventListener("change", async () => {
    if (!activeTabId) return;
    const isChecked = toggleAlwaysActiveCurrent.checked;
    let currentIds = await getActiveTabsAlwaysActive();

    if (isChecked) {
      if (!currentIds.includes(activeTabId)) currentIds.push(activeTabId);
    } else {
      currentIds = currentIds.filter((id) => id !== activeTabId);
    }

    await saveActiveTabsAlwaysActive(currentIds);

    try {
      await chrome.tabs.sendMessage(activeTabId, {
        type: "SET_TAB_ALWAYS_ACTIVE",
        enabled: isChecked
      });
    } catch (err) {}

    renderAlwaysActiveTabs();
    setTimeout(refreshRestrictions, 150);
  });

  // Action Buttons
  btnTabsEnableAll?.addEventListener("click", async () => {
    try {
      const openTabs = await chrome.tabs.query({});
      const allIds = openTabs.map((t) => t.id).filter(Boolean);
      await saveActiveTabsAlwaysActive(allIds);

      for (const tab of openTabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: "SET_TAB_ALWAYS_ACTIVE",
            enabled: true
          });
        } catch (err) {}
      }

      renderAlwaysActiveTabs();
      setTimeout(refreshRestrictions, 150);
    } catch (err) {}
  });

  btnTabsDisableAll?.addEventListener("click", async () => {
    try {
      const openTabs = await chrome.tabs.query({});
      await saveActiveTabsAlwaysActive([]);

      for (const tab of openTabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: "SET_TAB_ALWAYS_ACTIVE",
            enabled: false
          });
        } catch (err) {}
      }

      renderAlwaysActiveTabs();
      setTimeout(refreshRestrictions, 150);
    } catch (err) {}
  });

  btnTabsRefresh?.addEventListener("click", () => {
    renderAlwaysActiveTabs();
  });

  // Initial tab render for accurate badge and current tab switch state
  renderAlwaysActiveTabs();

  // Live real-time tab & window event updates while popup is open
  if (chrome.tabs?.onCreated) {
    chrome.tabs.onCreated.addListener(() => renderAlwaysActiveTabs());
  }
  if (chrome.tabs?.onRemoved) {
    chrome.tabs.onRemoved.addListener(() => renderAlwaysActiveTabs());
  }
  if (chrome.tabs?.onActivated) {
    chrome.tabs.onActivated.addListener(() => renderAlwaysActiveTabs());
  }
  if (chrome.tabs?.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === "complete" || changeInfo.title || changeInfo.url) {
        renderAlwaysActiveTabs();
      }
    });
  }
  if (chrome.windows?.onCreated) {
    chrome.windows.onCreated.addListener(() => renderAlwaysActiveTabs());
  }
  if (chrome.windows?.onRemoved) {
    chrome.windows.onRemoved.addListener(() => renderAlwaysActiveTabs());
  }

  // Sync Force Select Toggle
  toggleForceSelect.addEventListener("change", async () => {
    const val = toggleForceSelect.checked;
    await chrome.storage.local.set({ forceSelect: val });
    if (toggles.copypaste && val) {
      toggles.copypaste.checked = true;
    }
    await safeSendMessage({ type: "TOGGLE_UNBLOCK", key: "selection", unblock: val });
  });

  // Sync Ghost Mode Toggle
  toggleGhostMode.addEventListener("change", async () => {
    const val = toggleGhostMode.checked;
    await chrome.storage.local.set({ ghostMode: val });
    await safeSendMessage({ type: "TOGGLE_GHOST_MODE", ghostMode: val });
  });

  // Sync Vocab Helper Toggle
  toggleVocabHelper.addEventListener("change", () => {
    chrome.storage.local.set({ vocabHelper: toggleVocabHelper.checked });
  });

  // Typer Settings Listeners
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
    const mode = selectSpeed.value;
    chrome.storage.local.set({ speedMode: mode });
    if (mode === "instant") {
      updateWpmDisplay(600);
    } else if (mode === "fast") {
      updateWpmDisplay(160);
    } else if (mode === "human") {
      updateWpmDisplay(55);
    } else {
      updateWpmDisplay(currentWPM);
    }
  });

  rangeWpm.addEventListener("input", () => {
    currentWPM = parseInt(rangeWpm.value, 10);
    selectSpeed.value = "custom";
    chrome.storage.local.set({ speedMode: "custom", customWPM: currentWPM });
    updateWpmDisplay(currentWPM);
  });

  numWpm.addEventListener("change", () => {
    let val = parseInt(numWpm.value, 10) || 60;
    if (val < 10) val = 10;
    if (val > 600) val = 600;
    currentWPM = val;
    selectSpeed.value = "custom";
    chrome.storage.local.set({ speedMode: "custom", customWPM: currentWPM });
    updateWpmDisplay(currentWPM);
  });

  // Text Staging Workspace
  function updateStagingCounts(str) {
    const chars = str.length;
    const words = str.trim() ? str.trim().split(/\s+/).length : 0;
    stagingCounts.textContent = `${words} words | ${chars} chars`;
  }

  stagingTextarea.addEventListener("input", () => {
    const val = stagingTextarea.value;
    updateStagingCounts(val);
    chrome.storage.local.set({ stagedText: val, lastStagedText: val });
  });

  btnPasteToStaging.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        stagingTextarea.value = text;
        updateStagingCounts(text);
        chrome.storage.local.set({ stagedText: text, lastStagedText: text });
      }
    } catch (e) {}
  });

  btnClearStaging.addEventListener("click", () => {
    stagingTextarea.value = "";
    updateStagingCounts("");
    chrome.storage.local.set({ stagedText: "", lastStagedText: "" });
  });

  btnTypeStaged.addEventListener("click", async () => {
    const text = stagingTextarea.value;
    if (!text || !activeTabId) return;

    btnTypeStaged.textContent = "Typing...";
    try {
      await safeSendMessage({
        type: "TYPE_STAGED_TEXT",
        text: text
      });
      setTimeout(() => (btnTypeStaged.textContent = "⚡ Type into Field"), 1000);
    } catch (err) {
      btnTypeStaged.textContent = "⚡ Type into Field";
    }
  });

  // =========================================================================
  // MULTI-LANGUAGE VOCABULARY & TRANSLATION ENGINE
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

  let currentPopupTab = "en";
  let currentPopupData = null;

  function switchPopupVocabTab(tab) {
    currentPopupTab = tab;
    [popupTabEn, popupTabHi, popupTabBn].forEach((t) => {
      if (t) {
        t.style.background = "transparent";
        t.style.color = "#94a3b8";
        t.classList.remove("active");
      }
    });
    [popupPaneEn, popupPaneHi, popupPaneBn].forEach((p) => {
      if (p) {
        p.style.display = "none";
        p.classList.remove("active");
      }
    });

    if (tab === "en") {
      if (popupTabEn) {
        popupTabEn.style.background = "#ffffff";
        popupTabEn.style.color = "#dc2626";
        popupTabEn.classList.add("active");
      }
      if (popupPaneEn) {
        popupPaneEn.style.display = "block";
        popupPaneEn.classList.add("active");
      }
      if (popupVocabLangBadge) popupVocabLangBadge.textContent = "EN";
    } else if (tab === "hi") {
      if (popupTabHi) {
        popupTabHi.style.background = "#ffffff";
        popupTabHi.style.color = "#dc2626";
        popupTabHi.classList.add("active");
      }
      if (popupPaneHi) {
        popupPaneHi.style.display = "block";
        popupPaneHi.classList.add("active");
      }
      if (popupVocabLangBadge) popupVocabLangBadge.textContent = "HI";
    } else if (tab === "bn") {
      if (popupTabBn) {
        popupTabBn.style.background = "#ffffff";
        popupTabBn.style.color = "#dc2626";
        popupTabBn.classList.add("active");
      }
      if (popupPaneBn) {
        popupPaneBn.style.display = "block";
        popupPaneBn.classList.add("active");
      }
      if (popupVocabLangBadge) popupVocabLangBadge.textContent = "BN";
    }
  }

  popupTabEn?.addEventListener("click", () => switchPopupVocabTab("en"));
  popupTabHi?.addEventListener("click", () => switchPopupVocabTab("hi"));
  popupTabBn?.addEventListener("click", () => switchPopupVocabTab("bn"));

  async function lookupWordInPopup(rawWord) {
    if (!rawWord) return;
    const cleanWord = rawWord.trim().replace(/^[\s,.;:!?'"()\[\]]+|[\s,.;:!?'"()\[\]]+$/g, "") || rawWord.trim();
    if (!cleanWord) return;

    vocabResultBox.style.display = "block";
    vocabWordDisplay.textContent = cleanWord;
    switchPopupVocabTab("en");

    vocabDefinitionsDisplay.innerHTML = `<div style="color:#94a3b8;padding:6px 0;">Looking up English definition...</div>`;
    vocabSynonymsDisplay.innerHTML = "";
    if (popupHiDisplay) popupHiDisplay.innerHTML = `<div style="color:#94a3b8;padding:6px 0;">Looking up Hindi meaning...</div>`;
    if (popupBnDisplay) popupBnDisplay.innerHTML = `<div style="color:#94a3b8;padding:6px 0;">Looking up Bengali meaning...</div>`;

    try {
      const [enRes, dictRes, hiRes, bnRes] = await Promise.allSettled([
        fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(cleanWord)}`).then((r) => r.json()).catch(() => null),
        fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`).then((r) => r.json()).catch(() => null),
        fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=hi&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(cleanWord)}`).then((r) => r.json()).catch(() => null),
        fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=bn&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(cleanWord)}`).then((r) => r.json()).catch(() => null)
      ]);

      const enTrans = enRes.status === "fulfilled" ? enRes.value : null;
      const oxfordData = dictRes.status === "fulfilled" && Array.isArray(dictRes.value) ? dictRes.value[0] : null;
      const hiTrans = hiRes.status === "fulfilled" ? hiRes.value : null;
      const bnTrans = bnRes.status === "fulfilled" ? bnRes.value : null;

      // Parse English
      let enDefs = [];
      let enSyns = [];
      let enAudio = null;

      if (oxfordData) {
        enAudio = oxfordData.phonetics?.find((p) => p.audio)?.audio || null;
        if (Array.isArray(oxfordData.meanings)) {
          oxfordData.meanings.slice(0, 3).forEach((m) => {
            const pos = m.partOfSpeech || "";
            m.definitions?.slice(0, 2).forEach((d) => {
              enDefs.push({ pos, def: d.definition, example: d.example || "" });
            });
            if (Array.isArray(m.synonyms)) enSyns.push(...m.synonyms);
          });
        }
      }

      if (enDefs.length === 0 && enTrans) {
        const gTrans = enTrans[0]?.[0]?.[0] || cleanWord;
        if (Array.isArray(enTrans[1])) {
          enTrans[1].forEach((item) => {
            if (item && item[0] && Array.isArray(item[1])) {
              item[1].slice(0, 3).forEach((meaning) => {
                enDefs.push({ pos: item[0], def: meaning, example: "" });
              });
              enSyns.push(...item[1]);
            }
          });
        }
        if (enDefs.length === 0 && gTrans) {
          enDefs.push({ pos: "definition", def: gTrans, example: "" });
        }
      }

      if (enSyns.length < 4) {
        try {
          const dm = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(cleanWord)}&max=12`).then((r) => r.json());
          if (Array.isArray(dm)) enSyns = Array.from(new Set([...enSyns, ...dm.map((d) => d.word)]));
        } catch (e) {}
      }

      // Parse Hindi
      let hiWord = hiTrans?.[0]?.[0]?.[0] || "";
      let hiRom = hiTrans?.[0]?.[1]?.[3] || "";
      let hiGroups = [];
      let hiSyns = [];
      if (Array.isArray(hiTrans?.[1])) {
        hiTrans[1].forEach((item) => {
          if (item && item[0] && Array.isArray(item[1])) {
            hiGroups.push({ pos: item[0], words: item[1].slice(0, 6) });
            hiSyns.push(...item[1]);
          }
        });
      }

      // Parse Bengali
      let bnWord = bnTrans?.[0]?.[0]?.[0] || "";
      let bnRom = bnTrans?.[0]?.[1]?.[3] || "";
      let bnGroups = [];
      let bnSyns = [];
      if (Array.isArray(bnTrans?.[1])) {
        bnTrans[1].forEach((item) => {
          if (item && item[0] && Array.isArray(item[1])) {
            bnGroups.push({ pos: item[0], words: item[1].slice(0, 6) });
            bnSyns.push(...item[1]);
          }
        });
      }

      currentPopupData = {
        word: cleanWord,
        en: { audio: enAudio, definitions: enDefs, synonyms: enSyns },
        hi: { word: hiWord, romanization: hiRom, groups: hiGroups, synonyms: hiSyns },
        bn: { word: bnWord, romanization: bnRom, groups: bnGroups, synonyms: bnSyns }
      };

      // Render English Tab
      let defsHtml = "";
      if (enDefs.length > 0) {
        enDefs.slice(0, 3).forEach((d) => {
          defsHtml += `
            <div style="margin-bottom:6px;">
              ${d.pos ? `<b style="color:#a5b4fc;text-transform:uppercase;font-size:10px;">[${d.pos}]</b> ` : ""}
              <span>${d.def}</span>
              ${d.example ? `<div style="font-size:11px;color:#94a3b8;font-style:italic;margin-top:2px;">"${d.example}"</div>` : ""}
            </div>
          `;
        });
      } else {
        defsHtml = `<div style="color:#94a3b8;font-size:12px;">No definition found.</div>`;
      }
      vocabDefinitionsDisplay.innerHTML = defsHtml;

      if (enSyns.length > 0) {
        vocabSynonymsDisplay.innerHTML = enSyns
          .slice(0, 14)
          .map((s) => `<span class="syn-chip" data-word="${s}">${s}</span>`)
          .join(" ");
      } else {
        vocabSynonymsDisplay.innerHTML = `<span style="color:#94a3b8;font-size:11px;">No synonyms available.</span>`;
      }

      // Render Hindi Tab
      let hiHtml = "";
      if (hiWord) {
        hiHtml += `<div style="font-size:15px;font-weight:700;color:#60a5fa;margin-bottom:3px;">${hiWord}</div>`;
        if (hiRom) hiHtml += `<div style="font-size:11px;color:#94a3b8;margin-bottom:6px;font-style:italic;">/${hiRom}/</div>`;
        if (hiGroups.length > 0) {
          hiGroups.forEach((g) => {
            hiHtml += `<div style="font-size:11.5px;margin-bottom:4px;color:#cbd5e1;"><b style="color:#ffffff;">${g.pos}:</b> ${g.words.join(", ")}</div>`;
          });
        }
      } else {
        hiHtml = `<div style="color:#94a3b8;font-size:12px;">No Hindi translation found.</div>`;
      }
      if (hiSyns.length > 0) {
        hiHtml += `<div style="font-size:11px;font-weight:700;color:#60a5fa;margin:8px 0 4px 0;">Alternatives (Click to copy):</div>`;
        hiHtml += hiSyns.slice(0, 10).map((s) => `<span class="syn-chip" data-word="${s}">${s}</span>`).join(" ");
      }
      if (popupHiDisplay) popupHiDisplay.innerHTML = hiHtml;

      // Render Bengali Tab
      let bnHtml = "";
      if (bnWord) {
        bnHtml += `<div style="font-size:15px;font-weight:700;color:#60a5fa;margin-bottom:3px;">${bnWord}</div>`;
        if (bnRom) bnHtml += `<div style="font-size:11px;color:#94a3b8;margin-bottom:6px;font-style:italic;">/${bnRom}/</div>`;
        if (bnGroups.length > 0) {
          bnGroups.forEach((g) => {
            bnHtml += `<div style="font-size:11.5px;margin-bottom:4px;color:#cbd5e1;"><b style="color:#ffffff;">${g.pos}:</b> ${g.words.join(", ")}</div>`;
          });
        }
      } else {
        bnHtml = `<div style="color:#94a3b8;font-size:12px;">No Bengali translation found.</div>`;
      }
      if (bnSyns.length > 0) {
        bnHtml += `<div style="font-size:11px;font-weight:700;color:#60a5fa;margin:8px 0 4px 0;">Alternatives (Click to copy):</div>`;
        bnHtml += bnSyns.slice(0, 10).map((s) => `<span class="syn-chip" data-word="${s}">${s}</span>`).join(" ");
      }
      if (popupBnDisplay) popupBnDisplay.innerHTML = bnHtml;

      // Click to copy chips across all panes
      vocabResultBox.querySelectorAll(".syn-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const w = chip.dataset.word;
          navigator.clipboard.writeText(w);
          const orig = chip.textContent;
          chip.textContent = "✓ Copied";
          chip.style.background = "#10b981";
          setTimeout(() => {
            chip.textContent = orig;
            chip.style.removeProperty("background");
          }, 1000);
        });
      });
    } catch (e) {
      vocabDefinitionsDisplay.innerHTML = `<span style="color:#f87171;">Vocabulary lookup encountered an error.</span>`;
    }
  }

  btnVocabSearch.addEventListener("click", () => {
    lookupWordInPopup(vocabSearchInput.value.trim());
  });

  vocabSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      lookupWordInPopup(vocabSearchInput.value.trim());
    }
  });

  btnVocabSpeak.addEventListener("click", () => {
    if (!currentPopupData) return;
    if (currentPopupTab === "en") {
      if (currentPopupData.en.audio) {
        new Audio(currentPopupData.en.audio).play().catch(() => speakWordFallback(currentPopupData.word, "en"));
      } else {
        speakWordFallback(currentPopupData.word, "en");
      }
    } else if (currentPopupTab === "hi") {
      const text = currentPopupData.hi.word || currentPopupData.word;
      speakWordFallback(text, "hi");
    } else if (currentPopupTab === "bn") {
      const text = currentPopupData.bn.word || currentPopupData.word;
      speakWordFallback(text, "bn");
    }
  });

  function speakWordFallback(word, langCode = "en") {
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(word);
        const bcpMap = { en: "en-US", hi: "hi-IN", bn: "bn-IN" };
        utter.lang = bcpMap[langCode] || "en-US";
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const matchedVoice = voices.find((v) =>
            v.lang.toLowerCase().startsWith(langCode.toLowerCase())
          );
          if (matchedVoice) utter.voice = matchedVoice;
        }
        window.speechSynthesis.speak(utter);
      } catch (e) {}
    }
  }

  // Cadence-Preserving Keystroke Dynamics Engine for Playground
  function calculateHumanDelays(text, targetWpm, naturalJitter = true) {
    if (!text || text.length === 0) return [];
    const N = text.length;
    const targetAverageDelay = Math.round(12000 / Math.max(10, Math.min(600, targetWpm)));
    const totalTargetDuration = N * targetAverageDelay;

    if (!naturalJitter) return new Array(N).fill(targetAverageDelay);

    const weights = new Array(N);
    for (let i = 0; i < N; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : "";
      const r1 = Math.random(), r2 = Math.random(), r3 = Math.random();
      let weight = (r1 + r2 + r3) / 1.5;
      weight = Math.max(0.35, Math.min(2.2, weight));

      if (['.', '!', '?', '\n'].includes(char)) weight *= 2.3;
      else if ([',', ';', ':', '-', '—'].includes(char)) weight *= 1.7;
      else if (char === ' ') weight *= 1.35;

      if (/[A-Z]/.test(char)) weight *= 1.3;
      else if (/[0-9]/.test(char)) weight *= 1.25;
      else if (/[@#$%^&*()_+={}\[\]|\\<>\/~`"']/.test(char)) weight *= 1.45;

      if (i > 0 && ['.', '!', '?', '\n'].includes(prevChar) && char !== ' ') weight *= 1.6;
      if (i > 0 && i % 20 === 0 && Math.random() < 0.35) weight *= 1.8;
      if (/[a-z]/.test(char) && /[a-z]/.test(prevChar)) weight *= 0.85;

      weights[i] = weight;
    }

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const scalingFactor = totalTargetDuration / totalWeight;
    let rawDelays = weights.map((w) => w * scalingFactor);

    const minDelay = Math.max(15, Math.min(50, Math.round(targetAverageDelay * 0.25)));
    const maxDelay = Math.max(180, Math.min(550, Math.round(targetAverageDelay * 2.5)));

    let sumDelays = 0;
    const clampedDelays = new Array(N);
    for (let i = 0; i < N; i++) {
      clampedDelays[i] = Math.max(minDelay, Math.min(maxDelay, rawDelays[i]));
      sumDelays += clampedDelays[i];
    }

    const diff = totalTargetDuration - sumDelays;
    const perCharAdjustment = diff / N;
    for (let i = 0; i < N; i++) {
      clampedDelays[i] = Math.max(minDelay, Math.round(clampedDelays[i] + perCharAdjustment));
    }
    return clampedDelays;
  }

  // --- Editable Keyboard Shortcuts & Key Mapping Logic ---
  const defaultShortcuts = {
    paste: { key: "v", alt: true, ctrl: false, shift: false, meta: false, display: "Alt + V" },
    stop: { key: "Escape", alt: false, ctrl: false, shift: false, meta: false, display: "Escape" },
    clear: { key: "k", alt: true, ctrl: false, shift: false, meta: false, display: "Alt + K" },
    copy: { key: "c", alt: true, ctrl: false, shift: false, meta: false, display: "Alt + C" },
    ghost: { key: "h", alt: true, ctrl: false, shift: false, meta: false, display: "Alt + H" }
  };

  let customShortcuts = { ...defaultShortcuts };

  try {
    const scRes = await chrome.storage.local.get(["customShortcuts"]);
    if (scRes && scRes.customShortcuts) {
      customShortcuts = { ...defaultShortcuts, ...scRes.customShortcuts };
    }
  } catch (e) {}

  function updateShortcutButtonsDisplay() {
    Object.keys(defaultShortcuts).forEach((action) => {
      const btn = document.getElementById(`sc-btn-${action}`);
      if (btn && customShortcuts[action]) {
        btn.textContent = customShortcuts[action].display;
      }
    });

    if (testField && customShortcuts.paste) {
      testField.placeholder = `Copy text, click here & press ${customShortcuts.paste.display} to test`;
    }
  }
  updateShortcutButtonsDisplay();

  const btnResetShortcuts = document.getElementById("btn-reset-shortcuts");
  btnResetShortcuts?.addEventListener("click", async () => {
    customShortcuts = { ...defaultShortcuts };
    await chrome.storage.local.set({ customShortcuts });
    updateShortcutButtonsDisplay();
    btnResetShortcuts.textContent = "✓ Reset";
    setTimeout(() => {
      btnResetShortcuts.textContent = "↺ Reset";
    }, 1000);
  });

  let recordingAction = null;
  const shortcutButtons = document.querySelectorAll(".shortcut-key-btn");

  shortcutButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;

      if (recordingAction === action) {
        recordingAction = null;
        btn.classList.remove("recording");
        btn.textContent = customShortcuts[action]?.display || "Alt + V";
        return;
      }

      shortcutButtons.forEach((b) => {
        b.classList.remove("recording");
        const act = b.dataset.action;
        b.textContent = customShortcuts[act]?.display || "Alt + V";
      });

      recordingAction = action;
      btn.classList.add("recording");
      btn.textContent = "Press keys...";
    });
  });

  window.addEventListener("keydown", async (e) => {
    if (!recordingAction) return;

    e.preventDefault();
    e.stopPropagation();

    // If only modifier is held, show partial combo
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
      const parts = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Cmd");
      const btn = document.getElementById(`sc-btn-${recordingAction}`);
      if (btn) btn.textContent = parts.join(" + ") + " + ...";
      return;
    }

    const parts = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Cmd");

    let keyName = e.key;
    if (keyName === " ") keyName = "Space";
    else if (keyName.length === 1) keyName = keyName.toUpperCase();

    parts.push(keyName);
    const displayStr = parts.join(" + ");

    const newMapping = {
      key: e.key,
      code: e.code,
      alt: e.altKey,
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      meta: e.metaKey,
      display: displayStr
    };

    customShortcuts[recordingAction] = newMapping;
    await chrome.storage.local.set({ customShortcuts });

    const btn = document.getElementById(`sc-btn-${recordingAction}`);
    if (btn) {
      btn.classList.remove("recording");
      btn.textContent = `✓ ${displayStr}`;
      setTimeout(() => {
        btn.textContent = displayStr;
      }, 900);
    }

    if (recordingAction === "paste" && testField) {
      testField.placeholder = `Copy text, click here & press ${displayStr} to test`;
    }

    recordingAction = null;
  });

  window.addEventListener("click", () => {
    if (recordingAction) {
      const btn = document.getElementById(`sc-btn-${recordingAction}`);
      if (btn) {
        btn.classList.remove("recording");
        btn.textContent = customShortcuts[recordingAction]?.display || "Alt + V";
      }
      recordingAction = null;
    }
  });

  function matchesShortcut(e, shortcut) {
    if (!shortcut || !shortcut.key) return false;
    const matchAlt = !!shortcut.alt === !!e.altKey;
    const matchCtrl = !!shortcut.ctrl === !!e.ctrlKey;
    const matchShift = !!shortcut.shift === !!e.shiftKey;
    const matchMeta = !!shortcut.meta === !!e.metaKey;

    const keyLower = shortcut.key.toLowerCase();
    const eKeyLower = (e.key || "").toLowerCase();
    const eCodeLower = (e.code || "").toLowerCase();

    const matchKey =
      eKeyLower === keyLower ||
      eCodeLower === `key${keyLower}` ||
      eCodeLower === `digit${keyLower}` ||
      eCodeLower === keyLower;

    return matchAlt && matchCtrl && matchShift && matchMeta && matchKey;
  }

  // Playground simulation inside popup
  testField.addEventListener("keydown", async (e) => {
    if (matchesShortcut(e, customShortcuts.paste)) {
      e.preventDefault();
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return;

        testField.value = "";
        const mode = selectSpeed.value;
        const jitter = toggleJitter.checked;
        let effectiveWpm = parseInt(numWpm.value, 10) || 60;
        if (mode === "human") effectiveWpm = 50;
        if (mode === "fast") effectiveWpm = 150;

        if (mode === "instant") {
          testField.value = text;
          return;
        }

        const delays = calculateHumanDelays(text, effectiveWpm, jitter);
        for (let i = 0; i < text.length; i++) {
          testField.value += text[i];
          await new Promise((r) => setTimeout(r, delays[i]));
        }
      } catch (err) {}
    }
  });

  // Query Current Tab for Restrictions
  async function refreshRestrictions() {
    if (!activeTabId || (activeTabUrl && isRestrictedUrl(activeTabUrl))) {
      summaryText.textContent = "Browser system pages cannot be inspected.";
      overallDot.className = "indicator-dot clear";
      overallText.textContent = "System Tab";
      return;
    }

    try {
      const resp = await safeSendMessage({ type: "GET_PAGE_RESTRICTIONS" });
      const restrictions = resp?.restrictions;

      if (!restrictions) {
        summaryText.textContent = "Extension active. Ready on regular webpages.";
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
          descs[key].innerHTML = `<span style="color:#059669;font-weight:600;">✓ Unblocked locally</span>`;
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
          summaryText.textContent = `All ${blockedCount} detected restriction(s) neutralized.`;
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
      summaryText.textContent = "Extension active. Ready on regular webpages.";
      overallDot.className = "indicator-dot clear";
      overallText.textContent = "Clean Page";
    }
  }

  restrictionKeys.forEach((key) => {
    toggles[key].addEventListener("change", async () => {
      const isUnblock = toggles[key].checked;
      await safeSendMessage({
        type: "TOGGLE_UNBLOCK",
        key: key,
        unblock: isUnblock
      });
      setTimeout(refreshRestrictions, 100);
    });
  });

  btnUnblockAll.addEventListener("click", async () => {
    await safeSendMessage({
      type: "TOGGLE_UNBLOCK",
      key: "all",
      unblock: true
    });
    setTimeout(refreshRestrictions, 100);
  });

  refreshRestrictions();
});
