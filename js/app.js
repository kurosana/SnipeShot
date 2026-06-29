/**
 * ねらいうちゲーム - メインアプリ
 */
(function () {
  const $ = (sel) => document.querySelector(sel);

  const screens = {
    start: $("#screen-start"),
    setup: $("#screen-setup"),
    game: $("#screen-game"),
    loading: $("#screen-loading"),
  };

  const state = {
    modeKey: "all",
    modeLabel: "",
    timeSec: 60,
    conditions: [],
    hits: [],
    duelActive: false,
    duelRevealed: false,
    timerInterval: null,
    remainingSec: 0,
    duelPopupShown: false,
    duelCancelled: false,
    answerPreview: false,
    cheatEverUsed: false,
    prevResultStats: null,
    prevConditionSignature: null,
  };

  const setupState = {
    selectedMode: null,
  };

  function resetSetupSelection() {
    setupState.selectedMode = null;
    $("#btn-mode-all").classList.remove("pressed");
    $("#btn-mode-gen").classList.remove("pressed");
    $("#btn-start-setup").hidden = true;
  }

  function selectSetupMode(mode) {
    setupState.selectedMode = mode;
    $("#btn-mode-all").classList.toggle("pressed", mode === "all");
    $("#btn-mode-gen").classList.toggle("pressed", mode === "gen");
    $("#btn-start-setup").hidden = false;
  }

  function getSelectedGameMode() {
    if (setupState.selectedMode === "all") {
      return { key: "all", label: "全ポケモン全わざ" };
    }
    if (setupState.selectedMode === "gen") {
      const key = $("#select-generation").value;
      const mode = DataStore.index.modes.find((m) => m.key === key);
      if (mode) return { key: mode.key, label: mode.label };
    }
    return null;
  }

  let editingRowId = null;
  let searchKind = null;
  let conditionCounter = 0;

  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove("active"));
    screens[name].classList.add("active");
  }

  function confirmDialog(message) {
    return new Promise((resolve) => {
      const dlg = $("#dialog-confirm");
      $("#dialog-message").textContent = message;
      dlg.classList.add("active");
      dlg.setAttribute("aria-hidden", "false");

      const yes = () => cleanup(true);
      const no = () => cleanup(false);

      function cleanup(result) {
        dlg.classList.remove("active");
        dlg.setAttribute("aria-hidden", "true");
        $("#dialog-yes").removeEventListener("click", yes);
        $("#dialog-no").removeEventListener("click", no);
        resolve(result);
      }

      $("#dialog-yes").addEventListener("click", yes);
      $("#dialog-no").addEventListener("click", no);
    });
  }

  function newCondition() {
    conditionCounter += 1;
    return {
      id: `cond-${conditionCounter}`,
      kind: "",
      typeId: null,
      typeName: "",
      abilityId: null,
      abilityName: "",
      moveId: null,
      moveName: "",
      statKey: "",
      statValue: "",
      op: "",
      excluded: false,
    };
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function updateTimerDisplay() {
    const text = formatTime(state.remainingSec);
    const duelEl = $("#duel-timer");
    const bannerEl = $("#banner-timer");
    if (duelEl) duelEl.textContent = text;
    if (bannerEl) {
      bannerEl.textContent = text;
      bannerEl.classList.toggle("timer-urgent", state.remainingSec <= 10 && state.remainingSec > 0);
    }
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function clearTimerDisplay() {
    const duelEl = $("#duel-timer");
    const bannerEl = $("#banner-timer");
    const text = formatTime(state.timeSec);
    if (duelEl) duelEl.textContent = text;
    if (bannerEl) {
      bannerEl.textContent = "";
      bannerEl.classList.remove("timer-urgent");
    }
  }

  function hasActiveConditions() {
    return state.conditions.some((c) => !c.excluded && FilterEngine.isComplete(c));
  }

  function clearDobonStack() {
    const stack = $("#dobon-stack");
    if (!stack) return;
    stack.innerHTML = "";
    stack.hidden = true;
  }

  function appendDobon() {
    const stack = $("#dobon-stack");
    if (!stack) return;
    const item = document.createElement("div");
    item.className = "dobon-item";
    item.innerHTML = `<img src="${CONFIG.imgFolder}/dobon.png" alt="ドボン" class="dobon-image"><p class="dobon-note">※除外ボタンを押して継続してください</p>`;
    stack.appendChild(item);
    stack.hidden = false;
  }

  function showResultStats() {
    const statsBlock = $("#result-stats-block");
    if (statsBlock) statsBlock.hidden = false;
    $("#result-answer").hidden = true;
  }

  function hideResultStats() {
    const statsBlock = $("#result-stats-block");
    if (statsBlock) statsBlock.hidden = true;
  }

  function conditionSignature() {
    return JSON.stringify(
      state.conditions.map((c) => ({
        id: c.id,
        excluded: c.excluded,
        kind: c.kind,
        op: c.op,
        typeId: c.typeId,
        abilityId: c.abilityId,
        moveId: c.moveId,
        statKey: c.statKey,
        statValue: c.statValue,
      }))
    );
  }

  function checkDobon(prevCount, prevLines, count, lines, conditionsChanged) {
    if (prevCount == null || prevLines == null) return;
    if (!hasActiveConditions()) return;
    if (!conditionsChanged) return;
    const linesStuck = lines === 0 || lines === 1;
    if (!linesStuck) return;
    const statsChanged = prevCount !== count || prevLines !== lines;
    const countUnchanged = count >= prevCount;
    if (countUnchanged || statsChanged) {
      appendDobon();
    }
  }

  function resetDuelState() {
    stopTimer();
    state.duelActive = false;
    state.duelRevealed = false;
    state.duelPopupShown = false;
    state.duelCancelled = false;
    hideDuelUI();
    clearTimerDisplay();
    $("#btn-reveal").hidden = true;
    const bannerZone = $("#banner-zone");
    if (bannerZone) bannerZone.classList.remove("banner-zone--duel");
  }

  function startTimer() {
    stopTimer();
    state.remainingSec = state.timeSec;
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
      if (state.remainingSec > 0) {
        state.remainingSec -= 1;
        updateTimerDisplay();
      }
      if (state.remainingSec <= 0) {
        stopTimer();
      }
    }, 1000);
  }

  function showDuelUI() {
    $("#banner-duel-row").hidden = false;
    $("#btn-cancel-duel").hidden = false;
    const bannerZone = $("#banner-zone");
    if (bannerZone) bannerZone.classList.add("banner-zone--duel");
    if (!state.duelRevealed) $("#btn-reveal").hidden = false;
  }

  function hideDuelUI() {
    $("#banner-duel-row").hidden = true;
    $("#btn-cancel-duel").hidden = true;
    $("#btn-reveal").hidden = true;
    const bannerZone = $("#banner-zone");
    if (bannerZone) bannerZone.classList.remove("banner-zone--duel");
  }

  function showDuelPopup() {
    if (state.duelPopupShown || state.duelCancelled) return;
    state.duelPopupShown = true;
    state.duelActive = true;
    const overlay = $("#overlay-duel");
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    showDuelUI();
    startTimer();
    setTimeout(() => {
      overlay.classList.remove("active");
      overlay.setAttribute("aria-hidden", "true");
    }, 3000);
  }

  function cancelDuelMode() {
    resetDuelState();
    state.duelCancelled = true;
    if (!state.duelRevealed) {
      showResultStats();
    }
  }

  function refreshResults({ skipDobon = false } = {}) {
    const prevCount = state.prevResultStats?.count ?? null;
    const prevLines = state.prevResultStats?.lines ?? null;

    state.hits = FilterEngine.applyAll(DataStore.pokemon, state.conditions);
    const { count, lines } = FilterEngine.countResults(state.hits);

    if (!skipDobon) {
      const sig = conditionSignature();
      const conditionsChanged = sig !== state.prevConditionSignature;
      state.prevConditionSignature = sig;
      checkDobon(prevCount, prevLines, count, lines, conditionsChanged);
      state.prevResultStats = { count, lines };
    }

    $("#result-count").textContent = String(count);
    $("#result-lines").textContent = String(lines);

    if (state.answerPreview) {
      renderAnswerList();
    }

    if (!state.duelRevealed && !state.duelCancelled && FilterEngine.shouldDuel(lines)) {
      showDuelPopup();
    }
    if (!FilterEngine.shouldDuel(lines)) {
      state.duelCancelled = false;
      state.duelPopupShown = false;
      state.duelActive = false;
      if (!state.duelRevealed) hideDuelUI();
    }
  }

  function renderValueCell(cond) {
    if (!cond.kind) {
      return '<span class="cell-placeholder">—</span>';
    }
    if (cond.kind === "type") {
      if (cond.typeId == null) {
        return '<button type="button" class="btn-pick btn-pick-type">タイプを選ぶ</button>';
      }
      const t = DataStore.typeById.get(cond.typeId);
      const icon = t ? `${CONFIG.imgFolder}/${t.icon}.png` : "";
      return `<button type="button" class="btn-pick btn-pick-type picked">
        ${icon ? `<img src="${icon}" alt="" class="type-icon-sm">` : ""}
        <span>${escapeHtml(cond.typeName)}</span>
      </button>`;
    }
    if (cond.kind === "ability") {
      if (cond.abilityId == null) {
        return '<button type="button" class="btn-pick btn-pick-ability">特性を選ぶ</button>';
      }
      return `<button type="button" class="btn-pick btn-pick-ability picked">${escapeHtml(cond.abilityName)}</button>`;
    }
    if (cond.kind === "move") {
      if (cond.moveId == null) {
        return '<button type="button" class="btn-pick btn-pick-move">わざを選ぶ</button>';
      }
      return `<button type="button" class="btn-pick btn-pick-move picked">${escapeHtml(cond.moveName)}</button>`;
    }
    if (cond.kind === "stat") {
      const opts =
        `<option value="">選択</option>` +
        Object.entries(CONFIG.statLabels)
          .map(([k, label]) => `<option value="${k}"${cond.statKey === k ? " selected" : ""}>${label}</option>`)
          .join("");
      return `<div class="stat-inputs">
        <select class="select-stat">${opts}</select>
        <input type="number" class="input-stat" min="0" max="999" inputmode="numeric" placeholder="数値" value="${escapeHtml(cond.statValue)}">
      </div>`;
    }
    return "";
  }

  function renderOpCell(cond) {
    if (!cond.kind) return '<span class="cell-placeholder">—</span>';

    if (cond.kind === "type" || cond.kind === "ability") {
      return `<div class="op-toggle">
        <button type="button" class="btn-op${cond.op === "has" ? " active" : ""}" data-op="has">持つ</button>
        <button type="button" class="btn-op${cond.op === "not" ? " active" : ""}" data-op="not">持たない</button>
      </div>`;
    }
    if (cond.kind === "move") {
      return `<div class="op-toggle">
        <button type="button" class="btn-op${cond.op === "learn" ? " active" : ""}" data-op="learn">覚える</button>
        <button type="button" class="btn-op${cond.op === "notlearn" ? " active" : ""}" data-op="notlearn">覚えない</button>
      </div>`;
    }
    if (cond.kind === "stat") {
      return `<div class="op-toggle">
        <button type="button" class="btn-op${cond.op === "gte" ? " active" : ""}" data-op="gte">以上</button>
        <button type="button" class="btn-op${cond.op === "lte" ? " active" : ""}" data-op="lte">以下</button>
      </div>`;
    }
    return "";
  }

  function renderConditions() {
    const tbody = $("#conditions-body");
    tbody.innerHTML = state.conditions
      .map((cond, idx) => {
        const kindOpts = CONFIG.conditionKinds.map(
          (k) => `<option value="${k.value}"${cond.kind === k.value ? " selected" : ""}>${k.label}</option>`
        ).join("");
        return `<tr data-id="${cond.id}"${cond.excluded ? ' class="condition-excluded"' : ""}>
          <td class="col-no">${idx + 1}</td>
          <td class="col-kind">
            <select class="select-kind">
              <option value="">選択</option>
              ${kindOpts}
            </select>
          </td>
          <td class="col-value">${renderValueCell(cond)}</td>
          <td class="col-op">${renderOpCell(cond)}</td>
          <td class="col-actions">
            <div class="cell-actions">
              <button type="button" class="btn-del" aria-label="削除">×</button>
              <button type="button" class="btn-exclude${cond.excluded ? " active" : ""}" aria-label="${cond.excluded ? "除外を解除" : "検索から除外"}">${cond.excluded ? "戻す" : "除外"}</button>
            </div>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("tr").forEach((tr) => {
      const id = tr.dataset.id;
      const cond = state.conditions.find((c) => c.id === id);
      if (!cond) return;

      tr.querySelector(".select-kind")?.addEventListener("change", (e) => {
        cond.kind = e.target.value;
        cond.typeId = null;
        cond.typeName = "";
        cond.abilityId = null;
        cond.abilityName = "";
        cond.moveId = null;
        cond.moveName = "";
        cond.statKey = "";
        cond.statValue = "";
        cond.op = "";
        renderConditions();
        refreshResults();
      });

      tr.querySelector(".btn-pick-type")?.addEventListener("click", () => {
        editingRowId = cond.id;
        openTypePicker();
      });
      tr.querySelector(".btn-pick-ability")?.addEventListener("click", () => {
        editingRowId = cond.id;
        openSearch("ability");
      });
      tr.querySelector(".btn-pick-move")?.addEventListener("click", () => {
        editingRowId = cond.id;
        openSearch("move");
      });

      tr.querySelector(".select-stat")?.addEventListener("change", (e) => {
        cond.statKey = e.target.value;
        refreshResults();
      });
      tr.querySelector(".input-stat")?.addEventListener("input", (e) => {
        cond.statValue = e.target.value;
        refreshResults();
      });

      tr.querySelectorAll(".btn-op").forEach((btn) => {
        btn.addEventListener("click", () => {
          cond.op = btn.dataset.op;
          renderConditions();
          refreshResults();
        });
      });

      tr.querySelector(".btn-exclude")?.addEventListener("click", () => {
        cond.excluded = !cond.excluded;
        clearDobonStack();
        renderConditions();
        refreshResults();
      });

      tr.querySelector(".btn-del")?.addEventListener("click", async () => {
        const ok = await confirmDialog("この条件を削除しますか？");
        if (!ok) return;
        state.conditions = state.conditions.filter((c) => c.id !== cond.id);
        if (state.conditions.length === 0) state.conditions.push(newCondition());
        renderConditions();
        refreshResults();
      });
    });
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatPokemonName(name) {
    const s = String(name ?? "");
    const m = s.match(/^(.+?)（(.+)）$/);
    if (!m) return escapeHtml(s);
    return `${escapeHtml(m[1])}<span class="form-suffix">（${escapeHtml(m[2])}）</span>`;
  }

  function openTypePicker() {
    const list = $("#type-list");
    list.innerHTML = DataStore.types
      .map(
        (t) => `<button type="button" class="type-btn" data-id="${t.id}">
          <img src="${CONFIG.imgFolder}/${t.icon}.png" alt="">
          <span>${escapeHtml(t.name)}</span>
        </button>`
      )
      .join("");
    list.querySelectorAll(".type-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cond = state.conditions.find((c) => c.id === editingRowId);
        if (!cond) return;
        const tid = Number(btn.dataset.id);
        const t = DataStore.typeById.get(tid);
        cond.typeId = tid;
        cond.typeName = t?.name ?? "";
        closeTypePicker();
        renderConditions();
        refreshResults();
      });
    });
    const ov = $("#overlay-type");
    ov.classList.add("active");
    ov.setAttribute("aria-hidden", "false");
  }

  function closeTypePicker() {
    const ov = $("#overlay-type");
    ov.classList.remove("active");
    ov.setAttribute("aria-hidden", "true");
    editingRowId = null;
  }

  function openSearch(kind) {
    searchKind = kind;
    const input = $("#search-input");
    input.placeholder = kind === "ability" ? "特性名で検索" : "わざ名で検索";
    input.value = "";
    renderSearchResults("");
    const ov = $("#overlay-search");
    ov.classList.add("active");
    ov.setAttribute("aria-hidden", "false");
    input.focus();
  }

  function closeSearch() {
    const ov = $("#overlay-search");
    ov.classList.remove("active");
    ov.setAttribute("aria-hidden", "true");
    searchKind = null;
    editingRowId = null;
  }

  function normalizeJaSearch(text) {
    return String(text ?? "")
      .toLowerCase()
      .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .replace(/\u3000/g, " ")
      .replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  }

  function renderSearchResults(query) {
    const q = normalizeJaSearch(query.trim());
    const list = searchKind === "ability" ? DataStore.abilities : DataStore.moves;
    const filtered = q
      ? list
          .filter((item) => normalizeJaSearch(item.name).includes(q))
          .sort((a, b) => {
            const na = normalizeJaSearch(a.name);
            const nb = normalizeJaSearch(b.name);
            const aPrefix = na.startsWith(q);
            const bPrefix = nb.startsWith(q);
            if (aPrefix !== bPrefix) return aPrefix ? -1 : 1;
            return na.localeCompare(nb, "ja");
          })
          .slice(0, CONFIG.searchResultLimit)
      : list.slice(0, CONFIG.searchResultLimit);

    const el = $("#search-results");
    if (!filtered.length) {
      el.innerHTML = '<p class="search-empty">該当なし</p>';
      return;
    }
    el.innerHTML = filtered
      .map(
        (item) =>
          `<button type="button" class="search-result-item" data-id="${item.id}"><span>${escapeHtml(item.name)}</span></button>`
      )
      .join("");

    el.querySelectorAll(".search-result-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cond = state.conditions.find((c) => c.id === editingRowId);
        if (!cond) return;
        const id = Number(btn.dataset.id);
        if (searchKind === "ability") {
          cond.abilityId = id;
          cond.abilityName = DataStore.abilityById.get(id)?.name ?? "";
        } else {
          cond.moveId = id;
          cond.moveName = DataStore.moveById.get(id)?.name ?? "";
        }
        closeSearch();
        renderConditions();
        refreshResults();
      });
    });
  }

  function updateCheatButtonUI() {
    const btnCheat = $("#btn-cheat");
    if (!btnCheat) return;
    btnCheat.classList.toggle("active", state.answerPreview);
    btnCheat.classList.toggle("cheat-used", state.cheatEverUsed && !state.answerPreview);
  }

  function resetGame() {
    resetDuelState();
    state.conditions = [newCondition()];
    state.hits = [];
    state.answerPreview = false;
    state.cheatEverUsed = false;
    state.prevResultStats = null;
    state.prevConditionSignature = null;
    state.remainingSec = state.timeSec;
    clearDobonStack();
    updateCheatButtonUI();
    showResultStats();
    renderConditions();
    refreshResults();
  }

  async function startGame(modeKey, modeLabel) {
    showScreen("loading");
    await DataStore.loadMode(modeKey);
    state.modeKey = modeKey;
    state.modeLabel = modeLabel;
    state.timeSec = Number($("#select-time").value);
    resetGame();
    const bannerTitle = $("#banner-title");
    if (bannerTitle) bannerTitle.textContent = modeLabel;
    showScreen("game");
  }

  function populateGenerationSelect() {
    const sel = $("#select-generation");
    sel.innerHTML = DataStore.getGenerationModes()
      .map((m) => `<option value="${m.key}">${escapeHtml(m.label)}</option>`)
      .join("");
  }

  function renderAnswerList() {
    const groups = FilterEngine.groupHitsForDisplay(state.hits);
    const el = $("#result-answer");
    el.innerHTML = groups
      .map((names) => `<p class="answer-line">${names.map(formatPokemonName).join("・")}</p>`)
      .join("");
    el.hidden = false;
    hideResultStats();
  }

  function hideAnswerList() {
    $("#result-answer").hidden = true;
    showResultStats();
  }

  function revealAnswer() {
    stopTimer();
    state.duelActive = false;
    hideDuelUI();
    state.duelRevealed = true;
    state.answerPreview = false;
    state.cheatEverUsed = false;
    updateCheatButtonUI();
    renderAnswerList();
    $("#btn-reveal").hidden = true;
  }

  function toggleAnswerPreview() {
    const prevPreview = state.answerPreview;
    if (!state.cheatEverUsed) state.cheatEverUsed = true;
    state.answerPreview = !state.answerPreview;
    try {
      if (state.answerPreview) {
        refreshResults({ skipDobon: true });
        renderAnswerList();
      } else {
        hideAnswerList();
      }
    } catch (e) {
      console.error(e);
      state.answerPreview = prevPreview;
      if (state.answerPreview) {
        renderAnswerList();
      } else {
        hideAnswerList();
      }
      alert("カンニング表示に失敗しました。Ctrl+Shift+R で再読み込みしてください。");
    } finally {
      updateCheatButtonUI();
    }
  }

  function getRulesBasicHtml() {
    return CONFIG.rulesBasicHtml || CONFIG.rulesHtml || "";
  }

  function getRulesDetailHtml() {
    return CONFIG.rulesDetailHtml || "";
  }

  function buildStartRulesHtml() {
    const basic = getRulesBasicHtml();
    return `${basic}<p class="rules-help-hint">詳しくはゲーム画面のヘルプボタンで！</p>`;
  }

  function buildOverlayRulesHtml() {
    const basic = getRulesBasicHtml();
    const detail = getRulesDetailHtml();
    if (!detail) return basic;
    return `${basic}<div class="rules-detail">${detail}</div>`;
  }

  function openRulesOverlay() {
    const body = $("#rules-overlay-body");
    if (body) {
      body.innerHTML = buildOverlayRulesHtml();
    }
    const ov = $("#overlay-rules");
    ov.classList.add("active");
    ov.setAttribute("aria-hidden", "false");
  }

  function closeRulesOverlay() {
    const ov = $("#overlay-rules");
    ov.classList.remove("active");
    ov.setAttribute("aria-hidden", "true");
  }

  function applyTheme(colors) {
    if (!colors) return;
    const root = document.documentElement;
    const map = {
      bg: "--bg",
      btnPrimary: "--btn-primary",
      btnPrimaryHover: "--btn-primary-hover",
      btnSecondary: "--btn-secondary",
      btnSecondaryHover: "--btn-secondary-hover",
      btnPressed: "--btn-pressed",
      text: "--text",
      textMuted: "--text-muted",
      placeholder: "--placeholder",
      border: "--border",
      danger: "--danger",
    };
    Object.entries(map).forEach(([key, cssVar]) => {
      if (colors[key]) root.style.setProperty(cssVar, colors[key]);
    });
  }

  function applyAppConfig(cfg) {
    if (!cfg) return;
    if (cfg.appTitle) {
      CONFIG.appTitle = cfg.appTitle;
      document.title = cfg.appTitle;
      const titleEl = $("#app-title");
      if (titleEl) titleEl.textContent = cfg.appTitle;
    }
    if (cfg.rulesBasicHtml || cfg.rulesDetailHtml || cfg.rulesHtml) {
      if (cfg.rulesBasicHtml) CONFIG.rulesBasicHtml = cfg.rulesBasicHtml;
      if (cfg.rulesDetailHtml) CONFIG.rulesDetailHtml = cfg.rulesDetailHtml;
      if (cfg.rulesHtml) CONFIG.rulesHtml = cfg.rulesHtml;
      const box = $("#rules-box");
      if (box) box.innerHTML = buildStartRulesHtml();
    }
    if (cfg.version) {
      CONFIG.version = cfg.version;
      const verEl = $("#app-version");
      if (verEl) verEl.textContent = cfg.version;
    }
    if (cfg.releaseNotes) {
      CONFIG.releaseNotes = cfg.releaseNotes;
      const notesEl = $("#app-release-notes");
      if (notesEl) {
        notesEl.textContent = cfg.releaseNotes;
        notesEl.hidden = !cfg.releaseNotes.trim();
      }
    }
    applyTheme(cfg.colors);
  }

  async function loadAppConfig() {
    try {
      const res = await fetch("config.json");
      if (!res.ok) return;
      const cfg = await res.json();
      applyAppConfig(cfg);
    } catch (e) {
      console.warn("config.json not loaded", e);
    }
  }

  function verifyFilterEngine() {
    if (typeof FilterEngine?.groupHitsForDisplay === "function") return true;
    alert(
      "js/filter.js が古い可能性があります。Ctrl+Shift+R（スーパーリロード）でページを再読み込みしてください。"
    );
    return false;
  }

  async function init() {
    showScreen("loading");
    try {
      if (!verifyFilterEngine()) {
        showScreen("start");
        return;
      }
      await loadAppConfig();
      const rulesBox = $("#rules-box");
      if (rulesBox && !rulesBox.innerHTML.trim()) {
        rulesBox.innerHTML = buildStartRulesHtml();
      }
      await DataStore.init();
      populateGenerationSelect();
      showScreen("start");
    } catch (e) {
      console.error(e);
      showScreen("start");
      alert("データの読み込みに失敗しました。");
    }
  }

  // --- events ---
  $("#btn-to-setup").addEventListener("click", () => {
    resetSetupSelection();
    showScreen("setup");
  });
  $("#btn-back-start").addEventListener("click", () => {
    resetSetupSelection();
    showScreen("start");
  });

  $("#btn-mode-all").addEventListener("click", () => {
    selectSetupMode("all");
  });

  $("#btn-mode-gen").addEventListener("click", () => {
    selectSetupMode("gen");
  });

  $("#btn-start-setup").addEventListener("click", () => {
    const mode = getSelectedGameMode();
    if (mode) startGame(mode.key, mode.label);
  });

  $("#btn-add-condition").addEventListener("click", () => {
    state.conditions.push(newCondition());
    renderConditions();
  });

  $("#btn-restart").addEventListener("click", async () => {
    const ok = await confirmDialog("同じルールで初めから遊びますか？");
    if (ok) resetGame();
  });

  $("#btn-cheat").addEventListener("click", toggleAnswerPreview);

  $("#btn-exit").addEventListener("click", async () => {
    const ok = await confirmDialog("ゲームを終了してスタート画面に戻りますか？");
    if (!ok) return;
    resetDuelState();
    state.cheatEverUsed = false;
    updateCheatButtonUI();
    clearDobonStack();
    showScreen("start");
  });

  $("#btn-reveal").addEventListener("click", revealAnswer);

  $("#btn-cancel-duel").addEventListener("click", cancelDuelMode);

  $("#btn-rules-help").addEventListener("click", openRulesOverlay);
  $("#btn-close-rules").addEventListener("click", closeRulesOverlay);
  $("#overlay-rules").addEventListener("click", (e) => {
    if (e.target === $("#overlay-rules")) closeRulesOverlay();
  });

  $("#btn-close-type").addEventListener("click", closeTypePicker);
  $("#overlay-type").addEventListener("click", (e) => {
    if (e.target === $("#overlay-type")) closeTypePicker();
  });

  $("#btn-close-search").addEventListener("click", closeSearch);
  $("#overlay-search").addEventListener("click", (e) => {
    if (e.target === $("#overlay-search")) closeSearch();
  });
  $("#search-input").addEventListener("input", (e) => renderSearchResults(e.target.value));

  $("#dialog-confirm .dialog-backdrop").addEventListener("click", () => {
    $("#dialog-no").click();
  });

  init();
})();
