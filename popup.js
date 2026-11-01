// popup.js - Manages Shield, Typer, Text Staging, and Vocabulary Helper

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
  const toggleAlwaysActive = document.getElementById("toggle-always-active");
  const toggleForceSelect = document.getElementById("toggle-force-select");
  const toggleGhostMode = document.getElementById("toggle-ghost-mode");
  const toggleVocabHelper = document.getElementById("toggle-vocab-helper");

  // Query Current Tab early
  let activeTabId = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id;
  } catch (e) {}

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
  const vocabPhoneticDisplay = document.getElementById("vocab-phonetic-display");
  const vocabDefinitionsDisplay = document.getElementById("vocab-definitions-display");
  const vocabSynonymsDisplay = document.getElementById("vocab-synonyms-display");
  const btnVocabSpeak = document.getElementById("btn-vocab-speak");

  // Load Settings from Storage
  const settings = await chrome.storage.local.get([
    "enabled",
    "showFloatingIcon",
    "naturalJitter",
    "speedMode",
    "customWPM",
    "alwaysActive",
    "forceSelect",
    "ghostMode",
    "vocabHelper",
    "stagedText"
  ]);

  toggleTyperEnabled.checked = settings.enabled ?? true;
  toggleFloatingIcon.checked = settings.showFloatingIcon ?? true;
  toggleJitter.checked = settings.naturalJitter ?? true;
  selectSpeed.value = settings.speedMode || "custom";

  toggleAlwaysActive.checked = settings.alwaysActive ?? false;
  toggleForceSelect.checked = settings.forceSelect ?? false;
  toggleGhostMode.checked = settings.ghostMode ?? false;
  toggleVocabHelper.checked = settings.vocabHelper ?? true;

  if (settings.stagedText) {
    stagingTextarea.value = settings.stagedText;
    updateStagingCounts(settings.stagedText);
  }

  let currentWPM = Number(settings.customWPM) || 60;
  if (currentWPM < 10) currentWPM = 10;
  if (currentWPM > 600) currentWPM = 600;

  function updateWpmDisplay(wpm) {
    const delay = Math.round(12000 / wpm);
    wpmStats.textContent = `${wpm} WPM (~${delay}ms/char)`;
    rangeWpm.value = Math.min(300, Math.max(15, wpm));
    numWpm.value = wpm;
  }
  updateWpmDisplay(currentWPM);

  // Sync Always Active Toggle
  toggleAlwaysActive.addEventListener("change", async () => {
    const val = toggleAlwaysActive.checked;
    await chrome.storage.local.set({ alwaysActive: val });
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { type: "TOGGLE_UNBLOCK", key: "alwaysActive", unblock: val });
    }
  });

  // Sync Force Select Toggle
  toggleForceSelect.addEventListener("change", async () => {
    const val = toggleForceSelect.checked;
    await chrome.storage.local.set({ forceSelect: val });
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { type: "TOGGLE_UNBLOCK", key: "selection", unblock: val });
    }
  });

  // Sync Ghost Mode Toggle
  toggleGhostMode.addEventListener("change", async () => {
    const val = toggleGhostMode.checked;
    await chrome.storage.local.set({ ghostMode: val });
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { type: "TOGGLE_GHOST_MODE", ghostMode: val }).catch(() => {});
    }
  });

  // Sync Vocab Helper Toggle
  toggleVocabHelper.addEventListener("change", () => {
    chrome.storage.local.set({ vocabHelper: toggleVocabHelper.checked });
  });

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
  });

  rangeWpm.addEventListener("input", () => {
    const val = parseInt(rangeWpm.value, 10);
    updateWpmDisplay(val);
    chrome.storage.local.set({ customWPM: val });
  });

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

  // =========================================================================
  // TEXT STAGING (Feature 1)
  // =========================================================================

  function updateStagingCounts(text) {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    stagingCounts.textContent = `${words} words • ${chars} chars`;
  }

  stagingTextarea.addEventListener("input", () => {
    const val = stagingTextarea.value;
    updateStagingCounts(val);
    chrome.storage.local.set({ stagedText: val });
  });

  btnPasteToStaging.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        stagingTextarea.value = text;
        updateStagingCounts(text);
        chrome.storage.local.set({ stagedText: text });
      }
    } catch (e) {}
  });

  btnClearStaging.addEventListener("click", () => {
    stagingTextarea.value = "";
    updateStagingCounts("");
    chrome.storage.local.set({ stagedText: "" });
  });

  btnTypeStaged.addEventListener("click", async () => {
    const text = stagingTextarea.value;
    if (!text || !activeTabId) return;

    btnTypeStaged.textContent = "Typing...";
    try {
      await chrome.tabs.sendMessage(activeTabId, {
        type: "TYPE_STAGED_TEXT",
        text: text
      });
      setTimeout(() => (btnTypeStaged.textContent = "⚡ Type into Field"), 1000);
    } catch (err) {
      btnTypeStaged.textContent = "⚡ Type into Field";
    }
  });

  // =========================================================================
  // VOCABULARY & THESAURUS HELPER (Feature 4)
  // =========================================================================

  let currentPopupAudio = null;

  async function lookupWordInPopup(word) {
    if (!word) return;
    vocabResultBox.style.display = "block";
    vocabWordDisplay.textContent = word;
    vocabPhoneticDisplay.textContent = "...";
    vocabDefinitionsDisplay.innerHTML = `<div style="color:#94a3b8;">Searching definitions & synonyms...</div>`;
    vocabSynonymsDisplay.innerHTML = "";
    currentPopupAudio = null;

    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const entry = data[0];
          vocabPhoneticDisplay.textContent = entry.phonetic || (entry.phonetics?.find((p) => p.text)?.text) || "";
          currentPopupAudio = entry.phonetics?.find((p) => p.audio)?.audio || null;

          let defsHtml = "";
          let synsList = [];

          if (entry.meanings) {
            entry.meanings.slice(0, 3).forEach((m) => {
              const part = m.partOfSpeech || "";
              m.definitions?.slice(0, 2).forEach((d) => {
                defsHtml += `<div style="margin-bottom:6px;"><b style="color:#a5b4fc;text-transform:uppercase;font-size:10px;">[${part}]</b> ${d.definition}</div>`;
              });
              if (m.synonyms) synsList.push(...m.synonyms);
            });
          }
          vocabDefinitionsDisplay.innerHTML = defsHtml || "No definition text found.";

          // Supplement synonyms via Datamuse
          if (synsList.length < 5) {
            try {
              const dm = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=15`);
              const dmData = await dm.json();
              if (Array.isArray(dmData)) {
                synsList = Array.from(new Set([...synsList, ...dmData.map((d) => d.word)]));
              }
            } catch (e) {}
          }

          if (synsList.length > 0) {
            vocabSynonymsDisplay.innerHTML = synsList
              .slice(0, 15)
              .map((s) => `<span class="syn-chip" data-word="${s}">${s}</span>`)
              .join(" ");

            vocabSynonymsDisplay.querySelectorAll(".syn-chip").forEach((chip) => {
              chip.addEventListener("click", () => {
                const w = chip.dataset.word;
                navigator.clipboard.writeText(w);
                chip.textContent = "Copied!";
                chip.style.background = "#10b981";
                setTimeout(() => {
                  chip.textContent = w;
                  chip.style.background = "#1e293b";
                }, 1000);
              });
            });
          } else {
            vocabSynonymsDisplay.innerHTML = `<span style="color:#94a3b8;font-size:11px;">No synonyms found.</span>`;
          }
          return;
        }
      }
    } catch (e) {}

    vocabDefinitionsDisplay.innerHTML = `<span style="color:#f87171;">No direct definitions found. Check spelling.</span>`;
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
    const word = vocabWordDisplay.textContent;
    if (!word) return;
    if (currentPopupAudio) {
      new Audio(currentPopupAudio).play().catch(() => speakWordFallback(word));
    } else {
      speakWordFallback(word);
    }
  });

  function speakWordFallback(word) {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(word);
      utter.lang = "en-US";
      window.speechSynthesis.speak(utter);
    }
  }

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
            if (char === " ") delay += baseDelay * 0.2;
            if ([".", ",", "!", "?"].includes(char)) delay += baseDelay * 0.5;
          }
          await new Promise((r) => setTimeout(r, Math.max(5, delay)));
        }
      } catch (err) {}
    }
  });

  // Query Current Tab for Restrictions
  async function refreshRestrictions() {
    if (!activeTabId) {
      summaryText.textContent = "Unable to inspect background tabs.";
      return;
    }

    try {
      const resp = await chrome.tabs.sendMessage(activeTabId, { type: "GET_PAGE_RESTRICTIONS" });
      const restrictions = resp?.restrictions;

      if (!restrictions) {
        summaryText.textContent = "No restrictions detected on this page.";
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
