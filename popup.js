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
  const toggleAlwaysActive = document.getElementById("toggle-always-active");
  const toggleForceSelect = document.getElementById("toggle-force-select");
  const toggleGhostMode = document.getElementById("toggle-ghost-mode");
  const toggleVocabHelper = document.getElementById("toggle-vocab-helper");

  // Query Current Tab early
  let activeTabId = null;
  let activeTabUrl = "";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id || null;
    activeTabUrl = tab?.url || "";
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
    "stagedText",
    "lastStagedText"
  ]);

  toggleTyperEnabled.checked = settings.enabled ?? true;
  toggleFloatingIcon.checked = settings.showFloatingIcon ?? true;
  toggleJitter.checked = settings.naturalJitter ?? true;
  selectSpeed.value = settings.speedMode || "custom";

  toggleAlwaysActive.checked = settings.alwaysActive ?? false;
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
    wpmStats.textContent = `${wpm} WPM (~${delay}ms/char)`;
    rangeWpm.value = Math.min(300, Math.max(15, wpm));
    numWpm.value = wpm;
  }
  updateWpmDisplay(currentWPM);

  // Sync Always Active Toggle
  toggleAlwaysActive.addEventListener("change", async () => {
    const val = toggleAlwaysActive.checked;
    await chrome.storage.local.set({ alwaysActive: val });
    await safeSendMessage({ type: "TOGGLE_UNBLOCK", key: "alwaysActive", unblock: val });
  });

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

  let currentPopupAudioUrl = null;
  let currentPopupLangCode = "en";

  async function lookupWordInPopup(word) {
    if (!word) return;
    vocabResultBox.style.display = "block";
    vocabWordDisplay.textContent = word;
    vocabPhoneticDisplay.textContent = "...";
    vocabDefinitionsDisplay.innerHTML = `<div style="color:#94a3b8;">Searching global definitions & synonyms...</div>`;
    vocabSynonymsDisplay.innerHTML = "";
    currentPopupAudioUrl = null;
    currentPopupLangCode = "en";

    try {
      // 1. Query Universal Multi-Language Engine (Google Translate API)
      const transRes = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(word)}`
      );
      let detectedLang = "en";
      let translation = "";
      let romanization = "";
      let dictMeanings = [];

      if (transRes.ok) {
        const tData = await transRes.json();
        detectedLang = tData[2] || "en";
        currentPopupLangCode = detectedLang;

        if (tData[0] && tData[0][0]) {
          translation = tData[0][0][0] || "";
        }
        if (tData[0] && tData[0][1]) {
          romanization = tData[0][1][3] || "";
        }

        if (Array.isArray(tData[1])) {
          tData[1].forEach((item) => {
            if (item && item[0] && Array.isArray(item[1])) {
              dictMeanings.push({
                partOfSpeech: item[0],
                words: item[1].slice(0, 4)
              });
            }
          });
        }
      }

      const langInfo = LANG_MAP[detectedLang] || { name: detectedLang.toUpperCase(), bcp47: detectedLang };
      vocabPhoneticDisplay.textContent = romanization ? `/${romanization}/` : "";

      let defsHtml = "";
      let synsList = [];

      // If foreign language, display Language Badge & English Meaning
      if (detectedLang !== "en" && translation && translation.toLowerCase() !== word.toLowerCase()) {
        defsHtml += `
          <div style="margin-bottom:8px;padding:6px 10px;background:#1e293b;border-radius:6px;border-left:3px solid #3b82f6;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
              <span style="background:#3b82f6;color:#ffffff;font-size:9.5px;font-weight:700;padding:1px 5px;border-radius:4px;">${langInfo.name}</span>
              <span style="font-size:11px;color:#94a3b8;">English Translation:</span>
            </div>
            <div style="font-size:13px;font-weight:700;color:#60a5fa;">${translation}</div>
          </div>
        `;
      }

      // 2. Query Oxford Dictionary API (for English or translation)
      const lookupTarget = detectedLang === "en" ? word : translation;
      if (lookupTarget) {
        try {
          const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lookupTarget)}`);
          if (dictRes.ok) {
            const data = await dictRes.json();
            if (Array.isArray(data) && data.length > 0) {
              const entry = data[0];
              if (!romanization) {
                vocabPhoneticDisplay.textContent = entry.phonetic || (entry.phonetics?.find((p) => p.text)?.text) || "";
              }
              currentPopupAudioUrl = entry.phonetics?.find((p) => p.audio)?.audio || null;

              if (entry.meanings) {
                entry.meanings.slice(0, 3).forEach((m) => {
                  const part = m.partOfSpeech || "";
                  m.definitions?.slice(0, 2).forEach((d) => {
                    defsHtml += `<div style="margin-bottom:6px;"><b style="color:#a5b4fc;text-transform:uppercase;font-size:10px;">[${part}]</b> ${d.definition}</div>`;
                  });
                  if (m.synonyms) synsList.push(...m.synonyms);
                });
              }
            }
          }
        } catch (e) {}
      }

      // If Oxford didn't yield definitions, use Google Dictionary meanings
      if (dictMeanings.length > 0 && !defsHtml.includes("<b>[")) {
        dictMeanings.forEach((dm) => {
          defsHtml += `<div style="margin-bottom:6px;"><b style="color:#a5b4fc;text-transform:uppercase;font-size:10px;">[${dm.partOfSpeech}]</b> ${dm.words.join(", ")}</div>`;
          synsList.push(...dm.words);
        });
      }

      // 3. Supplement Synonyms via Datamuse
      if (synsList.length < 5 && lookupTarget) {
        try {
          const dmRes = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(lookupTarget)}&max=15`);
          if (dmRes.ok) {
            const dmData = await dmRes.json();
            if (Array.isArray(dmData)) {
              synsList = Array.from(new Set([...synsList, ...dmData.map((d) => d.word)]));
            }
          }
        } catch (e) {}
      }

      vocabDefinitionsDisplay.innerHTML = defsHtml || `<span style="color:#94a3b8;">No direct dictionary entry found.</span>`;

      if (synsList.length > 0) {
        vocabSynonymsDisplay.innerHTML = synsList
          .slice(0, 16)
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
        vocabSynonymsDisplay.innerHTML = `<span style="color:#94a3b8;font-size:11px;">No synonyms available.</span>`;
      }
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
    const word = vocabWordDisplay.textContent;
    if (!word) return;
    if (currentPopupAudioUrl) {
      new Audio(currentPopupAudioUrl).play().catch(() => speakWordFallback(word, currentPopupLangCode));
    } else {
      speakWordFallback(word, currentPopupLangCode);
    }
  });

  function speakWordFallback(word, langCode = "en") {
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(word);
        const langConfig = LANG_MAP[langCode] || { bcp47: "en-US" };
        utter.lang = langConfig.bcp47 || "en-US";
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const matchedVoice = voices.find((v) =>
            v.lang.toLowerCase().startsWith((langCode || "en").toLowerCase().slice(0, 2))
          );
          if (matchedVoice) utter.voice = matchedVoice;
        }
        window.speechSynthesis.speak(utter);
      } catch (e) {}
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
            delay += Math.random() * variance * 2 - variance;
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
